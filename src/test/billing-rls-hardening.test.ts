import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

const HARDENING = "20260829000000_billing_rls_service_only.sql";

/**
 * A policy with no `TO <role>` clause applies to every role, including `anon`.
 * Several tables were created with `FOR ALL USING (true)` under names implying
 * service-role-only access, which left billing balances, account emails and the
 * provider routing table readable — and writable — with the publishable key that
 * ships in the browser bundle. service_role bypasses RLS, so the policies were
 * never needed in the first place.
 */
describe("billing and provider-hub RLS hardening", () => {
  const hardening = readFileSync(resolve(migrationsDir, HARDENING), "utf8");

  it("drops every permissive policy that exposed billing data", () => {
    for (const policy of [
      "trial_service_all",
      "wallet_service_all",
      "sub_service_all",
      "txn_service_all",
      "usage_service_all",
      "ubilling_service_all",
    ]) {
      expect(hardening).toContain(`DROP POLICY IF EXISTS "${policy}"`);
    }
  });

  it("drops every permissive policy that exposed the provider hub", () => {
    for (const policy of [
      "ph_providers_write_service",
      "ph_metrics_write_service",
      "ph_logs_write_service",
      "ph_configs_write_service",
      "ph_failovers_write_service",
    ]) {
      expect(hardening).toContain(`DROP POLICY IF EXISTS "${policy}"`);
    }
  });

  it("keeps owner-scoped reads, so a signed-in user still sees their own row", () => {
    for (const policy of [
      "trial_owner_select",
      "wallet_owner_select",
      "sub_owner_select",
      "txn_owner_select",
      "usage_owner_select",
      "ubilling_owner_select",
    ]) {
      expect(hardening).toContain(`CREATE POLICY "${policy}"`);
    }
  });

  it("leaves no unrestricted-role policy behind in any migration", () => {
    // `[^;]` keeps the match inside a single statement: without it, a policy
    // name pairs with the FOR ALL clause of the statement that follows it.
    const permissive = /CREATE\s+POLICY\s+"([^"]+)"[^;]{0,400}?FOR\s+ALL\s+USING\s*\(\s*true\s*\)/gi;
    const dropped = new Set(
      [...hardening.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+"([^"]+)"/gi)].map((m) => m[1]),
    );

    const offenders: string[] = [];
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf8");
      for (const match of sql.matchAll(permissive)) {
        const name = match[1];
        // `TO service_role` in the same statement makes it correctly scoped.
        if (/\bTO\s+service_role\b/i.test(match[0])) continue;
        if (dropped.has(name)) continue;
        offenders.push(`${file}: ${name}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
