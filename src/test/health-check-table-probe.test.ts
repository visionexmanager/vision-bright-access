import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

const healthCheck = readFileSync(
  resolve(root, "supabase/functions/health-check/index.ts"),
  "utf8",
);

/**
 * `checkTable()` probed with `.select("id")`, which fails on any table that has
 * no `id` column. credit_wallets and trial_status are keyed by `user_id`, so
 * both reported as missing tables in production while existing and holding
 * data — the message matched on the words "does not exist", which Postgres
 * 42703 `undefined_column` also contains.
 */
describe("health-check table probe", () => {
  it("probes without naming a column", () => {
    expect(healthCheck).toContain('.select("*").limit(0)');
    expect(healthCheck).not.toContain('.select("id")');
  });

  it("never uses a HEAD probe, which hides a missing table behind an empty 404", () => {
    // Scoped to actual `.select(...)` calls: the source comment explains why
    // `head: true` is wrong, and must not itself trip this assertion.
    expect(healthCheck).not.toMatch(/\.select\([^)]*head:\s*true/);
  });

  it("classifies a missing table by error code, not by message text", () => {
    expect(healthCheck).toContain('MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"])');
    expect(healthCheck).toContain("MISSING_TABLE_CODES.has(error.code)");
    expect(healthCheck).not.toMatch(/error\.message\.includes\(\s*"does not exist"\s*\)/);
  });

  it("still checks the billing tables that were misreported", () => {
    for (const table of ["credit_wallets", "trial_status", "billing_plans"]) {
      expect(healthCheck).toContain(`"${table}"`);
    }
  });
});
