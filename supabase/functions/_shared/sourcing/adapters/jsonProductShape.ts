// Reading products out of somebody else's JSON.
//
// Two sources need the same thing and must not each invent it: a gateway
// response and a supplier feed are both a document with a list of products
// somewhere inside it and field names nobody here chose. The path and the
// names live on the source's row; this file is what walks them.
//
// Pure — no `Deno`, no fetch, no npm.

import type { Availability, ProductCondition, RawResult, SourceRecord, SourcingIntent } from "../types.ts";

/** Where the products are, and what the fields are called. */
export interface JsonFieldMap {
  /** Dotted path from the document root to the array of products. */
  resultPath: string;
  title: string;
  price: string;
  currency?: string;
  url?: string;
  id?: string;
  brand?: string;
  category?: string;
  image?: string;
  shipping?: string;
  condition?: string;
}

/** Walk a dotted path, tolerating a single object where a list is documented. */
export function pluckList(body: unknown, path: string): Record<string, unknown>[] {
  let node: unknown = body;
  for (const segment of path.split(".")) {
    if (node === null || typeof node !== "object") return [];
    node = (node as Record<string, unknown>)[segment];
  }
  const items = Array.isArray(node) ? node : node && typeof node === "object" ? [node] : [];
  return items.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}

/** Read one field as trimmed text, or null when it is absent or empty. */
export function readField(item: Record<string, unknown>, name: string | undefined): string | null {
  if (!name) return null;
  const value = item[name];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * A price, from text that may be a plain number, a formatted amount, or a
 * wholesale range. The low end of a range is taken because it is the figure a
 * supplier honours at small quantity, which is the quantity we buy at.
 */
export function readPrice(text: string | null): number | null {
  if (!text) return null;
  const first = text.split(/[-~]/)[0].replace(/[^\d.]/g, "");
  const value = Number(first);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function readCondition(text: string | null): ProductCondition {
  const value = (text ?? "").toLowerCase();
  if (/refurb|renewed|certified/.test(value)) return "refurbished";
  if (/used|pre-?owned|second/.test(value)) return "used";
  return "new";
}

export interface JsonMapOptions {
  fallbackCategory: string | null;
  availability: Availability;
  confidence: number;
  /** Default when the document does not say; these sources sell new stock. */
  defaultCondition?: ProductCondition;
}

/**
 * One product, normalized — or null when it cannot be reported honestly.
 *
 * Three refusals, all deliberate: no title, no usable price, or a price quoted
 * in something other than dollars. Each of them would otherwise reach the
 * customer as a row with a gap where the number belongs, and the number is the
 * whole point of the question they asked.
 */
export function jsonItemToRaw(
  item: Record<string, unknown>,
  fields: JsonFieldMap,
  options: JsonMapOptions,
): RawResult | null {
  const title = readField(item, fields.title);
  const price = readPrice(readField(item, fields.price));
  if (!title || price === null) return null;

  const currency = (readField(item, fields.currency) ?? "USD").toUpperCase();
  if (currency !== "USD") return null;

  const shipping = readPrice(readField(item, fields.shipping)) ?? 0;
  const image = readField(item, fields.image);

  return {
    title,
    brand: readField(item, fields.brand),
    model: null,
    category: readField(item, fields.category) ?? options.fallbackCategory,
    specifications: image ? { image } : {},
    condition: fields.condition
      ? readCondition(readField(item, fields.condition))
      : options.defaultCondition ?? "new",
    sourcePriceUsd: price,
    shippingUsd: shipping,
    currency: "USD",
    sourceUrl: readField(item, fields.url),
    sourceProductId: readField(item, fields.id),
    availability: options.availability,
    confidence: options.confidence,
  };
}

/**
 * Does a product from a feed answer the request?
 *
 * A gateway filters server-side; a feed is a file, so the filtering happens
 * here. A product must match at least one keyword — the whole feed is not an
 * answer to "braille display" — and must sit inside a stated budget, because a
 * customer who said "under $400" did not ask to be shown a $900 option.
 */
export function matchesIntent(result: RawResult, intent: SourcingIntent): boolean {
  const price = result.sourcePriceUsd;
  if (intent.maxPriceUsd !== null && price !== null && price !== undefined && price > intent.maxPriceUsd) return false;
  if (intent.minPriceUsd !== null && price !== null && price !== undefined && price < intent.minPriceUsd) return false;

  if (intent.keywords.length === 0) return true;

  const haystack = `${result.title} ${result.brand ?? ""} ${result.category ?? ""}`.toLowerCase();
  return intent.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

/** How well a feed product matches: the share of keywords it contains. */
export function feedConfidence(result: RawResult, intent: SourcingIntent): number {
  if (intent.keywords.length === 0) return 0.35;
  const haystack = `${result.title} ${result.brand ?? ""} ${result.category ?? ""}`.toLowerCase();
  const hits = intent.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  return Math.round((0.3 + (hits / intent.keywords.length) * 0.3) * 100) / 100;
}

/**
 * The field map a feed row carries, or null when the row is not usable.
 *
 * A title and a price are the minimum: without either, nothing that comes out
 * of the feed can be shown to anybody. `resultPath` defaults to `products`,
 * which is what most feeds call the array.
 */
export function feedFieldMap(source: SourceRecord): JsonFieldMap | null {
  const configured = source.config?.fields;
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) return null;

  const candidate = configured as Partial<JsonFieldMap>;
  if (!candidate.title || !candidate.price) return null;

  return { resultPath: "products", ...candidate } as JsonFieldMap;
}
