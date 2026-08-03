import type { FeasibilityInput } from "./types";

/**
 * Turns the catalog's feasibility inputs into the numbers an aspiring owner
 * actually asks for: what do I need up front, when do I stop losing money, and
 * how badly can this go wrong.
 *
 * These are deterministic arithmetic models, not forecasts. Every surface that
 * renders them must show the estimate disclaimer — see `FEASIBILITY_DISCLAIMER`.
 */

export type RiskBand = "low" | "moderate" | "elevated" | "high";

export interface FeasibilityResult {
  /** Profit per month once the business is running at the modelled level. */
  monthlyProfitUsd: number;
  /** Gross margin as a percentage of revenue, 0–100. Negative if loss-making. */
  marginPercent: number;
  /**
   * Total cash needed before the business funds itself: startup capital plus
   * the operating losses accumulated during ramp-up.
   */
  cashNeededUsd: number;
  /** Losses accumulated while revenue ramps from zero to the modelled level. */
  rampLossUsd: number;
  /**
   * Months from day one until cumulative profit repays `cashNeededUsd`.
   * `null` when the model never repays (non-positive monthly profit).
   */
  paybackMonths: number | null;
  /** Revenue level at which the business covers its monthly costs. */
  breakEvenRevenueUsd: number;
  /** How far revenue can fall before the business runs at a loss, 0–100. */
  safetyMarginPercent: number;
  /** First-year profit or loss including the ramp period. */
  firstYearNetUsd: number;
  riskBand: RiskBand;
  /** 0–100 confidence-style score for the UI meter. Higher is more resilient. */
  resilienceScore: number;
}

export const FEASIBILITY_DISCLAIMER = {
  en: "Planning estimate only — replace every figure with quotes from your own market before you commit money.",
  ar: "تقدير تخطيطي فقط — استبدل كل رقم بعروض أسعار من سوقك الحقيقي قبل أن تلتزم بأي مبلغ.",
};

const round = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Ramp-up is modelled as a straight line from zero to full revenue across
 * `rampUpMonths`, so the average revenue during ramp is half the target while
 * costs run at full rate from month one — the shape most small ventures hit.
 */
function rampLoss(input: FeasibilityInput): number {
  const averageRampRevenue = input.monthlyRevenueUsd / 2;
  const monthlyRampProfit = averageRampRevenue - input.monthlyCostUsd;
  if (monthlyRampProfit >= 0) return 0;
  return Math.abs(monthlyRampProfit) * input.rampUpMonths;
}

function riskBandFor(volatility: number, safetyMarginPercent: number): RiskBand {
  // Volatility sets the floor; a thin safety margin can push the band up.
  const thin = safetyMarginPercent < 15;
  const comfortable = safetyMarginPercent >= 35;

  if (volatility >= 5 || (volatility >= 4 && thin)) return "high";
  if (volatility >= 4 || (volatility >= 3 && thin)) return "elevated";
  if (volatility >= 3 && !comfortable) return "moderate";
  if (volatility >= 2 && thin) return "moderate";
  return volatility <= 2 ? "low" : "moderate";
}

export function calculateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const monthlyProfitUsd = input.monthlyRevenueUsd - input.monthlyCostUsd;

  const marginPercent =
    input.monthlyRevenueUsd > 0 ? (monthlyProfitUsd / input.monthlyRevenueUsd) * 100 : 0;

  const rampLossUsd = rampLoss(input);
  const cashNeededUsd = input.startupCostUsd + rampLossUsd;

  // Break-even revenue is simply the point where revenue covers monthly cost.
  const breakEvenRevenueUsd = input.monthlyCostUsd;

  const safetyMarginPercent =
    input.monthlyRevenueUsd > 0
      ? Math.max(
          0,
          ((input.monthlyRevenueUsd - breakEvenRevenueUsd) / input.monthlyRevenueUsd) * 100
        )
      : 0;

  const paybackMonths =
    monthlyProfitUsd > 0 ? input.rampUpMonths + cashNeededUsd / monthlyProfitUsd : null;

  // Year one: ramp months at the reduced rate, remaining months at full rate.
  const fullMonths = Math.max(0, 12 - input.rampUpMonths);
  const rampMonths = Math.min(12, input.rampUpMonths);
  const firstYearNetUsd =
    monthlyProfitUsd * fullMonths +
    (input.monthlyRevenueUsd / 2 - input.monthlyCostUsd) * rampMonths -
    input.startupCostUsd;

  const riskBand = riskBandFor(input.volatility, safetyMarginPercent);

  // Resilience rewards a fat safety margin and punishes volatility and a long
  // payback. Clamped so the meter always renders something sensible.
  const paybackPenalty = paybackMonths === null ? 40 : Math.min(30, paybackMonths * 1.2);
  const resilienceScore = Math.max(
    0,
    Math.min(
      100,
      round(safetyMarginPercent * 1.1 + (5 - input.volatility) * 10 - paybackPenalty + 20)
    )
  );

  return {
    monthlyProfitUsd: round(monthlyProfitUsd),
    marginPercent: round1(marginPercent),
    cashNeededUsd: round(cashNeededUsd),
    rampLossUsd: round(rampLossUsd),
    paybackMonths: paybackMonths === null ? null : round1(paybackMonths),
    breakEvenRevenueUsd: round(breakEvenRevenueUsd),
    safetyMarginPercent: round1(safetyMarginPercent),
    firstYearNetUsd: round(firstYearNetUsd),
    riskBand,
    resilienceScore,
  };
}

export const RISK_BAND_LABEL: Record<RiskBand, { en: string; ar: string }> = {
  low: { en: "Low risk", ar: "مخاطرة منخفضة" },
  moderate: { en: "Moderate risk", ar: "مخاطرة متوسطة" },
  elevated: { en: "Elevated risk", ar: "مخاطرة مرتفعة" },
  high: { en: "High risk", ar: "مخاطرة عالية" },
};

export const RISK_BAND_CLASS: Record<RiskBand, string> = {
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  elevated: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
};

/** Formats USD without pretending to more precision than the model has. */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}
