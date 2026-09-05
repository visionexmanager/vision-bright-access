// Asking for a pharmacy, and being taken to one.
//
// A sender asked for a pharmacy and the assistant offered directions it had no
// way to give. Two gaps behind one sentence:
//
//   1. "صيدلية" on its own matched no location pattern at all, so the message
//      reached the model — which then promised a capability the system has;
//   2. the nearby answer was a paragraph of bullets, so even when it worked,
//      knowing a pharmacy was 300 m north-east of you was the end of it.
//
// Both are the same shape of failure: the system knew the answer and had no way
// to hand it over. A tap now sends the place's own location message, which the
// sender's maps application navigates from — the only kind of "directions" this
// channel can honestly offer.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatNearby,
  NEARBY_CATEGORIES,
  nearbyRowSubtitle,
  parseNearbyCategory,
  parsePlaceSelection,
  placeRowId,
} from "../../supabase/functions/_shared/whatsappLocation.ts";
import { fetchNearby } from "../../supabase/functions/_shared/whatsappGeo.ts";
import { nearbyMessage } from "../../supabase/functions/_shared/whatsappInteractive.ts";
import { nearbyKey } from "../../supabase/functions/_shared/whatsappGeoCache.ts";
import { say } from "../../supabase/functions/_shared/whatsappStrings.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const ORIGIN = { latitude: 31.9539, longitude: 35.9106 };
const NEAR = { lat: 31.9550, lon: 35.9106 };

// ── 1. One word is a request ─────────────────────────────────────────────────

describe("naming a category on its own", () => {
  it("reads a bare category as a request for the nearest one", () => {
    expect(parseNearbyCategory("صيدلية", "ar")).toBe("pharmacy");
    expect(parseNearbyCategory("pharmacy", "en")).toBe("pharmacy");
    expect(parseNearbyCategory("bank", "en")).toBe("bank");
    expect(parseNearbyCategory("مطعم", "ar")).toBe("restaurant");
  });

  it("allows one leading word that means 'nearest', and no more", () => {
    expect(parseNearbyCategory("أقرب صيدلية", "ar")).toBe("pharmacy");
    expect(parseNearbyCategory("nearest pharmacy", "en")).toBe("pharmacy");
    // Two words in front is a sentence, and a sentence about a pharmacy is not
    // a request for the nearest one.
    expect(parseNearbyCategory("please find pharmacy", "en")).toBeNull();
  });

  it("leaves a real question to the assistant, which is its owner", () => {
    for (const [text, language] of [
      ["صيدلية الدواء مفتوحة لحد امتى", "ar"],
      ["is the pharmacy on my street open on Fridays", "en"],
      ["مرحبا", "ar"],
      ["", "en"],
    ] as const) {
      expect(parseNearbyCategory(text, language), text).toBeNull();
    }
  });

  it("understands every category in every language, and confuses none of them", () => {
    // The vocabulary is free: `NEARBY_CATEGORIES` already names each category
    // in all twenty, because those are the words the results print with. This
    // is that list read backwards, and it also catches the real hazard — two
    // categories whose names collide in some language.
    for (const language of SUPPORTED_LANGUAGES) {
      for (const [category, key] of Object.entries(NEARBY_CATEGORIES)) {
        const word = say(key, language);
        expect(parseNearbyCategory(word, language), `${language}: ${word}`).toBe(category);
      }
    }
  });

  it("falls back to Arabic and English, which every keyboard offers", () => {
    // A German sender whose phone is typing in English still gets an answer.
    expect(parseNearbyCategory("pharmacy", "de")).toBe("pharmacy");
    expect(parseNearbyCategory("صيدلية", "de")).toBe("pharmacy");
    expect(parseNearbyCategory("Apotheke", "de")).toBe("pharmacy");
  });
});

// ── 2. A place you can tap ───────────────────────────────────────────────────

describe("a row that carries a destination", () => {
  it("round-trips a coordinate exactly", () => {
    const place = { latitude: 31.953952, longitude: 35.911276 };
    expect(parsePlaceSelection(placeRowId(place))).toEqual(place);
  });

  it("validates an id like any other input, because it came back from a client", () => {
    for (const id of [
      "services.weather", "main_menu", "", null, undefined,
      "place:abc,def",
      "place:0,0",          // Null Island: what a broken GPS reports
      "place:91,35",        // off the planet
      "place:31.95",        // half a coordinate
    ]) {
      expect(parsePlaceSelection(id), String(id)).toBeNull();
    }
  });

  it("says how far and which way under each name", () => {
    const subtitle = nearbyRowSubtitle({
      language: "ar",
      origin: ORIGIN,
      place: { name: "صيدلية يعقوب", category: "pharmacy", latitude: NEAR.lat, longitude: NEAR.lon },
    });
    // The distance decides whether somebody walks or calls a taxi, so it has to
    // be heard before the tap rather than after it.
    expect(subtitle).toContain(say("catPharmacy", "ar"));
    expect(subtitle).toMatch(/\d/);
  });
});

// ── 3. The list itself ───────────────────────────────────────────────────────

const rowsOf = (places: Array<{ id: string; title: string; description: string }>) => {
  const message = nearbyMessage({ language: "ar", heading: "أقرب الأماكن", places });
  if (!message || message.interactive.type !== "list") return null;
  return message.interactive.action.sections[0].rows.map((r) => r.id);
};

const fakePlace = (n: number) => ({
  id: placeRowId({ latitude: 31.95 + n / 10000, longitude: 35.91 }),
  title: `place ${n}`,
  description: "pharmacy — 100 m east",
});

