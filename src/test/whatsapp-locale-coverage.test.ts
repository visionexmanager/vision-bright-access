// Every sentence the assistant composes, rendered in all twenty languages.
//
// The suite already asserts that each key *exists* in twenty. This asserts the
// harder half: that what comes out of the formatters is a finished sentence in
// the sender's language — no `{placeholder}` left standing, no English block
// wedged into a Turkish conversation, and no template whose translation
// silently dropped the number it was supposed to carry.
//
// It exists because the formatters were the last thing here written for two
// languages. A missing refusal leaves somebody stuck; a half-translated
// forecast is quieter and, for a screen-reader user, just as unusable.

import { describe, expect, it } from "vitest";

const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const weather = await import("../../supabase/functions/_shared/whatsappWeather.ts");
const location = await import("../../supabase/functions/_shared/whatsappLocation.ts");
const bazaar = await import("../../supabase/functions/_shared/whatsappBazaar.ts");
const vision = await import("../../supabase/functions/_shared/whatsappVisionModes.ts");
const preferences = await import("../../supabase/functions/_shared/whatsappPreferences.ts");
const barcode = await import("../../supabase/functions/_shared/whatsappBarcode.ts");
const identity = await import("../../supabase/functions/_shared/whatsappIdentity.ts");

const LANGS = languages.SUPPORTED_LANGUAGES;
type Lang = (typeof LANGS)[number];

/** Anything the templates use, left unreplaced. */
const LEFTOVER = /\{[a-z]+\}/i;

const CURRENT = { temperature: 31, feelsLike: 34, humidity: 28, windSpeed: 12, code: 1 };
const DAILY = [
  { date: "2026-08-27", code: 2, max: 33, min: 22, rainChance: 0 },
  { date: "2026-08-28", code: 63, max: 29, min: 21, rainChance: 45 },
];
const LISTING = {
  name: "Olive oil 1L",
  description: "Cold pressed",
  price: 12,
  inStock: false,
  shopName: "Olive Press",
};
const ORDER = {
  reference: "44444444",
  status: "shipped",
  createdAt: "2026-08-20T09:00:00Z",
  itemCount: 2,
  firstItem: "Olive oil 1L",
  totalVx: 250,
  totalUsd: null,
  shopName: "Olive Press",
};

/** Every message the assistant builds itself, for one language. */
function everySentence(language: Lang): Array<[string, string]> {
  const sentences: Array<[string, string]> = [
    ["weather", weather.formatWeather({
      language, placeName: "Amman", current: CURRENT, daily: DAILY, includeForecast: true,
    })],
    ["weatherNeedsPlace", weather.weatherNeedsPlaceNotice(language)],
    ["placeNotFound", weather.placeNotFoundNotice(language, "Nowhereton")],
    ["weatherUnavailable", weather.weatherUnavailableNotice(language)],
    ["whereYouAre", location.formatWhereYouAre({
      language,
      place: { locality: "Abdali", city: "Amman", region: null, country: "Jordan" },
      latitude: 31.95, longitude: 35.91,
    })],
    ["whereYouAreUnnamed", location.formatWhereYouAre({
      language,
      place: { locality: null, city: null, region: null, country: null },
      latitude: 31.95, longitude: 35.91,
    })],
    ["nearby", location.formatNearby({
      language,
      origin: { latitude: 31.9539, longitude: 35.9106 },
      places: [{ name: "Al Shifa", category: "pharmacy", latitude: 31.9545, longitude: 35.911 }],
    })],
    ["nearbyEmpty", location.formatNearby({
      language, origin: { latitude: 31.95, longitude: 35.91 }, places: [],
    })],
    ["locationNeeded", location.locationNeededNotice(language)],
    ["geocodeUnavailable", location.geocodeUnavailableNotice(language)],
    ["nearbyHint", location.nearbyHint(language)],
    ["listings", bazaar.formatListings({ language, listings: [LISTING], terms: ["olive"] })],
    ["listingsNoTerms", bazaar.formatListings({ language, listings: [LISTING], terms: [] })],
    ["noListings", bazaar.noListingsNotice(language, ["olive"])],
    ["noListingsNoTerms", bazaar.noListingsNotice(language, [])],
    ["browse", bazaar.browseNotice(language, 7)],
    ["browseEmpty", bazaar.browseNotice(language, 0)],
    ["sell", bazaar.sellGuidance(language)],
    ["bazaarUnavailable", bazaar.bazaarUnavailableNotice(language)],
    ["qr", barcode.qrCodeNotice(language, ["4006381333931"]) ?? ""],
    ["voiceExplainer", preferences.voiceModeExplainer(language)],
    ["preference", preferences.preferenceConfirmation(
      language,
      { preferred_language: language, verbosity: "concise" },
      languages.LANGUAGE_ENDONYM[language],
    )],
    ["orders", identity.formatOrders({ language, orders: [ORDER] })],
    ["ordersNone", identity.formatOrders({ language, orders: [] })],
    ["linkAskEmail", strings.say("linkAskEmail", language)],
    ["linkCodeWrong", strings.say("linkCodeWrong", language).replace("{n}", "3")],
  ];

  for (const mode of ["describe", "read_text", "find_object", "product", "translate"] as const) {
    sentences.push([`mode:${mode}`, vision.visionModeName(language, mode)]);
    sentences.push([`await:${mode}`, vision.awaitingImageNotice(language, mode)]);
  }
  sentences.push(["await:find_object+target", vision.awaitingImageNotice(language, "find_object", "my keys")]);

  return sentences;
}

