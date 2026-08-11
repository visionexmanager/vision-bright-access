// Shared vocabulary for the AI Commerce Agent.
//
// One normalized shape every adapter must produce, so the router, the pricing
// engine and the customer-facing projection never need to know which vendor a
// result came from.

export type ProductCondition = "new" | "used" | "refurbished";
export type ConditionFilter = ProductCondition | "all";

/**
 * What Visionex can actually promise about an item. Deliberately explicit:
 * "we have it" and "we could get it" and "someone else sells it" are different
 * promises, and the spec forbids blurring them.
 */
export type Availability =
  | "in_visionex"                    // real Visionex stock or catalogue entry
  | "available_for_sourcing"         // a verified supplier route exists
  | "external_recommendation"        // we can point at it, we are not selling it
  | "requires_sourcing_confirmation" // plausible, but a human must confirm
  | "unavailable";

export type AccessMethod =
  | "internal"
  | "official_api"
  | "product_feed"
  | "affiliate_api"
  | "permitted_search"
  | "none";

export interface SourceRecord {
  slug: string;
  name: string;
  access_method: AccessMethod;
  status: "active" | "disabled" | "unverified";
  categories: string[];
  conditions: ProductCondition[];
  priority: number;
  health_score: number;
  api_key_ref: string | null;
  base_url: string | null;
  config: Record<string, unknown>;
  commercial_reuse_allowed: boolean;
  /** When true the merchant must be named; §8 confidentiality does not apply. */
  attribution_required: boolean;
  rate_limit_per_hour: number | null;
}

/** What an adapter returns. Prices are the source's, before any Visionex margin. */
export interface RawResult {
  title: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  specifications?: Record<string, unknown>;
  condition?: ProductCondition;
  sourcePriceUsd?: number | null;
  shippingUsd?: number | null;
  currency?: string;
  sourceUrl?: string | null;
  sourceProductId?: string | null;
  availability?: Availability;
  /** 0–1. How well the adapter believes this matches the request. */
  confidence?: number;
}

/** A RawResult after normalization, de-duplication and pricing. */
export interface NormalizedResult {
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  specifications: Record<string, unknown>;
  condition: ProductCondition;
  availability: Availability;
  currency: string;

  finalPriceUsd: number | null;

  // Internal. Never reaches a customer unless attribution is required.
  sourceSlug: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceProductId: string | null;
  sourcePriceUsd: number | null;
  shippingUsd: number;
  pricingRuleId: string | null;
  pricingBreakdown: Record<string, number | string | null>;
  attributionRequired: boolean;
  confidence: number;
  retrievedAt: string;
}

/** Parsed from what the customer said; drives which sources are asked. */
export interface SourcingIntent {
  query: string;
  category: string | null;
  condition: ConditionFilter;
  maxPriceUsd: number | null;
  minPriceUsd: number | null;
  brand: string | null;
  keywords: string[];
  /** True when the wording points at blindness / low-vision equipment. */
  assistive: boolean;
}

export interface SourceAdapter {
  slug: string;
  /**
   * Adapters must resolve rather than throw: one unreachable vendor should
   * degrade the result set, not fail the customer's request.
   */
  search(intent: SourcingIntent, source: SourceRecord, limit: number): Promise<RawResult[]>;
}

/** Spec §3: about ten results when there are genuinely that many. */
export const TARGET_RESULT_COUNT = 10;
