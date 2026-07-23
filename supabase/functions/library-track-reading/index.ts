/**
 * library-track-reading — upsert a user's reading progress for a book.
 *
 * Auth: user-jwt required
 * Input: JSON { book_id, current_page?, percent_complete, last_position?, mark_completed? }
 * Returns: JSON { ok, progress }
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
  book_id: string;
  current_page?: number;
  percent_complete: number;
  last_position?: Record<string, unknown>;
  mark_completed?: boolean;
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

  const { book_id, current_page, percent_complete, last_position, mark_completed } = body;

  if (!book_id) return json({ error: "book_id is required" }, 400, cors);
  if (typeof percent_complete !== "number" || percent_complete < 0 || percent_complete > 100) {
    return json({ error: "percent_complete must be a number between 0 and 100" }, 400, cors);
  }

  try {
    const now = new Date().toISOString();
    // completed_at is only included when mark_completed is true — omitting
    // the key (rather than sending null) means the upsert's ON CONFLICT DO
    // UPDATE SET leaves an already-set completed_at untouched on later
    // in-progress updates, instead of clobbering it back to null.
    const row: Record<string, unknown> = {
      user_id: user.id,
      book_id,
      current_page: current_page ?? null,
      percent_complete,
      last_position: last_position ?? {},
      last_read_at: now,
    };
    if (mark_completed) row.completed_at = now;

    const { data, error } = await userClient
      .from("library_reading_progress")
      .upsert(row, { onConflict: "user_id,book_id" })
      .select()
      .single();

    if (error) throw error;

    return json({ ok: true, progress: data }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-track-reading error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
