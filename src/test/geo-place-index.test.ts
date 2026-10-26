import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { placeKey } from "../../supabase/functions/_shared/placeKey.ts";
import {
  countryName,
  lookupLocalPlace,
  type PlaceIndexClient,
} from "../../supabase/functions/_shared/whatsappPlaceIndex.ts";

// The site speaks twenty languages and its place lookup could not read Arabic.
// The index is matched on a key that every spelling of one place shares.

describe("placeKey", () => {
  it("meets across case, accents and width forms", () => {
    expect(placeKey("São Paulo")).toBe(placeKey("sao paulo"));
    expect(placeKey("Zürich")).toBe(placeKey("ZURICH"));
    expect(placeKey("Ｔｏｋｙｏ")).toBe("tokyo");
    expect(placeKey("Hà Nội")).toBe("ha noi");
  });

  it("treats the Arabic letters people mix up as one", () => {
    expect(placeKey("أبوظبي")).toBe(placeKey("ابوظبي"));
    expect(placeKey("إربد")).toBe(placeKey("اربد"));
    expect(placeKey("القاهرة")).toBe("القاهرة");
    expect(placeKey("بَيْرُوت")).toBe(placeKey("بيروت"));
  });

  it("keeps scripts apart and keeps non-Latin names intact", () => {
    for (const name of ["Москва", "東京", "서울", "تهران", "תל אביב", "इस्तांबुल", "Αθήνα", "กรุงเทพมหานคร"]) {
      expect(placeKey(name).length).toBeGreaterThan(0);
    }
    expect(placeKey("Москва")).not.toBe(placeKey("Moskva"));
  });

  it("folds punctuation and spacing and returns an empty key for nothing", () => {
    expect(placeKey("  Saint-Denis ")).toBe("saint denis");
    expect(placeKey("St. John's")).toBe("st john s");
    expect(placeKey("   ")).toBe("");
    expect(placeKey("!!!")).toBe("");
  });
});

function client(rows: Array<{ name: string; country_code: string | null; latitude: number; longitude: number }> | null, error: unknown = null) {
  const keys: string[] = [];
  const db: PlaceIndexClient = {
    rpc: (_fn, args) => { keys.push(args._key); return Promise.resolve({ data: rows, error }); },
  };
  return { db, keys };
}

describe("lookupLocalPlace", () => {
  it("answers from the index with the country in the sender's language", async () => {
    const { db, keys } = client([{ name: "Amman", country_code: "JO", latitude: 31.95, longitude: 35.93 }]);
    const place = await lookupLocalPlace(db, "عمّان", "en");
    expect(keys).toEqual([placeKey("عمّان")]);
    expect(place).toEqual({ latitude: 31.95, longitude: 35.93, name: "Amman", country: "Jordan" });
    expect((await lookupLocalPlace(db, "Amman", "ar"))?.country).toBe("الأردن");
  });

  it("is a miss, never an error, when the index has nothing, fails or throws", async () => {
    expect(await lookupLocalPlace(client([]).db, "Nowhere", "en")).toBeNull();
    expect(await lookupLocalPlace(client(null, { message: "x" }).db, "Amman", "en")).toBeNull();
    const throwing: PlaceIndexClient = { rpc: () => { throw new Error("down"); } };
    expect(await lookupLocalPlace(throwing, "Amman", "en")).toBeNull();
    expect(await lookupLocalPlace(client([]).db, "   ", "en")).toBeNull();
  });

  it("falls back to the code when the runtime has no name for the region", () => {
    expect(countryName(null, "en")).toBeNull();
    expect(countryName("jo", "fr")).toBe("Jordanie");
  });
});

describe("the wiring", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261091000000_geo_places.sql", "utf8");
  const loader = readFileSync("scripts/datahub/load-geonames.mjs", "utf8");

  it("tries the local index before either outside geocoder, at both call sites", () => {
    const local = [...webhook.matchAll(/lookupLocalPlace\(service\(\), /g)].length;
    expect(local).toBe(2);
    expect(webhook).toMatch(/lookupLocalPlace\(service\(\), placeRequest[^)]*\)\)\s*\?\?\s*geocodePlace\(placeRequest/);
  });

  it("keeps the index reachable only with the service role", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).toMatch(/REVOKE ALL ON public\.geo_places\s+FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON public\.geo_place_names\s+FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.lookup_geo_place\(text\) TO service_role/);
    expect(migration).toMatch(/SET search_path = public/);
  });

  it("fills the index with the very key function the lookup uses", () => {
    expect(loader).toContain('from "../../supabase/functions/_shared/placeKey.ts"');
    // It reports counts and nothing from the rows.
    expect([...loader.matchAll(/console.log(([^;]*));/g)].every((m) => /.length/.test(m[1]))).toBe(true);
  });
});
