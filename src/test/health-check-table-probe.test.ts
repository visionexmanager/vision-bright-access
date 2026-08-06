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

/**
 * The endpoint reported `openai -> ok` while every OpenAI-backed function in
 * production was failing with 429 insufficient_quota. Listing models succeeds
 * on a key with no balance, so the check could not fail when the thing it
 * checked was broken.
 */
describe("health-check live provider probes", () => {
  it("performs a real generation, not just a model listing", () => {
    expect(healthCheck).toContain("probeGeneration");
    expect(healthCheck).toContain("max_tokens: 1");
    expect(healthCheck).toContain("maxOutputTokens: 1");
  });

  it("tells running out of credit apart from being rate limited", () => {
    expect(healthCheck).toContain("insufficient_quota");
    expect(healthCheck).toContain("no credits remaining");
    // Same 429, opposite remedies — they must not collapse into one message.
    expect(healthCheck).toMatch(/Out of credit/);
    expect(healthCheck).toMatch(/Rate limited or over quota/);
  });

  it("flags a stale model id rather than reporting a generic failure", () => {
    expect(healthCheck).toMatch(/configured model id is stale/);
  });

  it("keeps the paid probe behind the admin gate", () => {
    const adminGate = healthCheck.indexOf("if (isAdmin) {");
    const probeUse = healthCheck.indexOf("provider_live_");
    const summary = healthCheck.indexOf("── Summary");

    expect(adminGate).toBeGreaterThan(-1);
    expect(probeUse).toBeGreaterThan(adminGate);
    expect(probeUse).toBeLessThan(summary);
  });

  it("no longer lets the free listing check claim OpenAI is working", () => {
    expect(healthCheck).not.toContain("OpenAI connected.");
    expect(healthCheck).toContain("generation not verified here");
  });

  it("covers every chat provider the platform can route to", () => {
    for (const provider of ["openai", "groq", "mistral", "gemini"]) {
      expect(healthCheck).toContain(`${provider}: {`);
    }
  });
});
