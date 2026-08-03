import { describe, expect, it } from "vitest";
import { calculateFeasibility, formatUsd } from "./feasibility";
import { SERVICE_CATALOG } from "./catalog";
import type { FeasibilityInput } from "./types";

const base: FeasibilityInput = {
  startupCostUsd: 10_000,
  monthlyCostUsd: 2_000,
  monthlyRevenueUsd: 4_000,
  rampUpMonths: 3,
  volatility: 2,
  revenueModel: { en: "Test", ar: "اختبار" },
  risks: { en: ["a", "b"], ar: ["أ", "ب"] },
};

describe("calculateFeasibility", () => {
  it("computes monthly profit and margin", () => {
    const r = calculateFeasibility(base);
    expect(r.monthlyProfitUsd).toBe(2_000);
    expect(r.marginPercent).toBe(50);
  });

  it("adds ramp-up losses to the cash requirement", () => {
    // Average ramp revenue is 2,000 against a 2,000 cost, so ramp is break-even.
    const r = calculateFeasibility(base);
    expect(r.rampLossUsd).toBe(0);
    expect(r.cashNeededUsd).toBe(10_000);

    // Halve revenue: ramp average is 1,000 against 2,000 cost = -1,000/month.
    const lean = calculateFeasibility({ ...base, monthlyRevenueUsd: 2_000 });
    expect(lean.rampLossUsd).toBe(3_000);
    expect(lean.cashNeededUsd).toBe(13_000);
  });

  it("reports payback in months including the ramp period", () => {
    const r = calculateFeasibility(base);
    // 3 ramp months + 10,000 / 2,000 = 8 months total.
    expect(r.paybackMonths).toBe(8);
  });

  it("returns null payback when the model never repays", () => {
    const r = calculateFeasibility({ ...base, monthlyRevenueUsd: 1_500 });
    expect(r.monthlyProfitUsd).toBeLessThan(0);
    expect(r.paybackMonths).toBeNull();
  });

  it("derives break-even revenue and safety margin", () => {
    const r = calculateFeasibility(base);
    expect(r.breakEvenRevenueUsd).toBe(2_000);
    // Revenue can fall 50% before hitting break-even.
    expect(r.safetyMarginPercent).toBe(50);
  });

  it("never reports a negative safety margin", () => {
    const r = calculateFeasibility({ ...base, monthlyRevenueUsd: 500 });
    expect(r.safetyMarginPercent).toBe(0);
  });

  it("includes startup cost in the first-year result", () => {
    const r = calculateFeasibility(base);
    // 9 full months at +2,000, 3 ramp months at 0, less 10,000 startup.
    expect(r.firstYearNetUsd).toBe(8_000);
  });

  it("escalates the risk band with volatility", () => {
    expect(calculateFeasibility({ ...base, volatility: 1 }).riskBand).toBe("low");
    expect(calculateFeasibility({ ...base, volatility: 5 }).riskBand).toBe("high");
  });

  it("escalates the risk band when the safety margin is thin", () => {
    const thin = calculateFeasibility({
      ...base,
      monthlyRevenueUsd: 2_200,
      volatility: 3,
    });
    expect(thin.safetyMarginPercent).toBeLessThan(15);
    expect(thin.riskBand).toBe("elevated");
  });

  it("keeps the resilience score inside 0–100", () => {
    for (const volatility of [1, 2, 3, 4, 5] as const) {
      for (const revenue of [600, 2_100, 4_000, 40_000]) {
        const r = calculateFeasibility({ ...base, volatility, monthlyRevenueUsd: revenue });
        expect(r.resilienceScore).toBeGreaterThanOrEqual(0);
        expect(r.resilienceScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it("produces a usable result for every catalog entry that ships feasibility data", () => {
    const withFeasibility = SERVICE_CATALOG.filter((e) => e.feasibility);
    expect(withFeasibility.length).toBeGreaterThan(0);

    for (const e of withFeasibility) {
      const r = calculateFeasibility(e.feasibility!);
      expect(r.cashNeededUsd, e.slug).toBeGreaterThan(0);
      expect(r.monthlyProfitUsd, `${e.slug} should model a viable business`).toBeGreaterThan(0);
      expect(r.paybackMonths, e.slug).not.toBeNull();
    }
  });
});

describe("formatUsd", () => {
  it("abbreviates large numbers and keeps small ones exact", () => {
    expect(formatUsd(950)).toBe("$950");
    expect(formatUsd(9_400)).toBe("$9,400");
    expect(formatUsd(24_000)).toBe("$24k");
    expect(formatUsd(1_500_000)).toBe("$1.5M");
  });

  it("keeps the sign on losses", () => {
    expect(formatUsd(-3_200)).toBe("-$3,200");
  });
});