describe("every sentence, in every language", () => {
  it("leaves no placeholder standing", () => {
    for (const language of LANGS) {
      for (const [name, sentence] of everySentence(language)) {
        expect(LEFTOVER.test(sentence), `${name}/${language}: ${sentence}`).toBe(false);
      }
    }
  });

  it("says something, rather than an empty string", () => {
    for (const language of LANGS) {
      for (const [name, sentence] of everySentence(language)) {
        expect(sentence.trim().length, `${name}/${language}`).toBeGreaterThan(0);
      }
    }
  });

  it("does not wedge an English block into another language", () => {
    // The proper nouns that stay English everywhere — a shop's name, a product
    // name, a URL, the brand — plus the Latin-script languages, where matching
    // English words proves nothing.
    const LATIN = new Set(["en", "es", "de", "pt", "fr", "it", "nl", "pl", "tr", "id", "vi"]);
    const ENGLISH_SENTENCE = /\b(the|and|with|from|your|please|send|share|search|try|nothing|listed)\b/i;
    for (const language of LANGS) {
      if (LATIN.has(language)) continue;
      for (const [name, sentence] of everySentence(language)) {
        const stripped = sentence
          .replace(/https?:\/\/\S+/g, "")
          .replace(/Visionex|Olive Press|Olive oil 1L|Al Shifa|Amman|Abdali|Jordan|Nowhereton|my keys|PDF|Word|PowerPoint/g, "");
        expect(ENGLISH_SENTENCE.test(stripped), `${name}/${language}: ${stripped}`).toBe(false);
      }
    }
  });
});

describe("the templates themselves", () => {
  it("keeps every placeholder in every translation", () => {
    // A translation that drops `{place}` produces a sentence naming no place,
    // and a translation that drops `{count}` produces one naming no number.
    // Both read as finished sentences, which is what makes them worth pinning.
    const missing: string[] = [];
    for (const key of Object.keys(strings.UI_STRINGS) as Array<keyof typeof strings.UI_STRINGS>) {
      const expected = (strings.UI_STRINGS[key].en.match(/\{[a-z]+\}/gi) ?? []).sort();
      if (expected.length === 0) continue;
      for (const language of LANGS) {
        const value = strings.UI_STRINGS[key][language];
        if (!value) continue;
        const found = (value.match(/\{[a-z]+\}/gi) ?? []).sort();
        if (found.join(",") !== expected.join(",")) {
          missing.push(`${key}.${language}: expected ${expected.join(",")}, found ${found.join(",") || "none"}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("describes every weather code the forecast can carry, in every language", () => {
    // The WMO codes Open-Meteo actually returns. An unknown code is described
    // as unknown; a *known* one described as unknown is a hole in the table.
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
      71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const language of LANGS) {
      const unknown = strings.say("wxUnknown", language);
      for (const code of codes) {
        const { text, icon } = weather.describeCode(code, language);
        expect(text, `${code}/${language}`).not.toBe(unknown);
        expect(text.trim().length, `${code}/${language}`).toBeGreaterThan(0);
        expect(icon.length, `${code}/${language}`).toBeGreaterThan(0);
      }
      expect(weather.describeCode(7777, language).text).toBe(unknown);
    }
  });

  it("names every nearby category in every language", () => {
    for (const language of LANGS) {
      for (const category of Object.keys(location.NEARBY_CATEGORIES)) {
        const label = location.categoryLabel(category, language);
        expect(label.trim().length, `${category}/${language}`).toBeGreaterThan(0);
        expect(label, `${category}/${language}`).not.toContain("_");
      }
      // An OSM tag nobody has classified reads as the tag, not as nothing.
      expect(location.categoryLabel("dog_grooming", language)).toBe("dog grooming");
    }
  });

  it("gives a day name and a unit from the runtime, not from a table", () => {
    // Twenty languages of weekday names is twenty chances to be wrong about a
    // calendar; `Intl` already knows. Spot-checked in four scripts.
    expect(weather.dayName("2026-08-27", "en")).toBe("Thursday");
    expect(weather.dayName("2026-08-27", "tr")).toBe("Perşembe");
    expect(weather.dayName("2026-08-27", "ru")).toBe("четверг");
    expect(weather.dayName("2026-08-27", "ar")).toBe("الخميس");
    // A date the parser cannot read comes back as itself rather than as
    // "Invalid Date", which is the one thing that must never be read aloud.
    expect(weather.dayName("not-a-date", "en")).toBe("not-a-date");
  });
});
