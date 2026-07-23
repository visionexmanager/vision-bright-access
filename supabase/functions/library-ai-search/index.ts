/**
 * library-ai-search — the "AI Semantic Search" layer on top of the existing
 * match_library_books_semantic()/match_library_kg_entities_semantic() RPCs:
 * classifies query intent, expands synonyms/related terms, and returns both
 * book and knowledge-graph-entity matches from ONE call instead of the
 * caller stitching together library-semantic-search + a separate entity
 * search. Public like library-semantic-search (book/entity metadata isn't
 * content-gated) — the AI intent/synonym step and search-history logging
 * only run when the caller is authenticated, so anonymous users still get
 * a working (if less enriched) plain semantic search rather than a 401.
 *
 * Input: JSON { query: string, limit?: number (default 10, max 30) }
 * Returns: JSON {
 *   ok, intent: "book_search"|"question"|"entity_lookup"|null,
 *   synonyms: string[],
 *   books: Array<{ id, similarity }>, entities: Array<{ id, similarity }>
 * }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding, structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  query?: string;
  limit?: number;
}

const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["book_search", "question", "entity_lookup"] },
    synonyms: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: ["intent", "synonyms"],
  additionalProperties: false,
};

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
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 30);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, anonKey);

  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  if (authHeader) {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  }

  try {
    const [embedding] = await createEmbedding([query.slice(0, 2000)]);

    const [{ data: bookMatches, error: bookErr }, { data: entityMatches, error: entityErr }] = await Promise.all([
      client.rpc("match_library_books_semantic", { _query_embedding: embedding, _match_count: limit }),
      client.rpc("match_library_kg_entities_semantic", { _query_embedding: embedding, _match_count: limit }),
    ]);
    if (bookErr) throw bookErr;
    if (entityErr) throw entityErr;

    const books = (bookMatches ?? []).map((r: { book_id: string; similarity: number }) => ({ id: r.book_id, similarity: r.similarity }));
    const entities = (entityMatches ?? []).map((r: { entity_id: string; similarity: number }) => ({ id: r.entity_id, similarity: r.similarity }));

    let intent: string | null = null;
    let synonyms: string[] = [];

    if (userId) {
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: userId, _function_name: "library-ai-search" });

      if (allowed !== false) {
        try {
          const result = await structuredCompletion({
            provider: "openai",
            model: "gpt-4o-mini",
            system: "Classify the search intent of a library search query: 'book_search' (looking for a book/topic), 'question' (a natural-language question expecting an answer), or 'entity_lookup' (looking up a specific person/place/concept/technology). Also suggest up to 5 synonyms or closely related search terms.",
            userText: query,
            schema: INTENT_SCHEMA,
            toolName: "classify_search_intent",
            maxTokens: 200,
          }) as { intent: string; synonyms: string[] };
          intent = result.intent;
          synonyms = result.synonyms ?? [];
        } catch (aiErr) {
          console.error("library-ai-search intent classification failed (non-fatal):", aiErr);
        }
      }

      await client.from("library_search_history").insert({
        user_id: userId, query, results_count: books.length + entities.length,
      }).then(() => {}, () => {});
    }

    return json({ ok: true, intent, synonyms, books, entities }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-ai-search error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
