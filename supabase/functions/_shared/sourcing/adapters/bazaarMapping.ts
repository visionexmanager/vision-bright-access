// Pure half of the VXBazaar adapter.
//
// The seller side of Visionex writes to `bazaar_products`; the buyer side asks
// the Commerce Agent. Until this file existed those two halves never met: a
// shop could list a thing and the agent searching "Visionex first" would look
// only at `products` and answer "nothing found" about stock sitting on our own
// shelves.
//
// Everything here is free of `Deno` and of a database client so the suite can
// pin the parts that decide what a customer sees: which listings are searched
// for, how a VX-only price becomes a number, and how confident a match is.

import type { RawResult } from "../types.ts";

/** The rate the storefront, the wallet and the checkout all already use. */
export const VX_PER_USD = 1000;

/** How many listings to pull before ranking narrows them to `limit`. */
export const BAZAAR_FETCH_LIMIT = 40;

export interface BazaarShopRef {
  name: string | null;
  is_active: boolean | null;
  vacation_mode: boolean | null;
}

export interface BazaarProductRow {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  category: string | null;
  product_type: string | null;
  price: number | null;
  price_vx: number | null;
  price_usd: number | null;
  accepts_vx: boolean | null;
  accepts_cash: boolean | null;
  in_stock: boolean | null;
  stock_qty: number | null;
  shipping_cost: number | null;
  shipping_from: string | null;
  delivery_time: string | null;
  is_accessible: boolean | null;
  bazaar_shops: BazaarShopRef | BazaarShopRef[] | null;
}

/**
 * A PostgREST `or=` filter over the caller's keywords.
 *
 * Terms are stripped to letters, digits and spaces before they are
 * interpolated, which is what makes the interpolation safe: a comma, a quote
 * or a parenthesis cannot survive that far and so cannot reshape the filter.
 * Short words are dropped for the reason this codebase has hit before — a
 * two-letter Arabic function word matches every row in the table.
 */
export function bazaarFilter(keywords: string[]): string | null {
  const terms = [...new Set(keywords.map(sanitizeTerm).filter((term) => term.length >= 3))].slice(0, 6);
  if (terms.length === 0) return null;

  return terms
    .flatMap((term) => [`name.ilike.%${term}%`, `description.ilike.%${term}%`])
    .join(",");
}

function sanitizeTerm(term: string): string {
  return term
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .trim()
    .slice(0, 40);
}

/** True when the listing is on a shop that is open for business right now. */
export function isSellable(row: BazaarProductRow): boolean {
  const shop = Array.isArray(row.bazaar_shops) ? row.bazaar_shops[0] : row.bazaar_shops;
  if (!shop || shop.is_active === false || shop.vacation_mode === true) return false;
  if (row.in_stock === false) return false;
  return (row.stock_qty ?? 1) > 0;
}

export function shopName(row: BazaarProductRow): string | null {
  const shop = Array.isArray(row.bazaar_shops) ? row.bazaar_shops[0] : row.bazaar_shops;
  return shop?.name ?? null;
}

/**
 * A listing's price in USD.
 *
 * A seller may price in cash, in VX, or in both. Cash is taken literally. A
 * VX-only listing is converted at the platform rate rather than reported as
 * "price on request", because the number is not an estimate: it is what the
 * buyer's wallet will actually be charged. A listing with neither returns
 * null, and the pricing engine then says "price on request" instead of
 * guessing.
 */
export function bazaarPriceUsd(row: BazaarProductRow): number | null {
  if (row.accepts_cash && typeof row.price_usd === "number" && row.price_usd > 0) {
    return Math.round(row.price_usd * 100) / 100;
  }

  const vx = row.price_vx ?? (row.accepts_vx === false ? null : row.price);
  if (typeof vx === "number" && vx > 0) {
    return Math.round((vx / VX_PER_USD) * 100) / 100;
  }
  return null;
}

/**
 * How well a listing answers the request: the share of the caller's keywords
 * that appear in its name or description, with a name hit worth more than a
 * description hit. Bounded to a range that keeps a keyword match below a
 * genuine semantic catalogue hit, so an exact catalogue product still outranks
 * a listing that merely shares a word.
 */
export function bazaarConfidence(row: BazaarProductRow, keywords: string[]): number {
  if (keywords.length === 0) return 0.4;

  const name = row.name.toLowerCase();
  const description = (row.description ?? "").toLowerCase();

  let hits = 0;
  for (const keyword of keywords) {
    const term = keyword.toLowerCase();
    if (name.includes(term)) hits += 1;
    else if (description.includes(term)) hits += 0.5;
  }

  const share = Math.min(1, hits / keywords.length);
  return Math.round((0.4 + share * 0.5) * 100) / 100;
}

/**
 * A listing, in the shape every other source is reduced to.
 *
 * `in_visionex` is the honest label and the strongest one the vocabulary has:
 * this is not a supplier we could reach, it is stock a Visionex shop has
 * listed, and the buyer can pay for it without leaving the site.
 */
export function bazaarRowToRaw(row: BazaarProductRow, keywords: string[]): RawResult {
  const shop = shopName(row);

  return {
    title: row.name,
    // The shop is not the brand. It is named in `specifications`, where it
    // reads as what it is rather than as a manufacturer.
    brand: null,
    model: null,
    category: row.category ?? null,
    specifications: {
      ...(row.description ? { summary: row.description } : {}),
      ...(shop ? { shop } : {}),
      ...(row.product_type ? { type: row.product_type } : {}),
      ...(row.delivery_time ? { delivery: row.delivery_time } : {}),
      ...(row.shipping_from ? { ships_from: row.shipping_from } : {}),
      ...(row.is_accessible ? { accessible: "yes" } : {}),
    },
    condition: "new",
    sourcePriceUsd: bazaarPriceUsd(row),
    shippingUsd: Math.max(0, row.shipping_cost ?? 0),
    currency: "USD",
    sourceUrl: "/bazaar",
    sourceProductId: row.id,
    availability: "in_visionex",
    confidence: bazaarConfidence(row, keywords),
  };
}
