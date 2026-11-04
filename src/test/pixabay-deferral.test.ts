// Pixabay was deferred by the owner on 2026-10-12 and brought back on 2026-11-03.
// The "deferred_by_owner" state itself stays: it is how the next postponed provider
// is parked without a request, an error or a missing-secret warning.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = await import("../../supabase/functions/_shared/externalContent/registry.ts");
const aggregate = await import("../../supabase/functions/_shared/externalContent/aggregate.ts");

const withKey = (name: string) => (n: string) => (n === name ? "set-for-the-test" : undefined);
const pixabay = registry.CONTENT_PROVIDERS.find((p) => p.id === "pixabay")!;

describe("Pixabay is back, and behaves like any keyed provider", () => {
  it("is no longer deferred: it needs its key, and is ready once the key is set", () => {
    expect(pixabay.deferredByOwner).toBeUndefined();
    expect(registry.providerStatus(pixabay, () => undefined)).toBe("configuration_required");
    expect(registry.providerStatus(pixabay, withKey("PIXABAY_API_KEY"))).toBe("ready");
  });

  it("is selected for an image search when the key is set, and skipped when it is not", () => {
    const all = aggregate.normalizeSearchInput({ query: "flower", categories: ["images"] })!;
    expect(aggregate.selectProviders(all, withKey("PIXABAY_API_KEY")).map((p) => p.id)).toContain("pixabay");
    expect(aggregate.selectProviders(all, () => undefined).map((p) => p.id)).not.toContain("pixabay");
  });

  it("keeps the secret name and the deploy sync", () => {
    const keyed = readFileSync("supabase/functions/_shared/externalContent/providers/keyed.ts", "utf8");
    expect(keyed).toContain('env: ["PIXABAY_API_KEY"]');
    expect(keyed).toContain("export function parsePixabay");
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain("PIXABAY_API_KEY");
  });
});

describe("the deferred state still works for the next provider that needs it", () => {
  const parked = { ...pixabay, deferredByOwner: "Postponed by the owner for a test." };

  it("has its own status, distinct from unconfigured", () => {
    expect(registry.providerStatus(parked, withKey("PIXABAY_API_KEY"))).toBe("deferred_by_owner");
  });

  it("is health-checked without a single request", async () => {
    const noFetch = () => { throw new Error("a deferred provider must not make a request"); };
    const health = await aggregate.checkProviderHealth(parked, { fetch: noFetch as never, env: withKey("PIXABAY_API_KEY") });
    expect(health).toMatchObject({ state: "deferred_by_owner", latencyMs: null, resultCount: 0, errorCode: null });
  });

  it("is never selected", () => {
    const input = aggregate.normalizeSearchInput({ query: "flower", providers: ["pixabay"] })!;
    expect(aggregate.selectProviders(input, withKey("PIXABAY_API_KEY"), [parked]).map((p) => p.id)).not.toContain("pixabay");
  });

  it("is not stored in a table that does not list it", () => {
    const fn = readFileSync("supabase/functions/library-research-assistant/index.ts", "utf8");
    expect(fn).toContain('health.filter((h) => h.state !== "deferred_by_owner")');
    const migration = readFileSync("supabase/migrations/20261061000000_library_external_content.sql", "utf8");
    expect(migration).toContain("state IN ('healthy', 'degraded', 'down', 'not_configured')");
  });

  it("has its two admin labels in every locale", () => {
    for (const locale of ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"]) {
      const file = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      expect(file, locale).toContain('"library.admin.externalSources.status.deferred_by_owner"');
      expect(file, locale).toContain('"library.admin.externalSources.health.deferred_by_owner"');
    }
  });
});
