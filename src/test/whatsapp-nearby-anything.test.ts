// "Anything near me" — not only a pharmacy or a hospital.
//
// A sender asked for a school near the pin they had shared and was answered
// with the general list. The map could always find a school; what was missing
// was reading "أقرب مدرسة", "في جامعة قريبة مني؟" or "hotels near me" for the
// thing they named, and a way to look for things no category table names.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  categoryLabel,
  formatNearby,
  NEARBY_CATEGORIES,
  parseNearbyRequest,
} from "../../supabase/functions/_shared/whatsappLocation.ts";
import { fetchNearby, searchNearby, SEARCH_RADIUS_M } from "../../supabase/functions/_shared/whatsappGeo.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

type Expected = { category: string | null; query: string | null } | null;

describe("reading what a nearby question asks for", () => {
  const cases: Array<[string, string, Expected]> = [
    ["أقرب مدرسة", "ar", { category: "school", query: null }],
    ["وين أقرب مدرسة؟", "ar", { category: "school", query: null }],
    ["في مدرسة قريبة مني؟", "ar", { category: "school", query: null }],
    ["بدي فندق قريب", "ar", { category: "hotel", query: null }],
    ["أقرب جامعة", "ar", { category: "university", query: null }],
    ["دلني على أقرب حديقة", "ar", { category: "park", query: null }],
    ["وين أقرب محل ألعاب", "ar", { category: null, query: "محل ألعاب" }],
    ["أقرب مسجد", "ar", { category: null, query: "مسجد" }],
    ["شو حولي", "ar", { category: null, query: null }],
    ["شو في حولي؟", "ar", { category: null, query: null }],
    ["مدرسة", "ar", { category: "school", query: null }],
    ["nearest university", "en", { category: "university", query: null }],
    ["is there a hotel near me?", "en", { category: "hotel", query: null }],
    ["toy shop nearby", "en", { category: null, query: "toy shop" }],
    ["what's near me", "en", { category: null, query: null }],
    ["gym", "en", { category: "fitness_centre", query: null }],
  ];
  for (const [text, language, expected] of cases) {
    it(`${text} → ${JSON.stringify(expected)}`, () => {
      expect(parseNearbyRequest(text, language as never)).toEqual(expected);
    });
  }

  it("leaves questions that are not about a place to the assistant", () => {
    for (const text of [
      "أقرب طريقة لتعلم البرمجة",
      "مدرسة ابني بعيدة",
      "what is the closest time for an appointment",
      "the nearest way to learn english",
      "كيف حالك",
      "أقرب موعد عند الدكتور",
    ]) {
      expect(parseNearbyRequest(text, "ar"), text).toBeNull();
    }
  });

  it("reads other languages through their own proximity phrases", () => {
    expect(parseNearbyRequest("universidad más cercana", "es")).toEqual({ category: "university", query: null });
    expect(parseNearbyRequest("Hotel in meiner Nähe", "de")).toEqual({ category: "hotel", query: null });
    expect(parseNearbyRequest("Spielwarenladen in meiner Nähe", "de")).toEqual({ category: null, query: "Spielwarenladen" });
  });

  it("names every category in all twenty languages", () => {
    for (const category of Object.keys(NEARBY_CATEGORIES)) {
      for (const language of SUPPORTED_LANGUAGES) {
        const label = categoryLabel(category, language);
        expect(label, `${category}/${language}`).not.toMatch(/^cat[A-Z]/);
        expect(label.trim().length, `${category}/${language}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("the answer carries the sender's own words", () => {
  it("labels a free-search result with what was asked for", () => {
    const text = formatNearby({
      language: "ar",
      origin: { latitude: 31.95, longitude: 35.91 },
      places: [{ name: "ألعاب سمسم", category: "toys", latitude: 31.951, longitude: 35.91, label: "محل ألعاب" }],
    });
    expect(text).toContain("ألعاب سمسم");
    expect(text).toContain("محل ألعاب");
    expect(text).not.toContain("toys");
  });
});

describe("the map lookups", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const ORIGIN = { latitude: 31.9539, longitude: 35.9106 };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

  it("asks both providers for exactly the category, under its own map key", async () => {
    const urls: string[] = [];
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(String(url));
      if (init?.body) bodies.push(decodeURIComponent(String(init.body)));
      return ok(String(url).includes("photon") ? { features: [] } : { elements: [] });
    }));
    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", "university");
    expect(bodies.join(" ")).toContain('["amenity"~"^(university)$"]');
    expect(urls.find((u) => u.includes("photon"))).toContain("osm_tag=amenity:university");

    urls.length = 0;
    bodies.length = 0;
    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", "hotel");
    expect(bodies.join(" ")).toContain('["tourism"~"^(hotel)$"]');
    expect(urls.find((u) => u.includes("photon"))).toContain("osm_tag=tourism:hotel");
  });

  it("describes a neighbourhood with a few of each kind rather than eight restaurants", async () => {
    const near = (i: number) => ({ lat: ORIGIN.latitude + 0.0001 * (i + 1), lon: ORIGIN.longitude });
    const elements = [
      ...Array.from({ length: 6 }, (_, i) => ({ ...near(i), tags: { amenity: "restaurant", name: `R${i}` } })),
      { ...near(7), tags: { amenity: "school", name: "School" } },
      { ...near(8), tags: { leisure: "park", name: "Park" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      ok(String(url).includes("photon") ? { features: [] } : { elements })));
    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", null);
    expect(places?.filter((p) => p.category === "restaurant")).toHaveLength(2);
    expect(places?.map((p) => p.category)).toEqual(expect.arrayContaining(["school", "park"]));
  });

  it("searches anything by name inside a box around the pin, nearest first, labelled with the words asked", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      if (String(url).includes("nominatim")) {
        return ok([
          { lat: "31.9700", lon: "35.9106", name: "Far toys", type: "toys" },
          { lat: "31.9545", lon: "35.9106", name: "Near toys", type: "toys" },
          { lat: "32.5000", lon: "35.9106", name: "Out of range", type: "toys" },
        ]);
      }
      return ok({ features: [] });
    }));
    const found = await searchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", "محل ألعاب");
    expect(found?.map((p) => p.name)).toEqual(["Near toys", "Far toys"]);
    expect(found?.every((p) => p.label === "محل ألعاب")).toBe(true);
    const nominatim = urls.find((u) => u.includes("nominatim"))!;
    expect(nominatim).toContain("bounded=1");
    expect(nominatim).toContain("viewbox=");
    expect(nominatim).toContain(encodeURIComponent("محل ألعاب"));
    expect(SEARCH_RADIUS_M).toBeGreaterThanOrEqual(3000);
  });

  it("uses Photon when Nominatim is busy, and tells nobody-answered from nothing-found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("nominatim")) return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
      return ok({
        features: [
          { properties: { osm_key: "highway", osm_value: "residential", name: "Hotel Street" }, geometry: { coordinates: [35.9106, 31.9541] } },
          { properties: { osm_key: "tourism", osm_value: "hotel", name: "Le Royal" }, geometry: { coordinates: [35.9106, 31.9560] } },
        ],
      });
    }));
    const found = await searchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", "hotel");
    expect(found?.map((p) => p.name)).toEqual(["Le Royal"]);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await searchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", "hotel")).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async (url: string) => ok(String(url).includes("nominatim") ? [] : { features: [] })));
    expect(await searchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", "hotel")).toEqual([]);
  });
});
