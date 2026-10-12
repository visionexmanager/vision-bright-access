// Pixabay is deferred by the owner (2026-10-12): not unsupported, not an invalid key,
// not an outage. A fourth state that makes no request and reports no fault.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = await import("../../supabase/functions/_shared/externalContent/registry.ts");

// ── Pixabay: deferred by the owner ──────────────────────────────────────────
//
// Not unsupported (it may come back), not a missing or invalid key (nobody is
// asked for one), not an outage (nothing is called). A fourth state.

const aggregate = await import("../../supabase/functions/_shared/externalContent/aggregate.ts");

const withKey = (name: string) => (n: string) => (n === name ? "set-for-the-test" : undefined);
const noFetch = () => { throw new Error("a deferred provider must not make a request"); };
const pixabay = registry.CONTENT_PROVIDERS.find((p) => p.id === "pixabay")!;

describe("Pixabay is deferred, and says so", () => {
  it("has its own status, distinct from unsupported, unconfigured and down", () => {
    expect(pixabay.deferredByOwner).toMatch(/Postponed by the owner/);
    expect(registry.providerStatus(pixabay, () => undefined)).toBe("deferred_by_owner");
    // Even with a key present — a deferral is a decision, not a missing secret.
    expect(registry.providerStatus(pixabay, withKey("PIXABAY_API_KEY"))).toBe("deferred_by_owner");
    expect(registry.UNSUPPORTED_PROVIDERS.some((p) => p.id === "pixabay")).toBe(false);
    const summary = registry.summarizeProviders(() => undefined).find((p) => p.id === "pixabay")!;
    expect(summary.status).toBe("deferred_by_owner");
  });

  it("is never selected, even when a search names it and the key is set", () => {
    const input = aggregate.normalizeSearchInput({ query: "flower", providers: ["pixabay"] })!;
    expect(aggregate.selectProviders(input, withKey("PIXABAY_API_KEY")).map((p) => p.id)).not.toContain("pixabay");
    const all = aggregate.normalizeSearchInput({ query: "flower", categories: ["images"] })!;
    expect(aggregate.selectProviders(all, withKey("PIXABAY_API_KEY")).map((p) => p.id)).not.toContain("pixabay");
  });

  it("is health-checked without a single request, and reports neither down nor unconfigured", async () => {
    const health = await aggregate.checkProviderHealth(pixabay, { fetch: noFetch as never, env: withKey("PIXABAY_API_KEY") });
    expect(health).toMatchObject({ provider: "pixabay", state: "deferred_by_owner", latencyMs: null, resultCount: 0, errorCode: null });
  });

  it("makes no request to Pixabay across a whole health run or a search", async () => {
    const hosts: string[] = [];
    const spy = (async (url: string) => { hosts.push(new URL(url).host); return new Response("{}", { status: 200 }); }) as never;
    await aggregate.checkAllProviders({ fetch: spy, env: withKey("PIXABAY_API_KEY") });
    await aggregate.searchExternalContent(aggregate.normalizeSearchInput({ query: "flower", categories: ["images"] })!, { fetch: spy, env: withKey("PIXABAY_API_KEY") }, { cache: null } as never);
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.filter((h) => h.includes("pixabay"))).toEqual([]);
  });

  it("leaves every other provider's status as it was", () => {
    const deferred = registry.CONTENT_PROVIDERS.filter((p) => p.deferredByOwner).map((p) => p.id);
    expect(deferred).toEqual(["pixabay"]);
    for (const id of ["wikimedia_commons", "openverse", "nasa", "internet_archive", "openstax", "wikibooks"]) {
      expect(registry.providerStatus(registry.providerById(id)!, () => undefined), id).toBe("ready");
    }
    for (const [id, key] of [["unsplash", "UNSPLASH_ACCESS_KEY"], ["pexels", "PEXELS_API_KEY"], ["flickr", "FLICKR_API_KEY"], ["youtube", "YOUTUBE_API_KEY"]] as const) {
      expect(registry.providerStatus(registry.providerById(id)!, () => undefined), id).toBe("configuration_required");
      expect(registry.providerStatus(registry.providerById(id)!, withKey(key)), id).toBe("ready");
    }
  });

  it("keeps the code, the secret name and the deploy sync, and is not probed by the workflow", () => {
    const keyed = readFileSync("supabase/functions/_shared/externalContent/providers/keyed.ts", "utf8");
    expect(keyed).toContain('env: ["PIXABAY_API_KEY"]');
    expect(keyed).toContain("export function parsePixabay");
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain("PIXABAY_API_KEY");
    expect(readFileSync(".github/workflows/external-sources-health.yml", "utf8")).not.toMatch(/pixabay\.com|PIXABAY_API_KEY/);
  });

  it("does not try to store the deferred state in a table that does not list it", () => {
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
