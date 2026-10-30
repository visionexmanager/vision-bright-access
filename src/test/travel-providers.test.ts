import { describe, expect, it } from "vitest";

import { PROVIDER_KINDS, TRAVEL_PROVIDERS, providersFor } from "@/features/travel/providers";

describe("travel provider directory", () => {
  it("lists something to book on for every kind of trip", () => {
    for (const kind of PROVIDER_KINDS) {
      expect(providersFor(kind).length, kind).toBeGreaterThanOrEqual(5);
    }
  });

  it("links only to the service's own https address, with no credentials in it", () => {
    for (const provider of TRAVEL_PROVIDERS) {
      const url = new URL(provider.url);
      expect(url.protocol, provider.id).toBe("https:");
      expect(url.username + url.password, provider.id).toBe("");
      expect(url.hostname.includes("."), provider.id).toBe(true);
    }
  });

  it("has unique ids, real country codes and at least one kind per row", () => {
    expect(new Set(TRAVEL_PROVIDERS.map((p) => p.id)).size).toBe(TRAVEL_PROVIDERS.length);
    for (const provider of TRAVEL_PROVIDERS) {
      expect(provider.country, provider.id).toMatch(/^[A-Z]{2}$/);
      expect(provider.kinds.length, provider.id).toBeGreaterThan(0);
    }
  });
});
