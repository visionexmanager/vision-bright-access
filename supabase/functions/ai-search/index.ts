import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding, ProviderError } from "../_shared/aiProvider.ts";

// Columns returned for each source table.
const SELECT: Record<string, string> = {
  products: "id, name, description, category, store_type, price, points, image, rating, in_stock",
  content_items: "id, title, description, category, type, level, duration, points",
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, source, limit = 8 } = await req.json().catch(() => ({}));

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
