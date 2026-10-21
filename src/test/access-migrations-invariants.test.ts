import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { PAID_PLANS, TIERS } from "@/lib/billing/plans";

// The migrations that belong to the cost-aware access policy (PR #475). Customer, billing and
// balance data are an invariant: none of them may write to it, and none may touch a price, a VX
// figure, a WhatsApp allowance, an order or a subscription. These are static guards over the SQL
// text, backed by the executed before/after snapshot in scripts/sql/trial-sections-migration-scenarios.mjs.

const DIR = "supabase/migrations";
const ours = readdirSync(DIR).filter((f) => /^(2026107[89]|2026108[0-4])/.test(f)).sort();
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").replace(/\r\n/g, "\n");
/** SQL with whole-line comments removed. */
const code = (f: string) => read(f).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

const CUSTOMER_TABLES = "user_points|credit_wallets|user_subscriptions|subscription_orders|subscription_payments|profiles|vx_usage_ledger|vx_reservations|bazaar_orders|bazaar_order_items|bazaar_shops|bazaar_products|whatsapp_identities|whatsapp_usage|whatsapp_messages|whatsapp_conversations|library_purchases|auth\\.users|user_roles";
const WRITES_CUSTOMER_DATA = new RegExp(`\\b(UPDATE|DELETE\\s+FROM|INSERT\\s+INTO|TRUNCATE(\\s+TABLE)?|ALTER\\s+TABLE)\\s+(public\\.)?(${CUSTOMER_TABLES})\\b`, "i");

describe("the access-policy migrations are the ones we reviewed", () => {
  it("are exactly 20261078 to 20261084, with no gap and no neighbour added unnoticed", () => {
    expect(ours.map((f) => f.slice(0, 14))).toEqual(["20261078000000", "20261079000000", "20261080000000", "20261081000000", "20261082000000", "20261083000000", "20261084000000"]);
  });
});

describe("customer, billing and balance data are never written", () => {
  it("no migration writes to a customer, order, subscription, balance or role table", () => {
    for (const f of ours) expect(code(f), f).not.toMatch(WRITES_CUSTOMER_DATA);
  });

  it("the guard is not vacuous: it catches a write to each kind of protected table", () => {
    for (const bad of [
      "UPDATE public.user_points SET points = 0;",
      "DELETE FROM public.user_subscriptions WHERE true;",
      "INSERT INTO public.subscription_orders VALUES (1);",
      "update bazaar_orders set status = 'paid';",
      "ALTER TABLE public.profiles ADD COLUMN x int;",
      "TRUNCATE TABLE public.credit_wallets;",
    ]) expect(bad).toMatch(WRITES_CUSTOMER_DATA);
  });

  it("the only plan row any of them writes is the Kids section list in 20261078, and it never touches a price, a VX figure, a name, a feature or the active flag", () => {
    const touching = ours.filter((f) => /billing_plans/i.test(code(f)));
    expect(touching).toEqual(["20261078000000_trial_local_sections.sql"]);
    const sql = code(touching[0]);
    const updates = sql.match(/UPDATE\s+public\.billing_plans[\s\S]*?;/gi) ?? [];
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/SET\s+limits\s*=\s*jsonb_set\([\s\S]*'\{sections\}'/i);
    expect(updates[0]).toMatch(/WHERE\s+p\.id\s*=\s*'kids'/i);
    expect(updates[0]).not.toMatch(/price_monthly_usd|vx_credits_monthly|\bfeatures\b|\bname\b|description|is_active|whatsapp_daily_messages/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.billing_plans|INSERT\s+INTO\s+public\.billing_plans/i);
  });
});

