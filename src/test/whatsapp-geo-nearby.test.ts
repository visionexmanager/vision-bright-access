// "What's near me" — the three reasons it answered with nothing.
//
// A sender shared a pin, was told correctly where they were, then asked what
// was around them and got nothing back. Three defects, each sufficient on its
// own:
//
//   1. the Overpass query asked for `node` only, so every pharmacy, bank and
//      clinic mapped as the *building* it occupies — a way — was invisible;
//   2. the radius was 500 m, which is a short walk in a city centre and nothing
//      at all in a suburb;
//   3. Overpass was the only provider, and it is a volunteer cluster reached
//      from a shared datacenter address, so being turned away is ordinary.
//
// A live run on 2026-09-05 caught the third in the act: Amman answered in seven
// seconds, and Riyadh, seconds later, was not answered by Overpass at all.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNearby } from "../../supabase/functions/_shared/whatsappGeo.ts";

const geo = readFileSync("supabase/functions/_shared/whatsappGeo.ts", "utf8");

const ORIGIN = { latitude: 31.9539, longitude: 35.9106 };

/** About 120 m north of the origin — comfortably inside any sane radius. */
const NEAR = { lat: 31.9550, lon: 35.9106 };
/** About 4 km away: outside the radius, and Photon returns these unasked. */
const FAR = { lat: 31.9900, lon: 35.9106 };

const responds = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 429, json: async () => body }) as unknown as Response;

const OVERPASS = "overpass-api.de";
const PHOTON = "photon.komoot.io";

/** An Overpass answer: a node, and a way that only `out center` gives a point. */
const overpassBody = {
  elements: [
    { lat: NEAR.lat, lon: NEAR.lon, tags: { amenity: "pharmacy", name: "صيدلية يعقوب" } },
    { center: { lat: NEAR.lat, lon: NEAR.lon }, tags: { amenity: "bank", name: "Arab Bank" } },
  ],
};

const photonBody = {
  features: [
    {
      properties: { osm_key: "amenity", osm_value: "clinic", name: "عيادة الدكتور" },
      geometry: { coordinates: [NEAR.lon, NEAR.lat] },
    },
  ],
};

function providers(answers: Record<string, () => Promise<Response>>) {
  const asked: string[] = [];
  const bodies: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push(new URL(url).host);
    bodies.push(typeof init?.body === "string" ? init.body : url);
    const answer = answers[new URL(url).host];
    if (!answer) throw new Error("unexpected host");
    return await answer();
  }));
  return { asked, bodies };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Overpass query", () => {
  it("asks for ways and relations, not only nodes", async () => {
    // The defect that hid most of the map. A probe in Amman found 16 amenities
    // as nodes and 23 with ways included; where buildings were imported
    // wholesale the node-only answer is close to empty.
    const { bodies } = providers({
      [OVERPASS]: async () => responds(overpassBody),
      [PHOTON]: async () => responds(photonBody),
    });

    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    const query = decodeURIComponent(bodies.find((b) => b.startsWith("data=")) ?? "");
    expect(query).toContain("nwr(around:");
    expect(query).toContain("out center");
  });

  it("reads a way's centre as its position", async () => {
    providers({
      [OVERPASS]: async () => responds(overpassBody),
      [PHOTON]: async () => responds({ features: [] }),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    // The bank exists only as `center`. Reading `lat`/`lon` alone drops it.
    expect(places?.map((p) => p.name)).toContain("Arab Bank");
  });

  it("looks further than a single street", () => {
    // 500 m told a sender standing outside their own pharmacy that nothing was
    // mapped near them.
    expect(geo).toContain("const NEARBY_RADIUS_M = 1_200;");
  });
});

