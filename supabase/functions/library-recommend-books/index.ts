/**
 * library-recommend-books — real (non-ML) v1 recommendation engine:
 * same-category/same-author signal from the caller's own favorites/shelf,
 * a collaborative "readers who favorited your books also favorited"
 * signal, and (Phase 7) a listening-popularity signal from
 * get_library_most_listened_books() — books trending in the last 30 days
 * of audiobook listens get a modest score boost, format-agnostic (a
 * listening trend can surface either the audiobook or ebook edition of a
 * title). Writes the ranked result into library_book_recommendations as a
 * cache (20260720000003_library_core_discovery_analytics.sql — that table
 * has no direct-write policy for regular users, so this function uses the
 * service-role client, which is also required to read OTHER users'
 * favorites for the collaborative signal — library_favorites RLS is
 * strictly "user manages own", by design).
 *
 * Auth: user-jwt required (recommends for the calling user only)
 * Input: JSON { limit?: number (default 20, max 50) }
 * Returns: JSON { ok, recommendations }
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
  limit?: number;
}

interface ScoredBook {
  book_id: string;
  score: number;
  reasons: string[];
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody = {};
  try {
    if (req.headers.get("content-length") !== "0") body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);

  try {
    // 1. Signal set: books the caller already has on their shelf/favorites,
    //    plus (Phase 10) purchase history — owning a book is at least as
    //    strong a taste signal as shelving/favoriting it, and previously
    //    went completely unused here. All three feed the same knownIds set
    //    used below for category/author matching and exclusion.
    const [{ data: shelf }, { data: favorites }, { data: purchases }] = await Promise.all([
      serviceClient.from("library_shelf_items").select("book_id").eq("user_id", user.id),
      serviceClient.from("library_favorites").select("book_id").eq("user_id", user.id),
      serviceClient.from("library_purchases").select("book_id").eq("buyer_id", user.id).in("status", ["paid", "completed"]),
    ]);
    const knownIds = new Set([...(shelf ?? []), ...(favorites ?? []), ...(purchases ?? [])].map((r) => r.book_id));

    if (knownIds.size === 0) {
      // Cold start: no signal yet — fall back to top-rated published books.
      const { data: popular, error } = await serviceClient
        .from("library_books")
        .select("id, rating_avg")
        .eq("publish_status", "published")
        .order("rating_avg", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;

      const rows = (popular ?? []).map((b) => ({
        user_id: user.id,
        book_id: b.id,
        score: b.rating_avg ?? 0,
        reason: "Popular on Visionex Library",
        generated_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        await serviceClient.from("library_book_recommendations").upsert(rows, { onConflict: "user_id,book_id" });
      }
      return json({ ok: true, recommendations: rows }, 200, cors);
    }

    // 2. Same-category / same-author signal, now genre-weighted: a category
    //    that makes up more of the caller's known books contributes
    //    proportionally more to the score, instead of every matched
    //    category being worth the same flat bonus regardless of how much
    //    the reader actually favors it.
    const { data: knownBooks } = await serviceClient
      .from("library_books")
      .select("id, category_id, author_id")
      .in("id", Array.from(knownIds));

    const categoryCounts = new Map<string, number>();
    for (const b of knownBooks ?? []) {
      if (!b.category_id) continue;
      categoryCounts.set(b.category_id, (categoryCounts.get(b.category_id) ?? 0) + 1);
    }
    const totalCategoryVotes = Array.from(categoryCounts.values()).reduce((sum, c) => sum + c, 0) || 1;
    const categoryIds = Array.from(categoryCounts.keys());
    const authorIds = Array.from(new Set((knownBooks ?? []).map((b) => b.author_id).filter(Boolean)));

    const scores = new Map<string, ScoredBook>();

    if (categoryIds.length > 0 || authorIds.length > 0) {
      let query = serviceClient
        .from("library_books")
        .select("id, category_id, author_id, rating_avg")
        .eq("publish_status", "published");
      if (categoryIds.length > 0 && authorIds.length > 0) {
        query = query.or(`category_id.in.(${categoryIds.join(",")}),author_id.in.(${authorIds.join(",")})`);
      } else if (categoryIds.length > 0) {
        query = query.in("category_id", categoryIds);
      } else {
        query = query.in("author_id", authorIds);
      }
      const { data: candidates } = await query.limit(200);

      for (const b of candidates ?? []) {
        if (knownIds.has(b.id)) continue;
        const entry = scores.get(b.id) ?? { book_id: b.id, score: 0, reasons: [] };
        const categoryWeight = b.category_id ? (categoryCounts.get(b.category_id) ?? 0) / totalCategoryVotes : 0;
        if (categoryWeight > 0) {
          // 0.5-2.5 range: a category the reader barely touches still gives
          // a small nudge, one that dominates their known books gives close
          // to the old flat bonus's ceiling.
          entry.score += 0.5 + categoryWeight * 2 + (b.rating_avg ?? 0) / 5;
          entry.reasons.push("Matches your favorite genres");
        }
        if (authorIds.includes(b.author_id)) {
          entry.score += 1.5 + (b.rating_avg ?? 0) / 5;
          entry.reasons.push("By an author you follow");
        }
        scores.set(b.id, entry);
      }
    }

    // 3. Collaborative signal: readers who favorited the same books also
    //    favorited these — a classic co-occurrence recommender.
    const { data: coReaders } = await serviceClient
      .from("library_favorites")
      .select("user_id")
      .in("book_id", Array.from(knownIds))
      .neq("user_id", user.id);
    const coReaderIds = Array.from(new Set((coReaders ?? []).map((r) => r.user_id))).slice(0, 100);

    if (coReaderIds.length > 0) {
      const { data: coFavorites } = await serviceClient
        .from("library_favorites")
        .select("book_id")
        .in("user_id", coReaderIds)
        .not("book_id", "in", `(${Array.from(knownIds).join(",") || "00000000-0000-0000-0000-000000000000"})`);

      const freq = new Map<string, number>();
      for (const row of coFavorites ?? []) freq.set(row.book_id, (freq.get(row.book_id) ?? 0) + 1);

      for (const [bookId, count] of freq) {
        const entry = scores.get(bookId) ?? { book_id: bookId, score: 0, reasons: [] };
        entry.score += Math.min(count, 10) * 0.3;
        entry.reasons.push("Readers with similar taste also liked this");
        scores.set(bookId, entry);
      }
    }

    // 4. Listening-popularity signal: books trending in recent audiobook
    //    listens (30-day rolling, via get_library_most_listened_books())
    //    get a modest boost — surfaces what's currently popular to listen
    //    to, independent of the category/author/collaborative signals above.
    const { data: mostListened } = await serviceClient.rpc("get_library_most_listened_books", { _limit: 30 });
    for (const row of (mostListened ?? []) as Array<{ book_id: string; listen_count: number }>) {
      if (knownIds.has(row.book_id)) continue;
      const entry = scores.get(row.book_id) ?? { book_id: row.book_id, score: 0, reasons: [] };
      entry.score += Math.min(row.listen_count, 20) * 0.05;
      entry.reasons.push("Trending in listeners this month");
      scores.set(row.book_id, entry);
    }

    const ranked = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const rows = ranked.map((r) => ({
      user_id: user.id,
      book_id: r.book_id,
      score: r.score,
      reason: r.reasons[0] ?? "Recommended for you",
      generated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      await serviceClient.from("library_book_recommendations").upsert(rows, { onConflict: "user_id,book_id" });
    }

    return json({ ok: true, recommendations: rows }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-recommend-books error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
