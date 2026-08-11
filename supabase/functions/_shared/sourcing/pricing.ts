// Pricing engine.
//
// Margins live in `pricing_rules` and are read here. They are never put in an
// AI prompt and the model is never asked what something should cost — it only
// ever reports a number this function produced.

import type { ProductCondition } from "./types.ts";

export interface PricingRule {
  id: string;
  name: string;
  source_slug: string | null;
  category: string | null;
  condition: ProductCondition | null;
  margin_percent: number;
  margin_flat_usd: number;
  fees_percent: number;
  apply_to_used: boolean;
  round_to: number;
  active: boolean;
}

export interface PriceInput {
  sourcePriceUsd: number | null;
  shippingUsd?: number | null;
  condition: ProductCondition;
  category?: string | null;
  sourceSlug: string;
}

export interface PriceResult {
  finalPriceUsd: number | null;
  ruleId: string | null;
  breakdown: Record<string, number | string | null>;
}

/**
 * Most specific active rule wins: a rule naming the source beats one naming
 * only the category, which beats the catch-all. Ties break on the lowest id so
 * the choice is deterministic and reproducible in an audit.
 */
export function selectRule(
  rules: PricingRule[],
  input: Pick<PriceInput, "sourceSlug" | "category" | "condition">,
): PricingRule | null {
  const candidates = rules.filter(
    (rule) =>
      rule.active &&
      (rule.source_slug === null || rule.source_slug === input.sourceSlug) &&
      (rule.category === null || rule.category === input.category) &&
      (rule.condition === null || rule.condition === input.condition),
  );
  if (candidates.length === 0) return null;

  const specificity = (rule: PricingRule) =>
    (rule.source_slug ? 4 : 0) + (rule.category ? 2 : 0) + (rule.condition ? 1 : 0);

  return candidates.sort((a, b) => {
    const diff = specificity(b) - specificity(a);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  })[0];
}

function roundTo(value: number, step: number): number {
  if (!(step > 0)) return Math.round(value * 100) / 100;
  return Math.round(value / step) * step;
}

/**
 * source price + shipping + fees + margin, rounded.
 *
 * Two refusals are deliberate:
 *  - No source price means no final price. A missing number is reported as
 *    null so the caller says "price on request", never a guess.
 *  - A used listing gets no margin unless its rule explicitly opts in
 *    (`apply_to_used`). Visionex does not own that item, so marking it up by
 *    default would be inventing a transaction that has not been agreed.
 */
export function calculatePrice(input: PriceInput, rules: PricingRule[]): PriceResult {
  const shipping = Math.max(0, input.shippingUsd ?? 0);

  if (input.sourcePriceUsd === null || input.sourcePriceUsd === undefined || !(input.sourcePriceUsd >= 0)) {
    return {
      finalPriceUsd: null,
      ruleId: null,
      breakdown: { reason: "no_source_price" },
    };
  }

  const rule = selectRule(rules, input);
  const base = input.sourcePriceUsd + shipping;

  if (!rule) {
    return {
      finalPriceUsd: roundTo(base, 1),
      ruleId: null,
      breakdown: {
        source_price: input.sourcePriceUsd,
        shipping,
        fees: 0,
        margin: 0,
        reason: "no_matching_rule_pass_through",
      },
    };
  }

  const marginApplies = input.condition !== "used" || rule.apply_to_used;
  const fees = base * (rule.fees_percent / 100);
  const margin = marginApplies ? base * (rule.margin_percent / 100) + rule.margin_flat_usd : 0;
  const total = roundTo(base + fees + margin, rule.round_to);

  return {
    finalPriceUsd: total,
    ruleId: rule.id,
    breakdown: {
      source_price: input.sourcePriceUsd,
      shipping,
      fees: Math.round(fees * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      margin_applied: marginApplies ? "yes" : "skipped_used_listing",
      rule: rule.name,
      total,
    },
  };
}