describe("nearby survives Overpass being busy", () => {
  it("answers from Photon when Overpass refuses", async () => {
    const { asked } = providers({
      [OVERPASS]: async () => responds({}, false),
      [PHOTON]: async () => responds(photonBody),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(places?.map((p) => p.name)).toEqual(["عيادة الدكتور"]);
    expect(asked.sort()).toEqual([OVERPASS, PHOTON]);
  });

  it("answers from Photon when Overpass answers with nothing", async () => {
    // An empty answer from a strained service is indistinguishable from an
    // empty neighbourhood, and only one of those is true.
    providers({
      [OVERPASS]: async () => responds({ elements: [] }),
      [PHOTON]: async () => responds(photonBody),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(places).toHaveLength(1);
  });

  it("prefers Overpass where both answer, for its language tags", async () => {
    providers({
      [OVERPASS]: async () => responds(overpassBody),
      [PHOTON]: async () => responds(photonBody),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(places?.map((p) => p.name)).not.toContain("عيادة الدكتور");
    expect(places?.map((p) => p.name)).toContain("صيدلية يعقوب");
  });

  it("asks both at once rather than one after the other", () => {
    // Sequentially the fallback costs a second wait on top of the first one's
    // timeout, and somebody is holding a phone.
    expect(geo).toMatch(/await Promise\.all\(\[\s*nearbyViaOverpass/);
  });

  it("still separates a failed lookup from an empty neighbourhood", async () => {
    providers({
      [OVERPASS]: async () => responds({}, false),
      [PHOTON]: async () => responds({}, false),
    });
    expect(await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar")).toBeNull();

    vi.unstubAllGlobals();
    providers({
      [OVERPASS]: async () => responds({ elements: [] }),
      [PHOTON]: async () => responds({ features: [] }),
    });
    expect(await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar")).toEqual([]);
  });
});

describe("what reaches the sender", () => {
  it("drops a category the interface has no word for", async () => {
    // Photon is asked broadly because it cannot be asked precisely. Without the
    // filter, "alcohol" is read aloud in the middle of an Arabic sentence.
    providers({
      [OVERPASS]: async () => responds({ elements: [] }),
      [PHOTON]: async () => responds({
        features: [
          {
            properties: { osm_key: "shop", osm_value: "alcohol", name: "Shadi" },
            geometry: { coordinates: [NEAR.lon, NEAR.lat] },
          },
          {
            properties: { osm_key: "amenity", osm_value: "pharmacy", name: "صيدلية" },
            geometry: { coordinates: [NEAR.lon, NEAR.lat] },
          },
        ],
      }),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(places?.map((p) => p.name)).toEqual(["صيدلية"]);
  });

  it("drops anything past the radius it asked for", async () => {
    // Photon treats its radius as a hint, and a "near me" list that reaches
    // into the next district is not one.
    providers({
      [OVERPASS]: async () => responds({ elements: [] }),
      [PHOTON]: async () => responds({
        features: [
          {
            properties: { osm_key: "amenity", osm_value: "bank", name: "Far Bank" },
            geometry: { coordinates: [FAR.lon, FAR.lat] },
          },
        ],
      }),
    });

    expect(await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar")).toEqual([]);
  });

  it("reads a name in the sender's language when OpenStreetMap has one", async () => {
    providers({
      [OVERPASS]: async () => responds({
        elements: [{
          lat: NEAR.lat,
          lon: NEAR.lon,
          tags: { amenity: "cafe", name: "Rumi Cafe", "name:ar": "مقهى الرومي" },
        }],
      }),
      [PHOTON]: async () => responds({ features: [] }),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(places?.[0].name).toBe("مقهى الرومي");
  });

  it("puts the nearest first and keeps one entry per chain", async () => {
    const branch = (name: string, lat: number) => ({
      lat, lon: NEAR.lon, tags: { amenity: "bank" as const, name },
    });
    providers({
      [OVERPASS]: async () => responds({
        elements: [
          branch("Arab Bank", 31.9600),
          branch("Arab Bank", 31.9545),
          branch("Housing Bank", 31.9542),
        ],
      }),
      [PHOTON]: async () => responds({ features: [] }),
    });

    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "en");

    expect(places?.map((p) => p.name)).toEqual(["Housing Bank", "Arab Bank"]);
  });
});
