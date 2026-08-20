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

/**
 * The secret inventory is the admin dashboard's answer to "does every service
 * that needs a credential actually have one". Four of the seven social
 * publishing secrets were absent from it, and one of those four —
 * SOCIAL_TOKEN_ENCRYPTION_KEY — is the variable whose absence stops every
 * connection from being storable at all. The dashboard therefore reported a
 * healthy system while the feature could not work, which is precisely the
 * reading the inventory exists to prevent.
 */
describe("health-check secret inventory", () => {
  /** The inventory block, so a name mentioned in a comment elsewhere cannot pass. */
  const inventory = healthCheck.slice(
    healthCheck.indexOf("const PLATFORM_SECRETS"),
    healthCheck.indexOf("];", healthCheck.indexOf("const PLATFORM_SECRETS")),
  );

  it("covers every secret the social publishing path reads", () => {
    for (const name of [
      "META_APP_ID",
      "META_APP_SECRET",
      "SOCIAL_TOKEN_ENCRYPTION_KEY",
      "SOCIAL_OAUTH_STATE_SECRET",
      "THREADS_APP_ID",
      "THREADS_APP_SECRET",
      "CRON_SECRET",
    ]) {
      expect(inventory, `${name} must be in the inventory`).toContain(`name: "${name}"`);
    }
  });

  it("names exactly the variables the provider registry asks for", () => {
    // Read from the registry rather than restated, so renaming a variable there
    // and forgetting this list fails here instead of in production.
    const registry = readFileSync(
      resolve(root, "supabase/functions/_shared/socialOauth.ts"),
      "utf8",
    );
    const metaAndThreads = [...registry.matchAll(/client(?:Id|Secret)Env: "((?:META|THREADS)_[A-Z_]+)"/g)]
      .map((match) => match[1]);

    expect(metaAndThreads.length).toBeGreaterThan(0);
    for (const name of new Set(metaAndThreads)) {
      expect(inventory, `${name} is read by the registry and must be inventoried`)
        .toContain(`name: "${name}"`);
    }
  });

  it("reports presence and never a value", () => {
    // The whole inventory is worthless if it leaks what it is checking.
    expect(healthCheck).toContain("const configured = !!Deno.env.get(secret.name)");
    expect(healthCheck).not.toMatch(/detail:.*\$\{Deno\.env\.get/);
    // And it stays behind the admin check.
    const consumer = healthCheck.slice(healthCheck.indexOf("if (isAdmin) {"));
    expect(consumer).toContain("for (const secret of PLATFORM_SECRETS)");
  });

  it("leaves the WhatsApp entries untouched", () => {
    // WhatsApp is live in production. This inventory is shared, so the four
    // names its webhook and send paths depend on must stay listed exactly.
    for (const name of [
      "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN",
    ]) {
      expect(inventory, `${name} must remain inventoried`).toContain(`name: "${name}"`);
    }
    // The retired alias must not come back as an ENTRY. It is still named in a
    // comment there, recording that it was retired and must not be reintroduced
    // — forbidding the bare string would forbid saying so.
    expect(inventory).not.toContain('name: "WHATSAPP_ACCESS_TOKEN"');
  });
});
