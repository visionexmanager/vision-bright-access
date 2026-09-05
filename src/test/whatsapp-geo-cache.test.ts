// Phase A2 — asking the map services less often.
//
// The point of these is not that a cache caches. It is the three rules that are
// easy to get wrong and expensive when they are: a cache miss must not become a
// failure, a null answer must not be remembered, and a key must not carry a
// person.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { GeoCacheStore } from "../../supabase/functions/_shared/whatsappGeoCache.ts";

const cache = await import("../../supabase/functions/_shared/whatsappGeoCache.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260925000000_whatsapp_geo_cache.sql", "utf8");

const NOW = Date.parse("2026-08-25T10:30:00Z");

/** An in-memory store that records what it was asked to do. */
const memory = () => {
  const rows = new Map<string, unknown>();
  const calls = { read: 0, write: 0 };
  const store: GeoCacheStore = {
    read: async (key) => { calls.read++; return rows.has(key) ? rows.get(key) : null; },
    write: async (key, value) => { calls.write++; rows.set(key, value); },
  };
  return { store, rows, calls };
};

/** A store that is simply down. */
const broken: GeoCacheStore = {
  read: async () => { throw new Error("cache unreachable"); },
  write: async () => { throw new Error("cache unreachable"); },
};

// ── 1. Keys name a place, never a person ─────────────────────────────────────

describe("a cache key carries no person", () => {
  it("rounds a coordinate to a neighbourhood, not a doorway", () => {
    // Three decimals is about 110 m, so two points a few metres apart inside
    // the same cell share a key.
    const near = cache.reverseKey(31.95121, 35.92312, "ar");
    const alsoNear = cache.reverseKey(31.95134, 35.92338, "ar");
    expect(near).toBe(alsoNear);
    expect(near).toBe("reverse:31.951:35.923:ar");
  });

  it("is a grid, so two close points either side of a line differ — and that is fine", () => {
    // Worth stating rather than pretending otherwise: a grid has edges, and
    // neighbours across one simply miss. A miss costs a lookup, never an
    // answer, which is why the cache is allowed to be this crude.
    expect(cache.reverseKey(31.951, 35.92345, "ar"))
      .not.toBe(cache.reverseKey(31.951, 35.92351, "ar"));
  });

  it("keeps genuinely different places apart", () => {
    expect(cache.reverseKey(31.951, 35.923, "ar")).not.toBe(cache.reverseKey(31.961, 35.923, "ar"));
  });

  it("rounds symmetrically across zero", () => {
    // Naive Math.round sends -0.0005 and +0.0005 to different grids, which puts
    // two points either side of the equator in different cells for no reason.
    expect(cache.roundTo(-31.9515, 3)).toBe(-31.952);
    expect(cache.roundTo(31.9515, 3)).toBe(31.952);
    expect(cache.roundTo(-0.0005, 3)).toBe(-0.001);
    expect(cache.roundTo(0, 3)).toBe(0);
  });

  it("uses a coarser grid for weather, which does not vary street by street", () => {
    // Two decimals is about 1.1 km: points ~300 m apart inside one cell agree,
    // where the 110 m place grid would have separated them.
    expect(cache.weatherKey(31.9512, 35.9234, NOW)).toBe(cache.weatherKey(31.9538, 35.9241, NOW));
    expect(cache.reverseKey(31.9512, 35.9234, "ar")).not.toBe(cache.reverseKey(31.9538, 35.9241, "ar"));
    expect(cache.weatherKey(31.951, 35.923, NOW)).toContain("2026-08-25T10");
  });

  it("puts weather in its own hour, so an old forecast cannot be served", () => {
    const later = Date.parse("2026-08-25T11:00:00Z");
    expect(cache.weatherKey(31.951, 35.923, NOW)).not.toBe(cache.weatherKey(31.951, 35.923, later));
  });

  it("folds two spellings of a place name onto one key", () => {
    expect(cache.geocodeKey("Amman")).toBe(cache.geocodeKey("  amman  "));
    expect(cache.geocodeKey("عمّان")).toBe(cache.geocodeKey("عمان"));
    expect(cache.geocodeKey("New York")).toBe(cache.geocodeKey("new-york"));
  });

  it("bounds a key, so a long query cannot become a long row", () => {
    expect(cache.geocodeKey("x".repeat(5_000)).length).toBeLessThan(200);
  });

  it("carries nothing that identifies a sender", () => {
    const keys = [
      cache.reverseKey(31.951, 35.923, "ar"),
      cache.geocodeKey("Amman"),
      cache.nearbyKey(31.951, 35.923, "en", 1200),
      cache.weatherKey(31.951, 35.923, NOW),
    ];
    for (const key of keys) {
      expect(key).not.toMatch(/9627|\+\d{7,}/);   // no phone number
      expect(key).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // no conversation UUID
      expect(cache.isGeoKey(key), key).toBe(true);
    }
  });

  it("refuses a key that did not come from this module", () => {
    for (const bad of ["", "reverse", "DROP TABLE", "user:962790000000", "reverse:" + "x".repeat(400)]) {
      expect(cache.isGeoKey(bad), bad.slice(0, 20)).toBe(false);
    }
  });
});

