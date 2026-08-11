// The only adapter that is live in Phase 1: Visionex's own catalogue.
//
// It reuses the existing semantic index (`ai_embeddings` + the
// `match_embeddings` RPC) rather than introducing a second retrieval path,
// and falls back to a plain text match when the query embeds poorly or the
// index has not been built for a table yet.

import { createClient } from "npm:@supabase/supabase-js@2";
import { createEmbedding } from "../aiProvider.ts";
import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  in_stock: boolean | null;
  store_type: string | null;
}

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function toRaw(row: ProductRow, confidence: number): RawResult {
  return {
    title: row.name,
    brand: null,
    model: null,
    category: row.category,
    specifications: row.description ? { summary: row.description } : {},
    condition: "new",
    // The catalogue price IS the Visionex price. Marking it as the source
    // price and letting the pricing engine add a margin would charge our own
    // customers twice, so the caller treats internal results as already priced.
    sourcePriceUsd: row.price ?? null,
    shippingUsd: 0,
    currency: "USD",
    sourceUrl: `/product/${row.id}`,
    sourceProductId: row.id,
    availability: row.in_stock === false ? "unavailable" : "in_visionex",
    confidence,
  };
}

async function semanticSearch(intent: SourcingIntent, limit: number): Promise<RawResult[]> {
  const db = service();
  const [vector] = await createEmbedding([intent.query.slice(0, 2000)]);

  const { data: matches, error } = await db.rpc("match_embeddings", {
    query_embedding: vector,
    match_count: Math.min(limit * 2, 24),
    filter_source: "products",
  });
  if (error) throw error;
  if (!matches?.length) return [];

  const ids = (matches as Array<{ source_id: string }>).map((match) => match.source_id);
  const { data: rows } = await db
    .from("products")
    .select("id, name, description, category, price, in_stock, store_type")
    .in("id", ids);

  const byId = new Map((rows ?? []).map((row) => [row.id, row as ProductRow]));

  return (matches as Array<{ source_id: string; similarity: number }>)
    .map((match) => {
      const row = byId.get(match.source_id);
      return row ? toRaw(row, Math.max(0, Math.min(1, match.similarity))) : null;
    })
    .filter((value): value is RawResult => value !== null)
    .slice(0, limit);
}

/**
 * Fallback when the index returns nothing. Uses the longest keyword rather
 * than the raw sentence: a short Arabic function word matches everything, a
 * problem this codebase has hit before in search.
 */
async function keywordSearch(intent: SourcingIntent, limit: number): Promise<RawResult[]> {
  const term = [...intent.keywords].sort((a, b) => b.length - a.length)[0];
  if (!term || term.length < 3) return [];

  const escaped = term.replace(/[%_,]/g, " ").trim();
  if (!escaped) return [];

  const { data } = await service()
    .from("products")
    .select("id, name, description, category, price, in_stock, store_type")
    .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
    .limit(limit);

  return (data ?? []).map((row) => toRaw(row as ProductRow, 0.35));
}

export const visionexCatalogAdapter: SourceAdapter = {
  slug: "visionex-catalog",

  async search(intent: SourcingIntent, _source: SourceRecord, limit: number): Promise<RawResult[]> {
    try {
      const semantic = await semanticSearch(intent, limit);
      if (semantic.length > 0) return semantic;
    } catch (error) {
      console.error("[sourcing] catalog semantic search failed, falling back:", error);
    }
    return keywordSearch(intent, limit);
  },
};
