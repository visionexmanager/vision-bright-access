// A pin that cannot be named is still a pin.
//
// Reverse geocoding had one provider, so one provider having a bad afternoon
// answered a shared location with "the map service isn't responding right now"
// — and threw the coordinates away with it, which took the weather and the
// "what's near me" questions down for the next six hours too. For a blind
// sender a pin is two taps and no aiming; it is the cheapest input this channel
// has, and it was the one with no second route.
//
// These cover the two halves of the fix: the lookup tries three independent
// services, and the webhook keeps the coordinates whatever they say.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reverseGeocode } from "../../supabase/functions/_shared/whatsappGeo.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const AMMAN = { latitude: 31.9539, longitude: 35.9106 };

/** A JSON response, or a refusal. */
const responds = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response;

const dead = () => Promise.reject(new Error("network unreachable"));

const BIG_DATA_CLOUD = {
  locality: "عَمَّان",
  city: "عَمَّان",
  principalSubdivision: "محافظة عمان",
  countryName: "الأردن",
};

const NOMINATIM = {
  address: { suburb: "منطقة زهران", city: "عمان", state: "عمان", country: "الأردن" },
};

const PHOTON = {
  features: [{ properties: { district: "Zahran", city: "Amman", state: "Amman", country: "Jordan" } }],
};

/**
 * Answers by host, and records the order it was asked in.
 *
 * Keyed on the hostname rather than the whole URL on purpose: which query
 * parameters each service wants is its own business, and a test that pins them
 * would fail the next time one is corrected.
 */
function providers(answers: Record<string, () => Promise<Response>>) {
  const asked: string[] = [];
  const urls: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const host = new URL(url).host;
    asked.push(host);
    urls.push(url);
    const answer = answers[host];
    if (!answer) throw new Error(`unexpected host ${host}`);
    return await answer();
  });
  vi.stubGlobal("fetch", fetcher);
  return { asked, urls };
}

const BDC = "api.bigdatacloud.net";
const OSM = "nominatim.openstreetmap.org";
const PHO = "photon.komoot.io";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reverse geocoding survives a provider going down", () => {
  it("answers from the first service and asks no others", async () => {
    const { asked } = providers({ [BDC]: async () => responds(BIG_DATA_CLOUD) });

    const place = await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar");

    expect(place?.city).toBe("عَمَّان");
    expect(asked).toEqual([BDC]);
  });

  it("falls through to OpenStreetMap when the first service refuses", async () => {
    const { asked } = providers({
      [BDC]: async () => responds({}, false),
      [OSM]: async () => responds(NOMINATIM),
    });

    const place = await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar");

    expect(place).toEqual({
      locality: "منطقة زهران",
      city: "عمان",
      region: "عمان",
      country: "الأردن",
    });
    expect(asked).toEqual([BDC, OSM]);
  });

  it("treats a 200 that names nowhere as a refusal", async () => {
    // The failure that started this: a free client endpoint being called from a
    // datacenter answers `200` with a body explaining itself and no place in
    // it. Reading that as success sends a heading with nothing under it.
    const { asked } = providers({
      [BDC]: async () => responds({ status: 403, description: "client-side use only" }),
      [OSM]: async () => responds(NOMINATIM),
    });

    const place = await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar");

    expect(place?.city).toBe("عمان");
    expect(asked).toEqual([BDC, OSM]);
  });

  it("reaches the third service when both OpenStreetMap and the first are down", async () => {
    const { asked } = providers({
      [BDC]: dead,
      [OSM]: dead,
      [PHO]: async () => responds(PHOTON),
    });

    const place = await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar");

    expect(place?.city).toBe("Amman");
    expect(asked).toEqual([BDC, OSM, PHO]);
  });

  it("gives up only when all three have been asked", async () => {
    const { asked } = providers({ [BDC]: dead, [OSM]: dead, [PHO]: dead });

    expect(await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar")).toBeNull();
    expect(asked).toEqual([BDC, OSM, PHO]);
  });

  it("asks each service in the sender's language", async () => {
    const { urls } = providers({ [BDC]: dead, [OSM]: dead, [PHO]: dead });

    await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "ar");

    expect(urls[0]).toContain("localityLanguage=ar");
    expect(urls[1]).toContain("accept-language=ar");
    // Photon localises four languages; the rest read better in English than in
    // a language code it will ignore.
    expect(urls[2]).toContain("lang=en");
  });

  it("sends the coordinate and nothing else that could name a person", async () => {
    const { urls } = providers({ [BDC]: dead, [OSM]: dead, [PHO]: dead });

    await reverseGeocode(AMMAN.latitude, AMMAN.longitude, "de");

    for (const url of urls) {
      const query = new URL(url).searchParams;
      for (const [key, value] of query) {
        expect(["lat", "latitude", "lon", "longitude", "format", "zoom", "addressdetails",
          "accept-language", "localityLanguage", "lang"], key).toContain(key);
        expect(value).not.toMatch(/@|\+\d{6}/);
      }
    }
  });
});

describe("the webhook keeps a pin it could not name", () => {
  it("no longer abandons the shared location when the lookup fails", () => {
    // The old branch was `if (!place) { reply(geocodeUnavailable); continue; }`
    // directly above the row update, so a naming failure skipped the write.
    const pinBranch = webhook.slice(
      webhook.indexOf("if (incoming.location) {"),
      webhook.indexOf("if (incoming.media) {"),
    );
    expect(pinBranch).toContain("last_latitude");
    expect(pinBranch).not.toContain("geocodeUnavailableNotice");
  });

  it("still tells the sender when nothing nearby could be looked up", () => {
    // `null` from Overpass has no substitute — unlike a name, there is nothing
    // truthful to say in its place — so that notice stays.
    expect(webhook).toContain("geocodeUnavailableNotice");
  });
});