// ── 2. The three rules ───────────────────────────────────────────────────────

describe("a cache that cannot break the lookup", () => {
  it("asks once, then answers from memory", async () => {
    const { store, calls } = memory();
    let fetched = 0;
    const fetcher = async () => { fetched++; return { city: "Amman" }; };

    const first = await cache.cached("reverse:31.951:35.923:ar", "reverse", store, fetcher);
    const second = await cache.cached("reverse:31.951:35.923:ar", "reverse", store, fetcher);

    expect(first.outcome).toBe("stored");
    expect(second.outcome).toBe("hit");
    expect(second.value).toEqual({ city: "Amman" });
    expect(fetched, "the service must be asked exactly once").toBe(1);
    expect(calls.write).toBe(1);
  });

  it("STILL ANSWERS when the cache is down", async () => {
    // The rule that matters most: a cache is an optimisation and must behave
    // like one. A broken store may cost the caching, never the answer.
    let fetched = 0;
    const result = await cache.cached("reverse:31.951:35.923:ar", "reverse", broken, async () => {
      fetched++;
      return { city: "Amman" };
    });
    expect(result.value).toEqual({ city: "Amman" });
    expect(result.outcome).toBe("unavailable");
    expect(fetched).toBe(1);
  });

  it("still answers when there is no store at all", async () => {
    const result = await cache.cached("reverse:31.951:35.923:ar", "reverse", null, async () => ({ city: "Amman" }));
    expect(result.value).toEqual({ city: "Amman" });
    expect(result.outcome).toBe("not_cacheable");
  });

  it("NEVER remembers a null answer", async () => {
    // `reverseGeocode` returns null when the service was unreachable. Caching
    // that for thirty days turns one bad minute into a month of wrong answers.
    const { store, rows, calls } = memory();
    const result = await cache.cached("reverse:31.951:35.923:ar", "reverse", store, async () => null);
    expect(result.value).toBeNull();
    expect(result.outcome).toBe("miss");
    expect(calls.write).toBe(0);
    expect(rows.size).toBe(0);
  });

  it("MUTATION: caching the null would have served it back", async () => {
    // Proof the rule is load-bearing. A store that *did* remember the null
    // returns it on the next call; the real one asks again and succeeds.
    const { store } = memory();
    let attempt = 0;
    const flaky = async () => (++attempt === 1 ? null : { city: "Amman" });

    const first = await cache.cached("reverse:31.951:35.923:ar", "reverse", store, flaky);
    const second = await cache.cached("reverse:31.951:35.923:ar", "reverse", store, flaky);
    expect(first.value).toBeNull();
    expect(second.value, "the transient failure must not have been remembered").toEqual({ city: "Amman" });
  });

  it("lets an upstream failure fail exactly as it does today", async () => {
    const { store } = memory();
    await expect(
      cache.cached("reverse:31.951:35.923:ar", "reverse", store, async () => { throw new Error("overpass down"); }),
    ).rejects.toThrow("overpass down");
  });

  it("bypasses the store for a key it does not recognise", async () => {
    const { store, calls } = memory();
    const result = await cache.cached("nonsense key", "reverse", store, async () => ({ city: "Amman" }));
    expect(result.outcome).toBe("not_cacheable");
    expect(calls.read).toBe(0);
    expect(calls.write).toBe(0);
  });

  it("keeps each kind on its own clock", () => {
    expect(cache.GEO_TTL_MS.weather).toBeLessThan(cache.GEO_TTL_MS.nearby);
    expect(cache.GEO_TTL_MS.nearby).toBeLessThan(cache.GEO_TTL_MS.reverse);
    // Weather never outlives its own hour bucket.
    expect(cache.GEO_TTL_MS.weather).toBeLessThanOrEqual(3_600_000);
  });

  it("does not remember an empty list either", async () => {
    // The rule above was written for `null` and the reasoning applies just as
    // well to `[]`: "nothing is around you" from a provider having a bad minute
    // was kept for the full seven days of the `nearby` TTL and repeated to
    // everybody standing in that neighbourhood. A blind sender told twice that
    // the pharmacy they are outside does not exist cannot tell it is the cache
    // talking, and a genuinely empty area costs only one extra lookup.
    const { store, rows, calls } = memory();

    const first = await cache.cached("nearby:31.951:35.923:ar:1200", "nearby", store, async () => []);
    expect(first.value).toEqual([]);
    expect(first.outcome).toBe("miss");
    expect(rows.size).toBe(0);
    expect(calls.write).toBe(0);

    // And the neighbourhood is asked again the next time somebody stands there.
    const second = await cache.cached(
      "nearby:31.951:35.923:ar:1200",
      "nearby",
      store,
      async () => [{ name: "صيدلية", category: "pharmacy", latitude: 31.951, longitude: 35.923 }],
    );
    expect(second.outcome).toBe("stored");
    expect(rows.size).toBe(1);
  });

  it("keys a nearby answer by the radius it was asked for", () => {
    // A list of what is within 500 m is not an answer to what is within 1200 m,
    // and for a week after the radius widened the shorter answer would have
    // been served to everybody standing there.
    expect(cache.nearbyKey(31.951, 35.923, "ar", 500))
      .not.toBe(cache.nearbyKey(31.951, 35.923, "ar", 1200));
  });
});

