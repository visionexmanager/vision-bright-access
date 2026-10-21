import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAID_PLANS } from "@/lib/billing/plans";
import {
  breakEvenSubscribers, costPer1000Vx, evaluatePlan, fixedCostAt, fullAllowanceCost,
  maxHeavyShare, maxSustainableCostPer1000Vx, netRevenue, projectBusiness, variableCost,
  type Assumptions,
} from "@/lib/finance/profitability";

const raw = readFileSync(resolve(process.cwd(), "docs/finance/profitability-assumptions.json"), "utf8");
const base = JSON.parse(raw) as Assumptions;
const clone = (): Assumptions => JSON.parse(raw) as Assumptions;

describe("assumptions file", () => {
  it("never restates a plan price or monthly VX (plans.ts is the only source)", () => {
    expect(raw).not.toMatch(/price_monthly|vx_credits_monthly|"price"\s*:/);
    const keys = Object.keys(JSON.parse(raw));
    expect(keys).not.toContain("plans");
  });

  it("labels every unit cost with a basis", () => {
    for (const [k, v] of Object.entries(base.unit_costs)) expect(v.basis, k).toBeTruthy();
  });

  it("holds no secret-looking value", () => {
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}|@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

describe("netRevenue", () => {
  it("is zero for a free plan, with no fee charged on nothing", () => {
    expect(netRevenue(base, 0)).toEqual({ net: 0, fees: 0, refunds: 0 });
  });

  it("deducts the blended card/OMT/Whish fee once", () => {
    const r = netRevenue(base, 10);
    // only the card share (25%) carries a fee: 0.25 * (0.029 * 10 + 0.30)
    expect(r.fees).toBeCloseTo(0.25 * (0.029 * 10 + 0.3), 10);
    expect(r.net).toBeCloseTo(10 - r.fees, 10);
  });

  it("applies refunds and chargebacks before the percentage fee", () => {
    const a = clone();
    a.payment.refund_rate = { value: 0.1, basis: "estimate" };
    const r = netRevenue(a, 10);
    expect(r.refunds).toBeCloseTo(1, 10);
    const expectedFees = 0.25 * (0.029 * 9 + 0.3);
    expect(r.net).toBeCloseTo(9 - expectedFees, 10);
  });

  it("treats a price as tax-inclusive only when a tax rate is set", () => {
    const a = clone();
    a.payment.tax_pct = { value: 0.1, basis: "estimate" };
    const r = netRevenue(a, 11);
    expect(r.net).toBeLessThan(10);
    expect(r.net).toBeGreaterThan(9.5);
  });

  it("never counts unmeasured extra revenue", () => {
    expect(base.payment.measured_additional_revenue_usd_per_sub.value).toBe(0);
  });
});

describe("variableCost", () => {
  it("lists a missing unit cost as unknown instead of treating it as free", () => {
    const a = clone();
    a.unit_costs.tts_clip = { usd: null, basis: "unknown" };
    const r = variableCost(a, { tts_clip: 10, ocr: 10 });
    expect(r.unknown).toEqual(["tts_clip"]);
    expect(r.lines.map((l) => l.op)).toEqual(["ocr"]);
    expect(r.total).toBeCloseTo(10 * (a.unit_costs.ocr.usd as number), 10);
  });

  it("equals the sum of its lines (nothing double counted)", () => {
    const r = variableCost(base, { chat_messages: 100, whatsapp_messages: 100, image_medium: 5, realtime_minutes: 10 });
    expect(r.total).toBeCloseTo(r.lines.reduce((s, l) => s + l.usd, 0), 10);
  });

  it("charges a WhatsApp message for the AI share and for Meta leg, once each", () => {
    const meta = base.unit_costs.whatsapp_service_message.usd as number;
    const one = variableCost(base, { whatsapp_messages: 1 }).total;
    const chat = variableCost(base, { chat_messages: 1 }).total;
    expect(one).toBeCloseTo(chat * (base.unit_costs.whatsapp_ai_share.value as number) + meta, 10);
  });

  it("costs nothing for zero usage", () => {
    expect(variableCost(base, {}).total).toBe(0);
  });
});

describe("evaluatePlan", () => {
  it("reads price and VX from plans.ts", () => {
    for (const plan of Object.keys(PAID_PLANS) as (keyof typeof PAID_PLANS)[]) {
      expect(evaluatePlan(base, plan, "light", 100).price).toBe(PAID_PLANS[plan].price);
    }
  });

  it("allocates fixed cost once: per-subscriber share x N equals the fixed total", () => {
    const r = evaluatePlan(base, "basic", "light", 40);
    expect(r.allocatedFixed * 40).toBeCloseTo(fixedCostAt(base, 40), 10);
    expect(r.operatingProfit).toBeCloseTo(r.netRevenue - r.variableCost - r.allocatedFixed, 10);
  });

  it("shows an unprofitable heavy user as a loss with a margin below zero", () => {
    const r = evaluatePlan(base, "business", "heavy", 100);
    expect(r.contribution).toBeLessThan(0);
    expect(r.operatingProfit).toBeLessThan(0);
    expect(r.marginPct as number).toBeLessThan(0);
    expect(r.usageHeadroom as number).toBeLessThan(1);
  });

  it("reports headroom above 1 for a light user", () => {
    expect(evaluatePlan(base, "pro", "light", 100).usageHeadroom as number).toBeGreaterThan(1);
  });

  it("returns a null margin, not NaN, when net revenue is zero", () => {
    const a = clone();
    a.payment.fees.card = { pct: 1, fixed_usd: 100 };
    a.payment.mix = { omt: 0, whish: 0, card: 1, basis: "estimate" };
    const r = evaluatePlan(a, "kids", "light", 10);
    expect(r.netRevenue).toBeLessThanOrEqual(0);
    expect(r.marginPct).toBeNull();
  });

  it("falls back to no allocation, not Infinity, with zero subscribers", () => {
    expect(evaluatePlan(base, "basic", "light", 0).allocatedFixed).toBe(0);
  });

  it("evidence shares sum to 1 when there is cost", () => {
    const r = evaluatePlan(base, "pro", "typical", 100);
    const sum = Object.values(r.evidenceShare).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("projectBusiness", () => {
  const mix = base.mixes.subscriber_mix_b_balanced;
  const use = base.mixes.usage_mix_base;

  it("has zero revenue and only fixed cost with no subscribers", () => {
    const p = projectBusiness(base, 0, mix, use);
    expect(p.netRevenue).toBe(0);
    expect(p.operatingProfit).toBeCloseTo(-fixedCostAt(base, 0), 10);
    expect(p.operatingMarginPct).toBeNull();
  });

  it("books the fixed cost once, never per plan", () => {
    const p = projectBusiness(base, 100, mix, use);
    expect(p.fixedCost).toBe(fixedCostAt(base, 100));
    expect(p.operatingProfit).toBeCloseTo(p.netRevenue - p.variableCost - p.freeUserCost - p.fixedCost, 8);
  });

  it("steps the fixed cost up at the documented thresholds", () => {
    expect(fixedCostAt(base, 49)).toBeLessThan(fixedCostAt(base, 50));
    expect(fixedCostAt(base, 499)).toBeLessThan(fixedCostAt(base, 500));
  });

  it("credits Meta's free service messages once, so a tiny base pays no Meta cost", () => {
    const a = clone();
    const withPool = projectBusiness(a, 1, { kids: 0, basic: 1, pro: 0, business: 0 }, { light: 1, typical: 0, heavy: 0 });
    const a2 = clone();
    a2.unit_costs.whatsapp_free_service_messages_per_month = { value: 0, basis: "unknown" };
    const noPool = projectBusiness(a2, 1, { kids: 0, basic: 1, pro: 0, business: 0 }, { light: 1, typical: 0, heavy: 0 });
    expect(withPool.variableCost).toBeLessThan(noPool.variableCost);
  });

  it("scales a free-user cost with the free base, and not with revenue", () => {
    const a = clone();
    a.free_users.per_paying_subscriber = { value: 0, basis: "estimate" };
    const none = projectBusiness(a, 100, mix, use);
    expect(none.freeUserCost).toBe(0);
    expect(projectBusiness(base, 100, mix, use).freeUserCost).toBeGreaterThan(0);
  });

  it("finds a break-even that really is break-even", () => {
    const n = breakEvenSubscribers(base, mix, use);
    expect(n).not.toBeNull();
    expect(projectBusiness(base, n as number, mix, use).operatingProfit).toBeGreaterThanOrEqual(0);
    expect(projectBusiness(base, (n as number) - 1, mix, use).operatingProfit).toBeLessThan(0);
  });

  it("reports no break-even when every plan loses money", () => {
    const a = clone();
    a.unit_costs.chat_message_gpt41 = { usd: 100, basis: "estimate" };
    expect(breakEvenSubscribers(a, mix, use, 300)).toBeNull();
  });
});

describe("VX economics", () => {
  it("computes cost per 1,000 VX from the registry's own price and cost", () => {
    expect(costPer1000Vx({ vx_price: 60, base_cost: 0.04 })).toBeCloseTo(0.6667, 3);
    expect(costPer1000Vx({ vx_price: 0, base_cost: 1 })).toBeNull();
  });

  it("flags services whose registry cost exceeds the VX they charge", () => {
    const loss: string[] = [];
    for (const [id, s] of Object.entries(base.registry_services)) {
      if (typeof s === "string") continue;
      const per1000 = costPer1000Vx(s) as number;
      if (per1000 > 1) loss.push(id); // $1 = 1,000 VX
    }
    expect(loss.sort()).toEqual(["video", "voice_clone"]);
  });

  it("gives a maximum sustainable cost per 1,000 VX below $1 for every plan with VX", () => {
    for (const plan of Object.keys(PAID_PLANS) as (keyof typeof PAID_PLANS)[]) {
      const m = maxSustainableCostPer1000Vx(base, plan) as number;
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThan(1);
    }
  });

  it("prices a full-allowance spend on a loss-making service above the plan's price", () => {
    expect(fullAllowanceCost("business", 2)).toBeGreaterThan(PAID_PLANS.business.price);
  });
});

describe("maxHeavyShare", () => {
  it("is a fraction between 0 and 1 for every plan whose heavy user loses money", () => {
    for (const plan of Object.keys(PAID_PLANS) as (keyof typeof PAID_PLANS)[]) {
      const s = maxHeavyShare(base, plan) as number;
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(1);
    }
  });

  it("is exactly the share at which blended contribution is zero", () => {
    const s = maxHeavyShare(base, "basic") as number;
    const l = evaluatePlan(base, "basic", "light", 1).contribution;
    const t = evaluatePlan(base, "basic", "typical", 1).contribution;
    const h = evaluatePlan(base, "basic", "heavy", 1).contribution;
    expect((1 - s) * (0.5 * l + 0.5 * t) + s * h).toBeCloseTo(0, 8);
  });

  it("is null when a heavy user still earns", () => {
    const a = clone();
    for (const k of Object.keys(a.unit_costs)) if (a.unit_costs[k].usd) a.unit_costs[k].usd = 0;
    expect(maxHeavyShare(a, "business")).toBeNull();
  });
});