describe("what is around you, as places you can tap", () => {
  it("puts every place on its own row, with the way out under them", () => {
    const ids = rowsOf([1, 2, 3].map(fakePlace));
    expect(ids?.slice(-2)).toEqual(["back", "main_menu"]);
    expect(ids).toHaveLength(5);
  });

  it("never exceeds Meta's ten rows, controls included", () => {
    const ids = rowsOf(Array.from({ length: 20 }, (_, i) => fakePlace(i)));
    expect(ids).toHaveLength(10);
    expect(ids?.slice(-2)).toEqual(["back", "main_menu"]);
  });

  it("offers nothing rather than an empty list", () => {
    expect(nearbyMessage({ language: "ar", heading: "h", places: [] })).toBeNull();
  });

  it("still says the same thing in words, for voice and for a refused list", () => {
    const message = nearbyMessage({ language: "ar", heading: "أقرب الأماكن", places: [fakePlace(1)] });
    expect(message?.text).toContain("place 1");
    expect(message?.text).toContain(say("back", "ar"));
  });
});

// ── 4. Asking the map for one category ───────────────────────────────────────

const responds = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const pharmacyAndBank = {
  elements: [
    { lat: NEAR.lat, lon: NEAR.lon, tags: { amenity: "pharmacy", name: "صيدلية" } },
    { lat: NEAR.lat, lon: NEAR.lon, tags: { amenity: "bank", name: "بنك" } },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("a category narrows the question, not the answer", () => {
  it("asks Overpass for that category alone", async () => {
    // Filtering afterwards would be wrong, not merely wasteful: a list capped
    // at the eight nearest of *everything* hands somebody who asked for a
    // chemist the restaurants across the road and nothing else.
    let query = "";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("overpass")) query = decodeURIComponent(String(init?.body ?? ""));
      return responds(String(input).includes("overpass") ? pharmacyAndBank : { features: [] });
    }));

    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", "pharmacy");

    expect(query).toContain('"amenity"~"^(pharmacy)$"');
    expect(query).not.toContain("restaurant");
    // Nothing is asked of the tags a pharmacy cannot be.
    expect(query).not.toContain("bus_stop");
    expect(query).not.toContain('"shop"');
  });

  it("keeps the promise even when a provider cannot be asked precisely", async () => {
    // Photon filters on the tag key, not its value, so it answers with every
    // amenity nearby. A request for a pharmacy must still return pharmacies.
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      responds(String(input).includes("overpass") ? { elements: [] } : {
        features: [
          {
            properties: { osm_key: "amenity", osm_value: "bank", name: "بنك" },
            geometry: { coordinates: [NEAR.lon, NEAR.lat] },
          },
          {
            properties: { osm_key: "amenity", osm_value: "pharmacy", name: "صيدلية" },
            geometry: { coordinates: [NEAR.lon, NEAR.lat] },
          },
        ],
      })));

    const found = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", "pharmacy");

    expect(found?.map((p) => p.category)).toEqual(["pharmacy"]);
  });

  it("asks for everything when no category was named", async () => {
    let query = "";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("overpass")) query = decodeURIComponent(String(init?.body ?? ""));
      return responds(String(input).includes("overpass") ? pharmacyAndBank : { features: [] });
    }));

    const found = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar");

    expect(query).toContain("bus_stop");
    expect(found?.map((p) => p.category).sort()).toEqual(["bank", "pharmacy"]);
  });

  it("does not serve one category's answer for another", () => {
    // Seven days of "there are no pharmacies here" because somebody asked for
    // restaurants first is the cache failure this feature already learned once.
    expect(nearbyKey(31.951, 35.923, "ar", 1200, "pharmacy"))
      .not.toBe(nearbyKey(31.951, 35.923, "ar", 1200, "bank"));
    expect(nearbyKey(31.951, 35.923, "ar", 1200, "pharmacy"))
      .not.toBe(nearbyKey(31.951, 35.923, "ar", 1200, null));
  });
});

// ── 5. The webhook completes the task ────────────────────────────────────────

describe("the webhook finishes what it started", () => {
  const nearbyBranch = webhook.slice(
    webhook.indexOf("// One word is a request."),
    webhook.indexOf("// ── IVX — learning"),
  );

  it("answers a bare category as a nearby request", () => {
    expect(nearbyBranch).toContain("parseNearbyCategory(questionText, answerLanguage)");
    expect(nearbyBranch).toContain("const asksNearby = nearbyCategory !== null");
  });

  it("sends the places as rows and not only as bullets", () => {
    expect(nearbyBranch).toContain("nearbyMessage({");
    expect(nearbyBranch).toContain("placeRowId(found)");
    expect(nearbyBranch).toContain("sendChoices(list,");
  });

  it("sends the pin when one of them is tapped", () => {
    expect(nearbyBranch).toContain("parsePlaceSelection(incoming.selection)");
    expect(nearbyBranch).toContain("sendWhatsAppLocation({");
  });

  it("stands down while a person owns the conversation", () => {
    expect(nearbyBranch).toContain("asksNearby && !humanOwnsThis && !aiFocused");
    expect(nearbyBranch).toContain("humanOwnsThis ? null : parsePlaceSelection");
  });

  it("keeps the bullets, which are what a voice sender hears", () => {
    expect(nearbyBranch).toContain("formatNearby({");
    // And they still say something truthful when the area really is unmapped.
    expect(formatNearby({ language: "en", origin: ORIGIN, places: [] }))
      .toMatch(/couldn't find anything mapped/i);
  });
});
