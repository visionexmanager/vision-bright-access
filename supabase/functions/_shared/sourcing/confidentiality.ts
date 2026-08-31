// Spec §8: Visionex is the customer's shopping interface, so the supplier is
// not named in customer-facing output.
//
// The rule has a hard limit, and it is encoded here rather than left to a
// prompt: when a source's agreement requires attribution — most affiliate
// programmes do — the merchant IS named. Confidentiality never becomes a
// reason to breach a vendor's terms.

import type { NormalizedResult } from "./types.ts";

/** Exactly what a customer may see. Anything not listed here stays internal. */
export interface CustomerFacingResult {
  ref: string;
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  specifications: Record<string, unknown>;
  condition: "new" | "used" | "refurbished";
  availability: NormalizedResult["availability"];
  priceUsd: number | null;
  /**
   * Shown instead of a price when only a range is known. Deliberately on the
   * allow-list: it is information about what a thing costs, which is what the
   * customer asked, and it says nothing about who would supply it.
   */
  priceRangeUsd?: { min: number; max: number };
  currency: string;
  /** Present only when the source's terms require naming it. */
  sourceName?: string;
  sourceUrl?: string;
}

/**
 * Strip a normalized result down to the customer-facing shape.
 *
 * Written as an allow-list, not a delete-list: a field added to
 * NormalizedResult later is invisible to customers until someone deliberately
 * adds it here. A delete-list would leak every new internal field by default.
 */
export function projectForCustomer(
  result: NormalizedResult,
  ref: string,
): CustomerFacingResult {
  const projected: CustomerFacingResult = {
    ref,
    title: result.title,
    brand: result.brand,
    model: result.model,
    category: result.category,
    specifications: result.specifications,
    condition: result.condition,
    availability: result.availability,
    priceUsd: result.finalPriceUsd,
    currency: result.currency,
  };

  if (result.priceRangeUsd) projected.priceRangeUsd = result.priceRangeUsd;

  if (result.attributionRequired) {
    projected.sourceName = result.sourceName;
    if (result.sourceUrl) projected.sourceUrl = result.sourceUrl;
  }

  return projected;
}

/** Field names that must never appear in customer-facing output. */
export const INTERNAL_ONLY_FIELDS = [
  "sourceSlug",
  "sourcePriceUsd",
  "shippingUsd",
  "pricingRuleId",
  "pricingBreakdown",
  "sourceProductId",
  "confidence",
] as const;

/**
 * Availability wording. The spec is explicit that a marketplace listing must
 * not be described as Visionex stock, so each state gets its own sentence and
 * none of them claims ownership except `in_visionex`.
 */
export function availabilityLabel(
  availability: NormalizedResult["availability"],
  language: "en" | "ar",
): string {
  const labels = {
    in_visionex: {
      en: "Available in Visionex",
      ar: "متوفر في Visionex",
    },
    available_for_sourcing: {
      en: "Available for sourcing",
      ar: "متاح للتوريد",
    },
    external_recommendation: {
      en: "External recommendation",
      ar: "توصية خارجية",
    },
    requires_sourcing_confirmation: {
      en: "Requires sourcing confirmation",
      ar: "يحتاج تأكيد التوريد",
    },
    unavailable: {
      en: "Unavailable",
      ar: "غير متوفر",
    },
  } as const;

  return labels[availability][language];
}
