// Pure half of the eBay Browse adapter: query building and item normalization.
//
// Kept free of `Deno` and of fetch so the suite can pin the two things that
// decide whether a customer is told the truth — which listings we ask for, and
// how a listing's own words become a condition and a price. The network call
// is in `ebayBrowse.ts`.

import type { ProductCondition, RawResult, SourcingIntent } from "../types.ts";

export const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
export const EBAY_OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
export const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

/** Marketplace to ask. Chosen for one reason: it quotes prices in USD. */
export const EBAY_MARKETPLACE = "EBAY_US";
export const EBAY_CURRENCY = "USD";

/**
 * eBay condition IDs, grouped into the three conditions this system speaks.
 *
 * Everything eBay calls "for parts or not working" (7000) is deliberately
 * absent: it is not a fourth condition, it is a thing a buyer asking for a
 * laptop does not want, and the filter below never requests it.
 */
const CONDITION_IDS: Record<ProductCondition, string[]> = {
  new: ["1000", "1500", "1750"],
  refurbished: ["2000", "2010", "2020", "2030", "2500"],
  used: ["3000", "4000", "5000", "6000"],
};

/** Map an item's `conditionId` — or its wording, when the id is missing. */
export function ebayCondition(conditionId?: string | null, condition?: string | null): ProductCondition {
  const id = (conditionId ?? "").trim();
  for (const [name, ids] of Object.entries(CONDITION_IDS)) {
    if (ids.includes(id)) return name as ProductCondition;
  }

  const text = (condition ?? "").toLowerCase();
  if (/refurb|renewed|certified/.test(text)) return "refurbished";
  if (/used|pre-?owned|open box|seller refurbished/.test(text)) return "used";
  if (/new/.test(text)) return "new";

  // An unrecognised listing is called used, never new: guessing "new" would
  // put a second-hand item into the group the spec keeps for new stock.
  return "used";
}

/** The `conditionIds` filter for what the customer asked for. */
export function ebayConditionFilter(condition: SourcingIntent["condition"]): string[] {
  if (condition === "all") {
    return [...CONDITION_IDS.new, ...CONDITION_IDS.refurbished, ...CONDITION_IDS.used];
  }
  return CONDITION_IDS[condition];
}

export interface BrowseQuery {
  q: string;
  filter: string;
  limit: number;
}

/**
 * Build the Browse request.
 *
 * The keywords are used rather than the raw sentence: "بدي لابتوب تحت 500
 * دولار" sent verbatim returns nothing, while its keywords return laptops.
 * Budget, when the customer gave one, is pushed down to eBay instead of being
 * filtered locally, so the results that come back are ones they can afford.
 */
export function buildBrowseQuery(intent: SourcingIntent, limit: number): BrowseQuery | null {
  const q = intent.keywords.join(" ").trim() || intent.query.trim();
  if (q.length < 2) return null;

  const filters = [
    `conditionIds:{${ebayConditionFilter(intent.condition).join("|")}}`,
    "buyingOptions:{FIXED_PRICE}",
  ];

  const min = intent.minPriceUsd;
  const max = intent.maxPriceUsd;
  if (min !== null && max !== null) filters.push(`price:[${min}..${max}]`);
  else if (max !== null) filters.push(`price:[..${max}]`);
  else if (min !== null) filters.push(`price:[${min}..]`);
  if (min !== null || max !== null) filters.push(`priceCurrency:${EBAY_CURRENCY}`);

  return {
    q: q.slice(0, 100),
    filter: filters.join(","),
    limit: Math.max(1, Math.min(50, limit)),
  };
}

export interface EbayItemSummary {
  itemId?: string;
  title?: string;
  condition?: string;
  conditionId?: string;
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  categories?: Array<{ categoryName?: string }>;
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
  seller?: { username?: string; feedbackPercentage?: string };
}

function money(value?: string | null, currency?: string | null): number | null {
  if (currency && currency !== EBAY_CURRENCY) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * One listing, normalized — or null when it cannot be reported honestly.
 *
 * A listing with no title, no USD price or no link is dropped rather than
 * shown with a blank where the number should be. `external_recommendation` is
 * the availability the vocabulary reserves for exactly this: we can point at
 * it, we are not selling it.
 */
export function ebayItemToRaw(item: EbayItemSummary, fallbackCategory: string | null): RawResult | null {
  const title = item.title?.trim();
  const url = item.itemWebUrl?.trim();
  const price = money(item.price?.value, item.price?.currency);
  if (!title || !url || price === null) return null;

  const shipping = money(
    item.shippingOptions?.[0]?.shippingCost?.value,
    item.shippingOptions?.[0]?.shippingCost?.currency,
  );

  return {
    title,
    brand: null,
    model: null,
    category: item.categories?.[0]?.categoryName ?? fallbackCategory,
    specifications: {
      ...(item.seller?.feedbackPercentage ? { seller_feedback: `${item.seller.feedbackPercentage}%` } : {}),
    },
    condition: ebayCondition(item.conditionId, item.condition),
    sourcePriceUsd: price,
    shippingUsd: shipping ?? 0,
    currency: EBAY_CURRENCY,
    sourceUrl: url,
    sourceProductId: item.itemId ?? null,
    availability: "external_recommendation",
    // A marketplace search is a keyword match, not a semantic one. Below the
    // catalogue's own confident hits by construction, so Visionex stock keeps
    // its place at the top of the list.
    confidence: 0.45,
  };
}
