// VXBazaar listings, as a source the Commerce Agent can search.
//
// `visionex-catalog` reads `products`, the curated catalogue. This reads
// `bazaar_products`, what shops on Visionex have actually put up for sale.
// Both are `internal`, so neither is marked up and both rank ahead of anyone
// outside — but they answer different questions, and a buyer asking the AI
// for something a shop is selling should be told about it.
//
// The decisions live in `bazaarMapping.ts` and are tested there. What is here
// is the query.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import {
  BAZAAR_FETCH_LIMIT,
  bazaarConfidence,
  bazaarFilter,
  bazaarRowToRaw,
  isSellable,
  type BazaarProductRow,
} from "./bazaarMapping.ts";

const COLUMNS =
  "id, shop_id, name, description, category, product_type, price, price_vx, price_usd, " +
  "accepts_vx, accepts_cash, in_stock, stock_qty, shipping_cost, shipping_from, delivery_time, " +
  "is_accessible, bazaar_shops!inner(name, is_active, vacation_mode)";

export const bazaarListingsAdapter: SourceAdapter = {
  slug: "visionex-bazaar",

  async search(intent: SourcingIntent, _source: SourceRecord, limit: number): Promise<RawResult[]> {
    const filter = bazaarFilter(intent.keywords);
    if (!filter) return [];

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The shop filter is applied at the database as well as in `isSellable`:
    // the join keeps the result set small, and the predicate is what the test
    // can pin. A shop that closes between the two is caught by the second.
    const { data, error } = await db
      .from("bazaar_products")
      .select(COLUMNS)
      .or(filter)
      .eq("in_stock", true)
      .eq("bazaar_shops.is_active", true)
      .limit(BAZAAR_FETCH_LIMIT);

    if (error) {
      console.error("[sourcing] bazaar listing search failed:", error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as BazaarProductRow[];

    return rows
      .filter(isSellable)
      .sort((a, b) => bazaarConfidence(b, intent.keywords) - bazaarConfidence(a, intent.keywords))
      .slice(0, limit)
      .map((row) => bazaarRowToRaw(row, intent.keywords));
  },
};
