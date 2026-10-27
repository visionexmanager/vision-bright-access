import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  NEAREST_CITY_MAX_KM,
  nearestLocalCity,
  type PlaceIndexClient,
} from "../../supabase/functions/_shared/whatsappPlaceIndex.ts";

function client(rows: Array<{ label: string; country_code: string | null; distance_km: number }> | null, error: unknown = null) {
  const calls: unknown[] = [];
  const db = {
    rpc: (fn: string, args: unknown) => { calls.push([fn, args]); return Promise.resolve({ data: rows, error }); },
  } as unknown as PlaceIndexClient;
  return { db, calls };
}

describe("nearestLocalCity", () => {
  it("names the city in the sender's language and carries no coordinates back", async () => {
    const { db, calls } = client([{ label: "عمّان", country_code: "JO", distance_km: 3.2 }]);
    const place = await nearestLocalCity(db, 31.95, 35.93, "ar");
    expect(place).toEqual({ locality: null, city: "عمّان", region: null, country: "الأردن" });
    expect(calls).toEqual([["nearest_geo_place", { _latitude: 31.95, _longitude: 35.93, _lang: "ar", _max_km: NEAREST_CITY_MAX_KM }]]);
    expect(JSON.stringify(place)).not.toContain("31.95");
  });

  it("asks only for cities close enough to describe where somebody is", () => {
    expect(NEAREST_CITY_MAX_KM).toBeLessThanOrEqual(30);
  });

  it("is a miss, never an error, when nothing is near, the call fails or throws", async () => {
    expect(await nearestLocalCity(client([]).db, 0, 0, "en")).toBeNull();
    expect(await nearestLocalCity(client(null, { message: "x" }).db, 31, 35, "en")).toBeNull();
    const throwing = { rpc: () => { throw new Error("down"); } } as unknown as PlaceIndexClient;
    expect(await nearestLocalCity(throwing, 31, 35, "en")).toBeNull();
  });

  it("refuses coordinates that cannot exist without asking the database", async () => {
    const { db, calls } = client([{ label: "x", country_code: null, distance_km: 1 }]);
    for (const [lat, lon] of [[91, 0], [0, 181], [Number.NaN, 5], [5, Number.POSITIVE_INFINITY]]) {
      expect(await nearestLocalCity(db, lat, lon, "en")).toBeNull();
    }
    expect(calls).toEqual([]);
  });
});

describe("the wiring", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261092000000_geo_nearest_place.sql", "utf8");
  const loader = readFileSync("scripts/datahub/load-geonames-alternates.mjs", "utf8");

  it("asks the local index first for the weather line, with a cache entry of its own", () => {
    expect(webhook).toMatch(/\}:city`,\s*"reverse",\s*async \(\) => \(await nearestLocalCity\(service\(\), latitude, longitude, answerLanguage\)\)\s*\?\? reverseGeocode\(/);
  });

  it("uses it only as the last resort where a pin wants the district", () => {
    const fallbacks = [...webhook.matchAll(/\(await reverseGeocode\([^)]*\)\)\s*\?\? nearestLocalCity\(service\(\)/g)];
    expect(fallbacks.length).toBe(2);
  });

  it("keeps the labels and the function reachable only with the service role", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).toMatch(/REVOKE ALL ON public\.geo_place_labels FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.nearest_geo_place\([^)]*\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.nearest_geo_place\([^)]*\) TO service_role/);
    expect(migration).toMatch(/SET search_path = public/);
  });

  it("leaves districts out: the feature code is stored and the lookup skips city sections", () => {
    const fix = readFileSync("supabase/migrations/20261093000000_geo_places_feature_code.sql", "utf8");
    expect(fix).toMatch(/ADD COLUMN IF NOT EXISTS feature_code text/);
    expect(fix).toContain("coalesce(p.feature_code, '') <> 'PPLX'");
    expect(fix).toMatch(/GRANT EXECUTE ON FUNCTION public\.nearest_geo_place\([^)]*\) TO service_role/);
    expect(fix).toMatch(/REVOKE ALL ON FUNCTION public\.nearest_geo_place\([^)]*\) FROM PUBLIC, anon, authenticated/);
    expect(readFileSync("scripts/datahub/load-geonames.mjs", "utf8")).toContain("feature_code: c[7]");
  });

  it("prefers the populous city within 15 km over a nearer neighbourhood, and keeps the grants", () => {
    const rule = readFileSync("supabase/migrations/20261094000000_nearest_city_prefers_large.sql", "utf8");
    expect(rule).toContain("ORDER BY (n.km <= 15) DESC");
    expect(rule).toContain("CASE WHEN n.km <= 15 THEN n.population END DESC NULLS LAST");
    expect(rule).toMatch(/REVOKE ALL ON FUNCTION public\.nearest_geo_place\([^)]*\) FROM PUBLIC, anon, authenticated/);
    expect(rule).toMatch(/GRANT EXECUTE ON FUNCTION public\.nearest_geo_place\([^)]*\) TO service_role/);
    expect(rule).toMatch(/SET search_path = public/);
  });

  it("loads one display name per place and language, preferring the preferred one", () => {
    expect(loader).toContain("geo_place_labels");
    expect(loader).toMatch(/c\[4\] === "1" \? 0/);
  });
});
