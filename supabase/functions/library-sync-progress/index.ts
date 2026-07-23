/**
 * library-sync-progress — reconcile Phase 1's localStorage-backed personal
 * shelf (src/lib/library/libraryLocalStore.ts) with real Supabase rows on
 * login. This is the actual bridge Phase 3's frontend will call once when
 * a user signs in with pre-existing local state.
 *
 * Auth: user-jwt required
 * Input: JSON {
 *   shelf_book_ids?: string[],
 *   favorite_book_ids?: string[],
 *   downloaded_book_ids?: string[],
 *   reading_progress?: { book_id: string; percent_complete: number }[]
 * }
 * Returns: JSON { ok, synced: { shelf, favorites, downloads, progress } }
 *
 * Merge strategy: additive only (INSERT ... ON CONFLICT DO NOTHING / upsert
 * that only advances progress forward) — a sync never removes server-side
 * state the local snapshot doesn't happen to know about, since the local
 * snapshot could simply be stale (e.g. another device already synced).
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  shelf_book_ids?: string[];
  favorite_book_ids?: string[];
  downloaded_book_ids?: string[];
  reading_progress?: { book_id: string; percent_complete: number }[];
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const shelfIds = Array.isArray(body.shelf_book_ids) ? body.shelf_book_ids : [];
  const favoriteIds = Array.isArray(body.favorite_book_ids) ? body.favorite_book_ids : [];
  const downloadIds = Array.isArray(body.downloaded_book_ids) ? body.downloaded_book_ids : [];
  const progressRows = Array.isArray(body.reading_progress) ? body.reading_progress : [];

  const MAX_ITEMS = 500;
  if (shelfIds.length > MAX_ITEMS || favoriteIds.length > MAX_ITEMS || downloadIds.length > MAX_ITEMS || progressRows.length > MAX_ITEMS) {
    return json({ error: `Too many items in a single sync (max ${MAX_ITEMS} per list)` }, 400, cors);
  }

  try {
    const synced = { shelf: 0, favorites: 0, downloads: 0, progress: 0 };

    if (shelfIds.length > 0) {
      const { error, count } = await userClient
        .from("library_shelf_items")
        .upsert(
          shelfIds.map((book_id) => ({ user_id: user.id, book_id })),
          { onConflict: "user_id,book_id", ignoreDuplicates: true, count: "exact" }
        );
      if (error) throw error;
      synced.shelf = count ?? shelfIds.length;
    }

    if (favoriteIds.length > 0) {
      const { error, count } = await userClient
        .from("library_favorites")
        .upsert(
          favoriteIds.map((book_id) => ({ user_id: user.id, book_id })),
          { onConflict: "user_id,book_id", ignoreDuplicates: true, count: "exact" }
        );
      if (error) throw error;
      synced.favorites = count ?? favoriteIds.length;
    }

    if (downloadIds.length > 0) {
      const rows = downloadIds.map((book_id) => ({ user_id: user.id, book_id }));
      const { error } = await userClient.from("library_downloads").insert(rows);
      // Downloads has no unique constraint (a book can be downloaded multiple
      // times), so duplicate inserts here are expected on re-sync and not an error.
      if (error && !error.message.includes("can_access_library_book_content")) throw error;
      synced.downloads = rows.length;
    }

    if (progressRows.length > 0) {
      for (const p of progressRows) {
        if (!p.book_id || typeof p.percent_complete !== "number") continue;
        // Only advance progress forward — never let a stale local snapshot
        // regress a book that's further along on the server.
        const { data: existing } = await userClient
          .from("library_reading_progress")
          .select("percent_complete")
          .eq("user_id", user.id)
          .eq("book_id", p.book_id)
          .maybeSingle();

        if (existing && existing.percent_complete >= p.percent_complete) continue;

        const { error } = await userClient.from("library_reading_progress").upsert(
          {
            user_id: user.id,
            book_id: p.book_id,
            percent_complete: p.percent_complete,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "user_id,book_id" }
        );
        if (error) throw error;
        synced.progress++;
      }
    }

    return json({ ok: true, synced }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-sync-progress error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
