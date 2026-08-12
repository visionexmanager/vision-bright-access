import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding, ProviderError } from "../_shared/aiProvider.ts";
import { handleSourceProducts } from "../_shared/sourcing/handler.ts";
import servicesCatalog from "../_shared/data/servicesCatalog.json" with { type: "json" };

// Columns returned for each source table.
const SELECT: Record<string, string> = {
  products: "id, name, description, category, store_type, price, points, image, rating, in_stock",
  content_items: "id, title, description, category, type, level, duration, points",
};

/**
 * Services are matched from the same `ai_embeddings` store but hydrated from
 * the committed catalogue snapshot rather than a table — they have no table,
 * by the approved decision to index the code catalogue instead of duplicating
 * it. Same retrieval, different hydration.
 */
const SERVICES_SOURCE = "services";

interface CatalogService {
  id: string;
  title_en: string;
  title_ar: string;
  hub: string;
  kind: string;
  path: string;
  difficulty: string;
  vx: number | null;
}

const SERVICES_BY_ID = new Map(
  (servicesCatalog as CatalogService[]).map((service) => [service.id, service]),
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Peek on a clone so the original body stays unread: the sourcing handler
    // parses the request itself, exactly as it did when it was its own
    // function, and a consumed stream would have left it with an empty body.
    const body = await req.clone().json().catch(() => ({}));

    // Two actions, named explicitly. Anything else is refused, and there is no
    // path from the parameter to an arbitrary handler.
    //
    // An absent action means "search", so every existing caller — which sends
    // { query, source, limit } and no action — behaves exactly as before.
    const action = typeof body.action === "string" ? body.action : "search";
    if (action === "source_products") {
      // Same auth posture (anon-callable), same embedding index, same
      // permitted-source gating. Only the entry point moved.
      return handleSourceProducts(req);
    }
    if (action !== "search") {
      return new Response(
        JSON.stringify({ error: `Unknown action '${action}'`, allowed: ["search", "source_products"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { query, source, limit = 8 } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let embedding: number[];
    try {
      const [vec] = await createEmbedding([query.slice(0, 2000)]);
      embedding = vec;
    } catch (e) {
      if (e instanceof ProviderError && e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: matches, error } = await service.rpc("match_embeddings", {
      query_embedding: embedding,
      match_count: Math.min(Math.max(Number(limit) || 8, 1), 24),
      filter_source: source ?? null,
    });
    if (error) throw error;

    // Hydrate matches with full source rows, preserving similarity order.
    const byTable: Record<string, string[]> = {};
    for (const m of matches ?? []) {
      (byTable[m.source_table] ??= []).push(m.source_id);
    }

    const rowsById: Record<string, Record<string, unknown>> = {};
    for (const [table, ids] of Object.entries(byTable)) {
      // Services come from the catalogue snapshot; everything else is a table.
      if (table === SERVICES_SOURCE) {
        for (const id of ids) {
          const entry = SERVICES_BY_ID.get(id);
          if (entry) rowsById[`${SERVICES_SOURCE}:${id}`] = entry as unknown as Record<string, unknown>;
        }
        continue;
      }
      const cols = SELECT[table];
      if (!cols) continue;
      const { data: rows } = await service.from(table).select(cols).in("id", ids);
      for (const r of rows ?? []) rowsById[`${table}:${(r as { id: string }).id}`] = r;
    }

    const results = (matches ?? [])
      .map((m: { source_table: string; source_id: string; similarity: number }) => {
        const row = rowsById[`${m.source_table}:${m.source_id}`];
        return row
          ? { source_table: m.source_table, id: m.source_id, similarity: m.similarity, item: row }
          : null;
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
