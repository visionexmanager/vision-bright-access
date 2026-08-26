// Finding something to listen to, over WhatsApp.
//
// ── Why radio and not "a song" ──────────────────────────────────────────────
//
// Visionex has a radio service: stations, genres, countries, languages, seeded
// globally. It has no track catalogue, and this repository's WhatsApp rule is
// that a new external service must be keyless — a test enforces it — which
// rules out every music-identification API worth using. So the honest thing to
// build is what Visionex actually has: search the stations, name them, and let
// the person choose one.
//
// For an audience that is largely blind, that is not a lesser feature. A
// station plays without a screen, does not have to be picked track by track,
// and keeps playing while the phone is in a pocket.
//
// ── The stream URL is not ours to give ──────────────────────────────────────
//
// `radio_stations.stream_url` is deliberately hidden: `radio-stream-token`
// exists so a browser never sees it, and listening is subscription-gated. This
// module reads `radio_stations_public`, the anon-safe view that excludes it by
// construction, and sends the listener to the Visionex page to play. Handing a
// raw stream out over WhatsApp would route around a decision somebody made on
// purpose, and would do it for every station at once.
//
// Pure. No `Deno`, no fetch, no database client — the query is three lines in
// the webhook, where the client already is.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Where a listener goes to actually play something. */
export const RADIO_URL = "https://visionex.app/services/live-radio";

/** One station, as the anon-safe view returns it. Never carries a stream. */
export interface RadioStation {
  name: string;
  nameAr: string | null;
  language: string | null;
  country: string | null;
  bitrate: string | null;
  isFeatured: boolean;
}

/**
 * How many stations one message carries.
 *
 * Five, read aloud, is already a lot to hold. The rest are a narrower word
 * away — "jazz" rather than "music" — and narrowing is a better answer than
 * scrolling for somebody navigating by ear.
 */
export const MAX_STATIONS = 5;

/** Shortest word worth searching a station name for. */
export const MIN_TERM_CHARS = 3;
export const MAX_TERMS = 3;

/**
 * Words that mean "music" rather than naming any of it.
 *
 * Stripped before searching, in both directions: somebody typing «بدي أسمع
 * موسيقى هادية» means the station search, and "موسيقى" itself matches every
 * station with the word in its description. What is left — "هادية" — is the
 * part worth searching for, and when nothing is left the answer is the
 * featured stations rather than an empty result.
 *
 * Arabic function words are the reason this list exists at all: they are short,
 * extremely common, and a three-character floor alone does not exclude them.
 */
const NOISE = new Set([
  // English
  "music", "song", "songs", "radio", "station", "stations", "listen", "play",
  "some", "the", "a", "an", "to", "me", "i", "want", "please", "for", "and",
  // Arabic
  "موسيقى", "موسيقا", "اغنية", "أغنية", "اغاني", "أغاني", "راديو", "اذاعة",
  "إذاعة", "محطة", "محطات", "شغل", "شغلي", "بدي", "أريد", "اريد", "اسمع",
  "أسمع", "سماع", "من", "على", "في", "لي", "الى", "إلى", "مع", "عن",
]);

/** What a sender asked for. */
export interface RadioRequest {
  /** Words to match against station names and descriptions. May be empty. */
  terms: string[];
  /**
   * Whether the words clearly meant listening.
   *
   * A weak guess is handed back to the assistant rather than answered with
   * stations — "play along" is not a request for the radio.
   */
  confident: boolean;
}

const MUSIC_INTENT = [
  /\b(music|songs?|radio|station|tune in|listen to)\b/i,
  /(موسيق|أغني|اغني|أغان|اغان|راديو|إذاع|اذاع|محط)/,
  /(müzik|musik|musique|música|musica|музык|संगीत|সঙ্গীত|音楽|음악|音乐|موسیقی|nhạc|موسیقی)/i,
];

/** Everything that is not a letter, a digit or a space. Keeps a filter safe. */
const stripPunctuation = (text: string): string =>
  text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/**
 * The words worth searching for.
 *
 * Punctuation-stripped first, which is what makes interpolating these into a
 * PostgREST filter safe later: a comma, a parenthesis or a quote cannot survive
 * it. The same guarantee `whatsappBazaar.searchTerms` relies on.
 */
export function stationTerms(text: string): string[] {
  const cleaned = stripPunctuation(text ?? "").toLowerCase();
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of cleaned.split(" ")) {
    if ([...word].length < MIN_TERM_CHARS) continue;
    if (NOISE.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

/** Whether this message is asking to listen, and what for. */
export function parseRadioRequest(text: string | null | undefined): RadioRequest | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  if (!MUSIC_INTENT.some((pattern) => pattern.test(raw))) return null;
  return { terms: stationTerms(raw), confident: raw.length <= 120 };
}

/** Read the view's rows into something typed, dropping anything nameless. */
export function readStations(rows: unknown): RadioStation[] {
  if (!Array.isArray(rows)) return [];
  const stations: RadioStation[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const nameAr = typeof record.name_ar === "string" ? record.name_ar.trim() : "";
    if (!name && !nameAr) continue;
    stations.push({
      name: name || nameAr,
      nameAr: nameAr || null,
      language: typeof record.language === "string" ? record.language : null,
      country: typeof record.country === "string" ? record.country : null,
      bitrate: typeof record.bitrate === "string" ? record.bitrate : null,
      isFeatured: record.is_featured === true,
    });
  }
  return stations;
}

/**
 * The station's name in the reader's language, where there is one.
 *
 * Only Arabic has a second name in this schema. Everybody else gets the name
 * the station calls itself, which is what is written on it.
 */
export const stationName = (station: RadioStation, language: Language): string =>
  language === "ar" && station.nameAr ? station.nameAr : station.name;

/**
 * The message: what is on, and where to play it.
 *
 * Country and bitrate go on the same line as the name because they are how
 * somebody chooses between two stations playing the same thing — and a listener
 * who cannot see the screen hears them in that order, not after scrolling.
 */
export function formatStations(params: {
  language: Language;
  stations: readonly RadioStation[];
}): string {
  const { language } = params;
  const stations = params.stations.slice(0, MAX_STATIONS);
  if (stations.length === 0) return noStationsNotice(language);

  const lines = stations.map((station) => {
    const details = [station.country, station.bitrate ? `${station.bitrate}kbps` : null]
      .filter((part): part is string => Boolean(part));
    const suffix = details.length > 0 ? ` — ${details.join(" · ")}` : "";
    return `• ${stationName(station, language)}${suffix}`;
  });

  return [
    say("radioHeading", language),
    "",
    ...lines,
    "",
    say("radioHint", language).replace("{url}", RADIO_URL),
  ].join("\n");
}

/** Nothing matched. Says so, and says where everything is. */
export const noStationsNotice = (language: Language): string =>
  say("radioNone", language).replace("{url}", RADIO_URL);

/** The station list could not be read. Distinct from "nothing matched". */
export const radioUnavailableNotice = (language: Language): string =>
  say("radioUnavailable", language).replace("{url}", RADIO_URL);
