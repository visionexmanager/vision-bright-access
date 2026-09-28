import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  includedVx,
  KIDS_PLAN,
  PAID_PLAN_ORDER,
  PAID_PLANS,
  TIER_ORDER,
  TIERS,
  VX_PER_USD,
} from "@/lib/billing/plans";

// The plan pricing agreed on 2026-09-28:
//
//   Kids $3 → 3,000 VX · Basic $5 → 5,000 VX · Pro $10 → 11,000 VX · Business $20 → 24,000 VX
//
// Pro and Business carry a bonus (10% and 20%) that is INSIDE the advertised
// figure. These tests pin the four plans in code and in the database, prove
// the bonus is applied exactly once, and pin how an order's terms are fixed
// when it is placed — so a price change never re-prices a customer's order.

const PRICING = readFileSync("supabase/migrations/20261057000000_final_plan_pricing.sql", "utf8");
const SQL = PRICING.replace(/--[^\n]*/g, "");

const AGREED = {
  kids: { price: 3, vx: 3_000, base: 3_000, bonus: 0 },
  basic: { price: 5, vx: 5_000, base: 5_000, bonus: 0 },
  pro: { price: 10, vx: 11_000, base: 10_000, bonus: 10 },
  business: { price: 20, vx: 24_000, base: 20_000, bonus: 20 },
} as const;

/** The body of the last CREATE of a function in this migration. */
function functionBody(name: string): string {
  const start = SQL.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return SQL.slice(start, SQL.indexOf("$$;", SQL.indexOf("AS $$", start)));
}

describe("the four plans, in code", () => {
  for (const [id, want] of Object.entries(AGREED)) {
    it(`${id}: $${want.price} → ${want.vx.toLocaleString("en-US")} VX a month`, () => {
      const plan = PAID_PLANS[id as keyof typeof PAID_PLANS];
      expect(plan.price).toBe(want.price);
      expect(plan.vxMonthly).toBe(want.vx);
      expect(plan.vxBase).toBe(want.base);
      expect(plan.vxBonusPercent).toBe(want.bonus);
    });
  }

  it("one dollar buys 1,000 VX before any bonus", () => {
    expect(VX_PER_USD).toBe(1_000);
    for (const id of PAID_PLAN_ORDER) expect(PAID_PLANS[id].vxBase).toBe(PAID_PLANS[id].price * 1_000);
    // The conversion the rest of the product states.
    expect(readFileSync("src/systems/pricingSystem.ts", "utf8")).toContain("Rate: 1000 VX = 1 USD");
  });

  it("the bonus is applied exactly once", () => {
    expect(includedVx(10_000, 10)).toBe(11_000);
    expect(includedVx(20_000, 20)).toBe(24_000);
    expect(includedVx(5_000, 0)).toBe(5_000);
    for (const id of PAID_PLAN_ORDER) {
      const plan = PAID_PLANS[id];
      expect(plan.vxMonthly, id).toBe(includedVx(plan.vxBase, plan.vxBonusPercent));
    }
  });

  it("Pro never becomes 12,100 VX and Business never 28,800 VX", () => {
    expect(TIERS.pro.vxMonthly).not.toBe(12_100);
    expect(TIERS.business.vxMonthly).not.toBe(28_800);
    // A second application of the bonus to the advertised figure is what those would be.
    expect(includedVx(TIERS.pro.vxMonthly, TIERS.pro.vxBonusPercent)).toBe(12_100);
    expect(includedVx(TIERS.business.vxMonthly, TIERS.business.vxBonusPercent)).toBe(28_800);
    expect([TIERS.pro.vxMonthly, TIERS.business.vxMonthly]).toEqual([11_000, 24_000]);
  });

  it("dearer plans include more VX, and every paid plan includes some", () => {
    const vx = PAID_PLAN_ORDER.map((id) => PAID_PLANS[id].vxMonthly);
    expect(vx).toEqual([3_000, 5_000, 11_000, 24_000]);
    expect(KIDS_PLAN.vxMonthly).toBeGreaterThan(0);
    expect(TIER_ORDER.map((t) => TIERS[t].price)).toEqual([5, 10, 20]);
  });

  it("keeps the WhatsApp allowances and sections as they were — this change is prices and VX only", () => {
    expect(PAID_PLAN_ORDER.map((id) => PAID_PLANS[id].whatsappDaily)).toEqual([50, 150, 400, 0]);
    expect(KIDS_PLAN.sections).toEqual(["news", "community", "assistive", "kids"]);
  });
});

