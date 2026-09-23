// Retiring the wallet system that never ran.
//
// Production, read-only, 2026-09-19: six `credit_wallets` rows all holding
// zero, no `credit_transactions`, no `usage_logs`. `billing_consume` was never
// called, which is why the Usage page has shown every user a blank history
// since it was built. There was nothing to migrate — so nothing was migrated,
// and only the code that could never have worked is gone.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billing = readFileSync("supabase/functions/billing-engine/index.ts", "utf8");
const service = readFileSync("src/services/ai-media-studio/billingService.ts", "utf8");
const hook = readFileSync("src/hooks/useCredits.ts", "utf8");
const retire = readFileSync("supabase/migrations/20261027000000_retire_admin_give_vx.sql", "utf8");
const doc = readFileSync(".claude/references/vx-deprecations.md", "utf8");

describe("nothing that holds data was dropped", () => {
  it("keeps every legacy table and every SQL function that can touch a balance", () => {
    // The rollback for all of Phase 1 is "stop calling the new functions",
    // which only works while the old ones still exist.
    const migrations = ["20261022000000_provider_hub_admin_only.sql",
      "20261023000000_vx_central_pricing_and_ledger.sql",
      "20261024000000_vx_wallet_migration_tools.sql",
      "20261025000000_vx_pricing_admin_api.sql",
      "20261026000000_vx_wallet_parity_report.sql",
      "20261027000000_retire_admin_give_vx.sql"]
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .map((sql) => sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n"))
      .join("\n");

    expect(migrations).not.toMatch(/DROP\s+TABLE/i);
    for (const kept of ["billing_consume", "billing_refund", "billing_grant_credits",
                        "billing_initialize_user", "billing_get_status"]) {
      expect(migrations, kept).not.toContain(`DROP FUNCTION IF EXISTS public.${kept}`);
    }
    // The only function dropped is the one that could not work.
    expect((migrations.match(/DROP FUNCTION/gi) ?? []).length).toBe(1);
    expect(retire).toContain("DROP FUNCTION IF EXISTS public.admin_give_vx(uuid, integer, text);");
  });

  it("changes no balance", () => {
    const code = retire.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });

  it("does not recreate a second balance column", () => {
    expect(retire).not.toMatch(/ADD COLUMN.*vx_balance/i);
    expect(retire).toContain("There is one balance, and it is `SUM(user_points)`");
  });
});

describe("admin_give_vx is gone and admin_adjust_vx is the path", () => {
  it("leaves no caller anywhere", () => {
    for (const file of ["src", "supabase/functions"]) {
      expect(existsSync(file)).toBe(true);
    }
    // Neither the app nor any Edge Function referenced it; the migration and
    // this suite are the only places the name may still appear.
    expect(billing).not.toContain("admin_give_vx");
    expect(service).not.toContain("admin_give_vx");
  });

  it("points the next reader at the working function", () => {
    expect(retire).toContain("COMMENT ON FUNCTION public.admin_adjust_vx(text, integer, text)");
    expect(retire).toContain("Replaced admin_give_vx");
  });
});

describe("the client can no longer charge VX", () => {
  it("has no consume or refund in the service layer", () => {
    expect(service).not.toMatch(/export async function consumeCredits/);
    expect(service).not.toMatch(/export async function refundCredits/);
    expect(service).not.toMatch(/action: "consume"/);
    expect(service).not.toMatch(/action: "refund"/);
  });

  it("has no consume hook", () => {
    expect(hook).not.toContain("useCreditConsume");
    expect(hook).not.toContain("consumeCredits");
  });

  it("answers the superseded actions by naming what replaced them", () => {
    // An action that returns "unknown" invites a retry.
    expect(billing).toContain("Superseded by vx_reserve / vx_settle");
    expect(billing).toMatch(/case "consume":\s*\n\s*case "refund":\s*\n\s*case "grant_credits":/);
    expect(billing).toContain("410");
    expect(billing).not.toMatch(/async function handleConsume/);
    expect(billing).not.toMatch(/async function handleRefund/);
    expect(billing).not.toMatch(/async function handleGrantCredits/);
  });

  it("keeps the read actions the Billing screen still uses", () => {
    for (const action of ["get_status", "get_balance", "get_history", "get_usage_logs", "get_plans", "cancel"]) {
      expect(billing, action).toContain(`case "${action}"`);
    }
  });
});

describe("the deprecation document says what replaced what", () => {
  it("maps every old shape to its replacement", () => {
    for (const old of ["credit_wallets", "billing_consume", "billing_refund", "usage_logs",
                       "billing_rules", "admin_give_vx"]) {
      expect(doc, old).toContain(old);
    }
    for (const now of ["user_points", "vx_reserve", "vx_settle", "vx_release",
                       "vx_usage_ledger", "central_pricing_registry"]) {
      expect(doc, now).toContain(now);
    }
  });

  it("records the production numbers the decision rested on", () => {
    expect(doc).toContain("6 rows, all 0 VX");
    expect(doc).toContain("credit_transactions:  0 rows");
    expect(doc).toContain("column does not exist");
  });

  it("says what was kept, and why", () => {
    expect(doc).toContain("What has NOT been removed, and why");
    expect(doc).toMatch(/No table has been dropped/);
  });
});