// ── 3. The table ─────────────────────────────────────────────────────────────

describe("the migration", () => {
  it("stores no user reference of any kind", () => {
    for (const forbidden of ["wa_phone", "conversation_id", "user_id", "REFERENCES public.whatsapp_conversations"]) {
      expect(migration, forbidden).not.toContain(forbidden);
    }
  });

  it("enables RLS with no policy, so only the service role reads it", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });

  it("is additive and safe to re-run", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS");
    for (const destructive of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "ALTER COLUMN"]) {
      expect(migration.toUpperCase(), destructive).not.toContain(destructive);
    }
  });

  it("can sweep what it stores", () => {
    expect(migration).toContain("sweep_whatsapp_geo_cache");
    expect(migration).toContain("expires_at < now()");
  });

  it("does not collide with an existing migration version", () => {
    const versions = readdirSync("supabase/migrations").map((f) => f.split("_")[0]);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

// ── 4. The production path ───────────────────────────────────────────────────

describe("the webhook uses it", () => {
  it("wraps every one of the four map lookups", () => {
    for (const call of ["reverseKey(", "geocodeKey(", "nearbyKey(", "weatherKey("]) {
      expect(webhook, call).toContain(call);
    }
    expect(webhook).toContain("geoStore");
  });

  it("logs an outcome and a kind, never a coordinate", () => {
    const lines = webhook.split(String.fromCharCode(10)).filter((l) => l.includes('log("geo'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, line.trim()).not.toMatch(/latitude|longitude|last_place/);
    }
  });
});