describe("the four plans, in the database", () => {
  it("sets exactly the agreed price and VX for each plan id", () => {
    for (const [id, want] of Object.entries(AGREED)) {
      expect(SQL, id).toMatch(new RegExp(`\\('${id}',\\s+${want.price},\\s+${want.vx}\\)`));
    }
  });

  it("the database figures are the code's figures", () => {
    for (const id of PAID_PLAN_ORDER) {
      const plan = PAID_PLANS[id];
      expect(SQL, id).toMatch(new RegExp(`\\('${id}',\\s+${plan.price},\\s+${plan.vxMonthly}\\)`));
    }
  });

  it("stores the final figure only: no bonus column, no bonus arithmetic", () => {
    expect(SQL).not.toMatch(/bonus/i);
    expect(SQL).not.toMatch(/vx_credits_monthly\s*\*\s*1\.[0-9]/);
    expect(SQL).not.toMatch(/12100|28800/);
  });

  it("touches only the four plan rows, and no balance or ledger", () => {
    const loop = SQL.slice(SQL.indexOf("DO $$"), SQL.indexOf("CREATE OR REPLACE FUNCTION public.create_subscription_order"));
    expect(loop).toContain("WHERE id = _plan.id");
    expect(loop).not.toMatch(/legacy_|free_trial/);
    const beforeFunctions = SQL.slice(0, SQL.indexOf("CREATE OR REPLACE FUNCTION"));
    expect(beforeFunctions).not.toMatch(/user_points|user_subscriptions|vx_usage_ledger|DELETE /i);
  });

  it("states the VX on the plan card as “N VX a month” and never as credits", () => {
    expect(SQL).toContain("to_char(_plan.vx, 'FM999,999') || ' VX a month'");
    expect(SQL).not.toMatch(/'[^']*VX credits[^']*'/);
    // A card still saying "credits/month" is rewritten, not kept beside the new line.
    expect(SQL).toContain("VX (a month|credits/month)");
  });

  it("is safe to run twice: the order stamp only fills blanks, the plan update is by value", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS vx_credits_monthly integer");
    expect(SQL).toMatch(/AND o\.status = 'pending'\s+AND o\.vx_credits_monthly IS NULL;/);
    expect(SQL).toContain("DROP CONSTRAINT IF EXISTS subscription_orders_vx_credits_monthly_check");
  });
});