describe("prices, VX conversion and WhatsApp allowances still equal their one source of truth", () => {
  // The latest migration that SET the agreed price and VX for each plan (20261057), read from the SQL, not retyped.
  const agreed = (() => {
    const sql = read("20261057000000_final_plan_pricing.sql");
    const rows = [...sql.matchAll(/\('(kids|basic|pro|business)',\s+(\d+),\s+(\d+)\)/g)].map((m) => [m[1], Number(m[2]), Number(m[3])] as const);
    return Object.fromEntries(rows.map(([id, price, vx]) => [id, { price, vx }]));
  })();

  it("plans.ts prices and monthly VX equal what the pricing migration set", () => {
    expect(Object.keys(agreed).sort()).toEqual(["basic", "business", "kids", "pro"]);
    for (const [id, want] of Object.entries(agreed)) {
      const plan = PAID_PLANS[id as keyof typeof PAID_PLANS];
      expect({ id, price: plan.price, vx: plan.vxMonthly }).toEqual({ id, price: want.price, vx: want.vx });
    }
  });

  it("one dollar is still 1,000 VX, and a tier's base VX is its price at that rate", () => {
    for (const tier of Object.values(TIERS)) expect(tier.vxBase).toBe(tier.price * 1_000);
  });

  it("WhatsApp daily allowances are unchanged: 50, 150, 400 and unlimited", () => {
    expect([PAID_PLANS.kids, PAID_PLANS.basic, PAID_PLANS.pro, PAID_PLANS.business].map((p) => p.whatsappDaily)).toEqual([50, 150, 400, 0]);
  });
});

describe("each migration is idempotent and safe by construction", () => {
  it("every CREATE is guarded (IF NOT EXISTS / OR REPLACE) and no policy is created", () => {
    for (const f of ours) {
      const sql = code(f);
      expect(sql, f).not.toMatch(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i);
      expect(sql, f).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i);
      expect(sql, f).not.toMatch(/CREATE\s+FUNCTION/i);
      expect(sql, f).not.toMatch(/CREATE\s+POLICY/i);
      expect(sql, f).not.toMatch(/DROP\s+(TABLE|FUNCTION|COLUMN)(?!\s+IF\s+EXISTS)/i);
    }
  });

  it("every SECURITY DEFINER function pins its search_path and is revoked from anon and authenticated, granted to the service role only", () => {
    for (const f of ours) {
      const sql = code(f);
      for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.(\w+)\(([^)]*)\)[\s\S]*?\$\$;/g)) {
        const [block, name] = m;
        if (!/SECURITY DEFINER/.test(block)) continue;
        expect(block, `${f} ${name}`).toMatch(/SET search_path = public(, pg_temp)?/);
        expect(sql, `${f} ${name}`).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
        expect(sql, `${f} ${name}`).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO service_role;`));
        expect(sql, `${f} ${name}`).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO (anon|authenticated|PUBLIC)`, "i"));
      }
    }
  });

  it("every table they create has row-level security on, no policy, and no grant to anon or authenticated", () => {
    for (const f of ours) {
      const sql = code(f);
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)) {
        const t = m[1];
        expect(sql, `${f} ${t}`).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
        expect(sql, `${f} ${t}`).toMatch(new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`));
        expect(sql, `${f} ${t}`).not.toMatch(new RegExp(`GRANT[^;]*ON TABLE public\\.${t}[^;]*TO[^;]*(anon|authenticated)`, "i"));
      }
    }
  });

  it("every migration documents a rollback, and the three that make a SAFER state say what rolling back restores", () => {
    for (const f of ours) expect(read(f), f).toMatch(/Rollback/i);
    expect(read("20261080000000_library_content_cache_not_enumerable.sql")).toMatch(/not recommended: it restores the bulk read/i);
    expect(read("20261079000000_whatsapp_no_notice_for_free_week.sql")).toMatch(/Rollback: re-create the[\s\S]{0,8}function from[\s\S]{0,8}20261075/i);
    expect(read("20261081000000_bazaar_notify_limits.sql")).toMatch(/restores the unlimited behaviour/i);
  });

  it("the global WhatsApp notice budget ships OFF: no migration sets a value", () => {
    const sql = code("20261083000000_whatsapp_notice_global_budget.sql");
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.ops_limits/i);
  });
});
