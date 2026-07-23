/**
 * library-semantic-search — embeds the caller's free-text query and matches
 * it against library_books.embedding via match_library_books_semantic()
 * (pgvector cosine distance, SECURITY DEFINER, filters publish_status=
 * 'published' itself — see 20260729000000_library_marketplace.sql). Public
 * endpoint: book metadata is never content-gated, so no Authorization is
 * required, matching fetchCatalog's own anon-accessible read pattern.
 *
 * Returns ordered {id, similarity} pairs only — the frontend resolves full
 * LibraryBookRow objects via fetchBooksByIds() (services/library/catalog.ts)
 * rather than duplicating mapRawBookRow's field mapping in Deno.
 *
 * Requires OPENAI_API_KEY (same as every other AI-backed Library function).
 *
 * Input: JSON { query: string, limit?: number (default 20, max 50) }
 * Returns: JSON { ok, results: Array<{ id: string, similarity: number }> }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  query?: string;
  limit?: number;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  let body: RequestBody = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const query = (body.query ?? "").trim();
  if (!query) return json({ error: "query is required" }, 400, cors);
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, anonKey);

  try {
    const [embedding] = await createEmbedding([query.slice(0, 2000)]);
    const { data, error } = await client.rpc("match_library_books_semantic", {
      _query_embedding: embedding,
      _match_count: limit,
    });
    if (error) throw error;

    const results = (data ?? []).map((r: { book_id: string; similarity: number }) => ({ id: r.book_id, similarity: r.similarity }));
    return json({ ok: true, results }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-semantic-search error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