describe("an order's terms are fixed when it is placed", () => {
  it("pending orders keep the VX of the plan they were priced under — stamped before the plans change", () => {
    const stamp = SQL.indexOf("UPDATE public.subscription_orders AS o");
    const plans = SQL.indexOf("DO $$");
    expect(stamp).toBeGreaterThan(-1);
    expect(stamp).toBeLessThan(plans);
  });

  it("placing an order records its VX with its price, from billing_plans, never from the caller", () => {
    const create = functionBody("create_subscription_order");
    expect(create).toContain("SELECT b.price_monthly_usd * _months, COALESCE(b.vx_credits_monthly, 0) INTO _price, _vx");
    expect(create).toContain("b.is_active AND b.price_monthly_usd > 0");
    expect(create).toContain("price_usd = _price, vx_credits_monthly = _vx");
    expect(create).toMatch(/VALUES \(_uid, _plan_id, _months, _price, _vx,/);
    expect(create).toContain("IF _uid IS NULL THEN");
    expect(create).toContain("IF _months IS NULL OR _months NOT IN (1, 3, 6, 12) THEN");
  });

  it("approval grants the VX the order was placed for, for every month paid, once", () => {
    const approve = functionBody("approve_subscription_order");
    expect(approve).toContain("_vx := COALESCE(_order.vx_credits_monthly, _plan.vx_credits_monthly, 0);");
    expect(approve).toContain("_vx * _order.months");
    expect(approve).not.toMatch(/_plan\.vx_credits_monthly \* _order\.months/);
    expect(approve).toContain("IF NOT public.has_role(auth.uid(), 'admin') THEN");
    expect(approve).toContain("IF _order.status <> 'pending' THEN");
  });

  it("renewal extends the same plan from where it ends; a change of plan starts today and replaces the old one", () => {
    const approve = functionBody("approve_subscription_order");
    expect(approve).toContain("AND s.status = 'active' AND s.ends_at > now();");
    expect(approve).toContain("_ends := _starts + make_interval(months => _order.months);");
    expect(approve).toMatch(/SET status = 'cancelled', cancelled_at = now\(\), updated_at = now\(\)\s+WHERE user_id = _order\.user_id AND status = 'active';/);
  });

  it("keeps the functions' grants: anon out, the signed-in caller and service_role in", () => {
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.create_subscription_order(text, text, integer) FROM anon;");
    expect(SQL).toContain("GRANT EXECUTE ON FUNCTION public.create_subscription_order(text, text, integer) TO authenticated, service_role;");
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.approve_subscription_order(uuid, text) FROM PUBLIC, anon;");
    expect(SQL).toContain("GRANT EXECUTE ON FUNCTION public.approve_subscription_order(uuid, text) TO authenticated, service_role;");
  });
});

describe("the trial emails and notifications name the current plans", () => {
  const trial = readFileSync("supabase/functions/trial-billing/index.ts", "utf8");
  const NAMES = { kids: "Kids", basic: "Basic", pro: "Pro", business: "Business" } as const;

  it("the one-line summary carries each plan's price", () => {
    expect(trial).toContain('const TIER_SUMMARY = "Kids $3, Basic $5, Pro $10 or Business $20 a month";');
    for (const id of PAID_PLAN_ORDER) expect(trial).toContain(`${NAMES[id]} $${PAID_PLANS[id].price}`);
  });

  it("the ‘free week ends tomorrow’ email lists each plan with its price and VX", () => {
    for (const id of PAID_PLAN_ORDER) {
      const plan = PAID_PLANS[id];
      expect(trial, id).toContain(`<strong>${NAMES[id]} — $${plan.price}/month, ${plan.vxMonthly.toLocaleString("en-US")} VX:</strong>`);
    }
  });

  it("no longer offers the retired names or prices", () => {
    expect(trial).not.toMatch(/Bronze|Silver|Gold/);
    // $7 was Pro's old price; $10 is now Pro's, so it is checked by name above.
    expect(trial).not.toMatch(/\$7\b/);
    expect(trial).not.toMatch(/Business \$10|Business — \$10/);
  });
});

describe("the free-week card names the current plans, in every language", () => {
  const locales = readdirSync("src/i18n").filter((n) => /^[a-z]{2}\.ts$/.test(n));
  /** One string key's value, read from a dictionary's source. */
  const value = (source: string, key: string) =>
    new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(source)?.[1];

  it("covers all twenty locales", () => {
    expect(locales).toHaveLength(20);
  });

  for (const file of locales) {
    it(`${file}: names Kids, Basic, Pro and Business as the plan names do, and no retired tier`, () => {
      const source = readFileSync(`src/i18n/${file}`, "utf8");
      const body = value(source, "plans.freeWeekBody");
      expect(body, "plans.freeWeekBody missing").toBeTruthy();
      for (const tier of ["kids", "basic", "pro", "business"]) {
        const name = value(source, `plans.tier.${tier}`);
        expect(name, `plans.tier.${tier} missing`).toBeTruthy();
        expect(body, `${tier} is not named`).toContain(name);
      }
    });
  }

  it("English no longer offers Bronze, Silver or Gold", () => {
    expect(value(readFileSync("src/i18n/en.ts", "utf8"), "plans.freeWeekBody")).not.toMatch(/Bronze|Silver|Gold/);
  });
});

describe("what a customer sees", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });

  it("the pricing page shows the plan's own price and VX line, never a base, a bonus or a formula", () => {
    const readers = walk("src").filter((f) => f !== "src/lib/billing/plans.ts" && /vxBase|vxBonusPercent|includedVx/.test(readFileSync(f, "utf8")));
    expect(readers).toEqual([]);
    const pricing = readFileSync("src/pages/Pricing.tsx", "utf8");
    expect(pricing).toContain(".from(\"billing_plans\")");
    expect(pricing).toContain("`$${plan.price_monthly_usd}`");
  });
});
