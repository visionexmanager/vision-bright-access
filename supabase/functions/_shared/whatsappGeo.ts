// Maps and weather, over the network.
//
// Every service here is keyless and free, which was the selection criterion
// rather than a happy accident: this project has already had two capabilities
// switched off because a provider account ran dry (PDF and video, see
// `whatsappUnderstand.ts`). A feature that needs no key cannot be turned off by
// a billing failure, and weather is exactly the kind of question that must not
// answer "the account has no credit".
//
//   Open-Meteo      forecast + forward geocoding   no key, CC-BY
//   Nominatim/OSM   forward geocoding in Arabic    no key, ODbL, 1 req/s
//   BigDataCloud    reverse geocoding, localised   no key, free client endpoint
//   Overpass/OSM    what is nearby                 no key, ODbL, be gentle
//
// What leaves this function: a coordinate pair, or a place name. Never the
// sender's phone number, never their message, never anything that ties the
// coordinate to a person. The pin is already the least identifying half.
//
// The decisions — intent, wording, formatting, distances — are in
// `whatsappWeather.ts` and `whatsappLocation.ts`, which the test suite imports
// under Node. This module is only the fetching.

import { describeError } from "./whatsappSafety.ts";
import type { Language } from "./whatsappCatalog.ts";
import type { CurrentWeather, DailyWeather } from "./whatsappWeather.ts";
import { distanceMetres } from "./whatsappLocation.ts";
import type { NearbyPlace, PlaceDescription } from "./whatsappLocation.ts";

/**
 * Identifies this caller to OSM services, whose usage policy requires it and
 * whose operators block anonymous traffic. A contact URL is part of the ask.
 */
const USER_AGENT = "VisionexAssistant/1.0 (+https://visionex.app; support@visionex.app)";

/** A hung map service must not hold a WhatsApp reply hostage. */
const TIMEOUT_MS = 7_000;

/**
 * `fetch` with a deadline, returning parsed JSON or null.
 *
 * Never throws. Every caller below treats a failure as "I could not look that
 * up", which is a sentence the sender can act on, and none of them can do
 * anything useful with an exception.
 */
async function getJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`[whatsapp-geo] ${new URL(url).host} responded ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (e) {
    // A code, never the message: a fetch failure quotes the URL it was given,
    // and that URL carries the coordinates somebody just shared.
    console.error(`[whatsapp-geo] request failed: ${describeError(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface GeocodedPlace {
  latitude: number;
  longitude: number;
  name: string;
  country: string | null;
}

/**
 * Turn a place name into coordinates.
 *
 * Two services, in this order and for a specific reason. Open-Meteo's geocoder
 * is purpose-built for this and generous, but its index is romanised: a probe
 * on 2026-08-21 returned **no results at all** for `الرياض` while returning
 * Riyadh for `Riyadh`. Half this assistant's senders write in Arabic, so an
 * Arabic name reaching a dead end would make the feature useless to them.
 * Nominatim does resolve Arabic names, so it is the fallback — second rather
 * than first because its usage policy asks for restraint, and most lookups
 * never reach it.
 */
export async function geocodePlace(
  query: string,
  language: Language = "en",
): Promise<GeocodedPlace | null> {
  const term = query.trim().slice(0, 80);
  if (!term) return null;

  const openMeteo = await getJson<{
    results?: Array<{
      latitude?: number; longitude?: number; name?: string; country?: string;
      admin1?: string;
    }>;
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}` +
    `&count=1&format=json&language=${encodeURIComponent(language)}`,
  );

  const hit = openMeteo?.results?.[0];
  if (hit && typeof hit.latitude === "number" && typeof hit.longitude === "number") {
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: hit.name ?? term,
      country: hit.country ?? null,
    };
  }

  // `accept-language` is not politeness here. Without it Nominatim answers in
  // the language of the place, so an English sender asking for a shop in Amman
  // was told its country was «الأردن» — a line they cannot read, in the middle
  // of an English conversation.
  const nominatim = await getJson<Array<{
    lat?: string; lon?: string; name?: string; display_name?: string;
  }>>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}` +
    `&format=json&limit=1&addressdetails=0&accept-language=${encodeURIComponent(language)}`,
  );

  const fallback = nominatim?.[0];
  if (!fallback?.lat || !fallback?.lon) return null;
  const latitude = Number(fallback.lat);
  const longitude = Number(fallback.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    name: fallback.name || fallback.display_name?.split(",")[0]?.trim() || term,
    country: fallback.display_name?.split(",").pop()?.trim() ?? null,
  };
}

/**
 * A deadline for one reverse-geocode attempt.
 *
 * Shorter than `TIMEOUT_MS` because three of these run in sequence, and a
 * sender who has just shared a pin is holding their phone waiting for it. Every
 * one of the three answers in well under a second when it is healthy; this
 * number only decides how long a dead one is allowed to cost.
 */
const REVERSE_TIMEOUT_MS = 4_500;

/** Trimmed, or null. An empty string is not a place name. */
function clean(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Whether a lookup actually named somewhere.
 *
 * A provider that is refusing traffic does not always say so with a status
 * code — BigDataCloud's free endpoint answers `200` with an explanatory body
 * and no place fields at all. Reading that as success would hand the sender a
 * heading with nothing under it, so an answer that names nowhere counts as no
 * answer and the next provider gets its turn.
 */
function namesSomewhere(place: PlaceDescription): boolean {
  return Boolean(place.locality || place.city || place.region || place.country);
}

/** Localised, sub-second, and the first choice while it is answering. */
async function reverseViaBigDataCloud(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<PlaceDescription | null> {
  const data = await getJson<{
    locality?: string; city?: string; principalSubdivision?: string; countryName?: string;
  }>(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}` +
    `&longitude=${longitude}&localityLanguage=${encodeURIComponent(language)}`,
    REVERSE_TIMEOUT_MS,
  );
  if (!data) return null;
  return {
    locality: clean(data.locality),
    city: clean(data.city),
    region: clean(data.principalSubdivision),
    country: clean(data.countryName),
  };
}

/**
 * The same OpenStreetMap index this module already uses for forward lookups.
 *
 * `zoom=14` asks for the district rather than the doorway: "منطقة زهران، عمان"
 * is what somebody wants read back to them, and a house number is both less
 * useful out loud and more than this feature should be repeating.
 */
async function reverseViaNominatim(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<PlaceDescription | null> {
  const data = await getJson<{
    address?: Record<string, string>;
  }>(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}` +
    `&format=jsonv2&zoom=14&addressdetails=1&accept-language=${encodeURIComponent(language)}`,
    REVERSE_TIMEOUT_MS,
  );
  const address = data?.address;
  if (!address) return null;

  return {
    locality: clean(address.suburb ?? address.neighbourhood ?? address.quarter ?? address.hamlet),
    city: clean(address.city ?? address.town ?? address.village ?? address.municipality),
    region: clean(address.state ?? address.region ?? address.state_district ?? address.county),
    country: clean(address.country),
  };
}

/** The four languages Photon localises. Everything else reads better in English. */
const PHOTON_LANGUAGES = new Set(["de", "en", "fr", "it"]);

/**
 * A third opinion, from a different operator on a different host.
 *
 * It localises only four of the twenty languages, so for most senders this
 * names their city in English — which is the point: a name they can act on
 * beats the sentence that says nobody could find one. It is last precisely
 * because it is the least localised, and it exists because two providers that
 * both answer from the same place fail at the same time.
 */
async function reverseViaPhoton(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<PlaceDescription | null> {
  const lang = PHOTON_LANGUAGES.has(language) ? language : "en";
  const data = await getJson<{
    features?: Array<{ properties?: Record<string, string> }>;
  }>(
    `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=${lang}`,
    REVERSE_TIMEOUT_MS,
  );
  const properties = data?.features?.[0]?.properties;
  if (!properties) return null;

  return {
    locality: clean(properties.district ?? properties.suburb),
    city: clean(properties.city ?? properties.town ?? properties.village),
    region: clean(properties.state ?? properties.county),
    country: clean(properties.country),
  };
}

/**
 * Turn coordinates into a place name, in the sender's language.
 *
 * Three services, in this order, because a pin is the one input on this channel
 * that costs a blind sender no typing and no aiming — and until now a single
 * provider having a bad afternoon answered it with "the map service isn't
 * responding right now" and nothing else. That sentence was the whole feature
 * failing: the pin was discarded with it, so the weather question that followed
 * had no coordinates to work from either.
 *
 *   BigDataCloud   localised in all twenty languages, sub-second, first
 *   Nominatim/OSM  `accept-language` on the same twenty, ODbL, second
 *   Photon/OSM     four languages, but a different operator and a different
 *                  host — the point of a third is that it fails independently
 *
 * All three are keyless, which is the rule this module was built on: a
 * capability that needs no account cannot be switched off by a billing failure.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<PlaceDescription | null> {
  const lookups = [reverseViaBigDataCloud, reverseViaNominatim, reverseViaPhoton];
  for (const lookup of lookups) {
    const place = await lookup(latitude, longitude, language);
    if (place && namesSomewhere(place)) return place;
  }
  // A name, never a coordinate: what is worth knowing here is that all three
  // were asked, and the pin itself is the sender's whereabouts.
  console.error("[whatsapp-geo] every reverse geocoder declined");
  return null;
}

export interface WeatherReading {
  current: CurrentWeather;
  daily: DailyWeather[];
  timezone: string | null;
}

/** Current conditions and a three-day outlook, in the location's own timezone. */
export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherReading | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&forecast_days=3&timezone=auto";

  const data = await getJson<{
    timezone?: string;
    current?: {
      temperature_2m?: number; apparent_temperature?: number;
      relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number;
    };
    daily?: {
      time?: string[]; weather_code?: number[];
      temperature_2m_max?: number[]; temperature_2m_min?: number[];
      precipitation_probability_max?: Array<number | null>;
    };
  }>(url);

  const current = data?.current;
  if (typeof current?.temperature_2m !== "number") return null;

  const daily: DailyWeather[] = [];
  const days = data?.daily;
  for (let i = 0; i < (days?.time?.length ?? 0); i++) {
    const date = days?.time?.[i];
    if (!date) continue;
    daily.push({
      date,
      code: days?.weather_code?.[i] ?? 0,
      max: days?.temperature_2m_max?.[i] ?? current.temperature_2m,
      min: days?.temperature_2m_min?.[i] ?? current.temperature_2m,
      // Open-Meteo returns null for this where it has no model coverage;
      // reading null as 0% would promise a dry day it never predicted, so the
      // formatter's "only mention rain above 20%" threshold swallows it.
      rainChance: days?.precipitation_probability_max?.[i] ?? 0,
    });
  }

  return {
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature ?? current.temperature_2m,
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      code: current.weather_code ?? 0,
    },
    daily,
    timezone: data?.timezone ?? null,
  };
}

/**
 * How far out to look for something worth mentioning.
 *
 * This was 500 m, which is a short walk in a city centre and nothing at all in
 * a suburb: a sender standing outside their own pharmacy in a quiet street was
 * told nothing was mapped near them. Twelve hundred metres is about a
 * fifteen-minute walk, the list is ordered nearest-first, and every line states
 * its own distance — so a bank at 900 m is information somebody can act on
 * rather than noise they have to wade through.
 */
export const NEARBY_RADIUS_M = 1_200;

/** How many places to name. A list read aloud stops being useful past this. */
const NEARBY_LIMIT = 8;

/** A whole Overpass query, including its queue time, before giving up. */
const OVERPASS_TIMEOUT_MS = 9_000;

/** The Photon fallback, which answers from an index rather than a database. */
const PHOTON_NEARBY_TIMEOUT_MS = 5_000;

/**
 * The categories worth naming, and the OSM tag each is written as.
 *
 * Shared by both providers on purpose. Overpass is asked for exactly these, and
 * Photon — which cannot be asked so precisely — is filtered down to them
 * afterwards, so neither route can put a word on the screen that
 * `categoryLabel` has no translation for. A sender hearing "alcohol" read out
 * in the middle of an Arabic sentence is the failure this prevents.
 */
const AMENITIES = [
  "pharmacy", "hospital", "clinic", "bank", "atm", "restaurant", "cafe",
  "fuel", "police", "post_office", "school", "place_of_worship",
];
const SHOPS = ["supermarket", "bakery", "convenience"];

/** Everything above, as the set the results are filtered against. */
const NEARBY_CATEGORY_SET = new Set([...AMENITIES, ...SHOPS, "bus_stop", "station"]);

/** One place, as either provider ends up describing it. */
function toNearbyPlace(
  name: string | undefined,
  category: string | null | undefined,
  latitude: number | undefined,
  longitude: number | undefined,
): NearbyPlace | null {
  if (!name || !category || !NEARBY_CATEGORY_SET.has(category)) return null;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return { name, category, latitude, longitude };
}

/**
 * What is around a coordinate, from OpenStreetMap's live database.
 *
 * `nwr` rather than `node`, which is the correction that matters most here.
 * The query asked for nodes only, and an enormous share of the world's shops,
 * pharmacies and clinics are mapped as the *building* they occupy — a way, not
 * a point. A probe in Amman found 16 amenities as nodes and 23 with ways
 * included, and in countries where buildings were imported wholesale the
 * node-only answer is close to empty. Every one of those was a place somebody
 * standing outside it was told did not exist.
 *
 * `out center` gives a way its centroid, so the arithmetic downstream — bearing
 * and distance — never has to know the difference.
 */
async function nearbyViaOverpass(
  latitude: number,
  longitude: number,
  language: Language,
  category: string | null,
): Promise<NearbyPlace[] | null> {
  const around = `${NEARBY_RADIUS_M},${latitude},${longitude}`;
  // Asked of the map rather than filtered afterwards. Somebody who typed
  // "صيدلية" wants the nearest pharmacy even at 900 m, and filtering a list
  // that was capped at the eight nearest of everything would hand them the
  // restaurants across the road and nothing else.
  const amenity = (values: readonly string[]) =>
    `nwr(around:${around})["amenity"~"^(${values.join("|")})$"]["name"];`;
  const shop = (values: readonly string[]) =>
    `nwr(around:${around})["shop"~"^(${values.join("|")})$"]["name"];`;
  const busStop = () => `node(around:${around})["highway"="bus_stop"]["name"];`;

  // A category this query cannot express narrows nothing rather than returning
  // an empty set: asking for everything and letting the sender read past it is
  // a worse answer, never a wrong one.
  let parts: string[];
  if (category && AMENITIES.includes(category)) parts = [amenity([category])];
  else if (category && SHOPS.includes(category)) parts = [shop([category])];
  else if (category === "bus_stop") parts = [busStop()];
  else parts = [amenity(AMENITIES), shop(SHOPS), busStop()];

  const query = `[out:json][timeout:8];(${parts.join("")});out center ${NEARBY_LIMIT * 6};`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  let data: {
    elements?: Array<{
      lat?: number; lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, string>;
    }>;
  } | null = null;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) {
      // 429 and 504 are what a volunteer cluster says when it is busy, and this
      // channel reaches it from a shared datacenter address. That is the
      // ordinary case rather than an incident, which is why there is a second
      // route below instead of a sentence apologising to the sender.
      console.error(`[whatsapp-geo] overpass responded ${response.status}`);
      return null;
    }
    data = await response.json();
  } catch (e) {
    console.error(`[whatsapp-geo] overpass failed: ${describeError(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }

  const places: NearbyPlace[] = [];
  for (const element of data?.elements ?? []) {
    const tags = element.tags ?? {};
    // A locally-tagged name in the sender's own language is the one to read
    // out; the plain `name` tag is whatever the surveyor typed, often in Latin.
    // OpenStreetMap keys these as `name:ar`, `name:tr`, `name:ja` and so on, so
    // widening this from two languages to twenty is the language code and
    // nothing else — and English remains the step before the raw tag, because
    // for most of the world it is the likelier of the two to be readable.
    const name = tags[`name:${language}`] || tags["name:en"] || tags.name;
    const category = tags.amenity ?? tags.shop ?? (tags.highway === "bus_stop" ? "bus_stop" : null);
    const place = toNearbyPlace(
      name,
      category,
      element.lat ?? element.center?.lat,
      element.lon ?? element.center?.lon,
    );
    if (place) places.push(place);
  }
  return places;
}

/**
 * The same question, asked of a search index instead of a live database.
 *
 * Photon answers from a prebuilt OpenStreetMap index, so it is fast and it does
 * not queue — the two things Overpass cannot promise. It cannot be asked for a
 * category list as precisely, so it is asked broadly and filtered here, and it
 * returns names in the local script whatever `lang` says, which for this
 * audience is the right way round.
 */
async function nearbyViaPhoton(
  latitude: number,
  longitude: number,
  language: Language,
  category: string | null,
): Promise<NearbyPlace[] | null> {
  const lang = PHOTON_LANGUAGES.has(language) ? language : "en";
  // Photon filters on the tag key, not its value, so a category narrows this
  // request only as far as "an amenity" or "a shop"; `fetchNearby` does the
  // rest. Narrowing it this far is still worth doing — the result limit gets
  // spent on the right kind of place rather than on whatever is closest.
  const tags = category && SHOPS.includes(category)
    ? "&osm_tag=shop"
    : category === "bus_stop"
    ? "&osm_tag=highway:bus_stop"
    : category
    ? "&osm_tag=amenity"
    : "&osm_tag=amenity&osm_tag=shop&osm_tag=highway:bus_stop";
  const data = await getJson<{
    features?: Array<{
      properties?: Record<string, string>;
      geometry?: { coordinates?: number[] };
    }>;
  }>(
    `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}` +
    `&radius=${NEARBY_RADIUS_M / 1000}&limit=${NEARBY_LIMIT * 6}&lang=${lang}` + tags,
    PHOTON_NEARBY_TIMEOUT_MS,
  );
  if (!data?.features) return null;

  const places: NearbyPlace[] = [];
  for (const feature of data.features) {
    const properties = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates ?? [];
    const place = toNearbyPlace(
      properties.name,
      properties.osm_value,
      coordinates[1],
      coordinates[0],
    );
    if (place) places.push(place);
  }
  return places;
}

/** Nearest first, one entry per name, and nothing outside the radius asked for. */
function orderNearby(
  origin: { latitude: number; longitude: number },
  places: NearbyPlace[],
): NearbyPlace[] {
  const seen = new Set<string>();
  return places
    // Photon treats its radius as a hint rather than a promise, and a "near me"
    // list that reaches into the next district is not one.
    .filter((place) => distanceMetres(origin, place) <= NEARBY_RADIUS_M)
    // Neither provider answers in distance order, and nearest first is the only
    // order that makes sense when the list is read aloud and the listener will
    // act on the first thing they hear.
    .sort((a, b) => distanceMetres(origin, a) - distanceMetres(origin, b))
    // A chain with four branches in one street would otherwise fill the list,
    // so the same name is kept once — the closest one.
    .filter((place) => {
      const key = `${place.name.toLowerCase()}|${place.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, NEARBY_LIMIT);
}

/**
 * What is around a coordinate.
 *
 * Two providers, for the reason reverse geocoding has three: Overpass is a
 * volunteer cluster under real load, reached from a shared datacenter address,
 * so being turned away is the ordinary case rather than an incident. A live run
 * on 2026-09-05 found Amman answered by Overpass in seven seconds and Riyadh,
 * seconds later, not answered by it at all.
 *
 * Asked **together**, not one after the other. Sequentially the fallback costs
 * a second wait on top of the first one's timeout, and this reply is being
 * waited for by somebody holding a phone: the Riyadh lookup took nine seconds
 * with both, and would have taken fourteen in turn. Overpass wins where both
 * answer — it carries `name:ar` and the other nineteen language tags, which
 * Photon does not — and Photon carries the answer where Overpass has nothing
 * or nothing to say, an empty answer from a strained service being
 * indistinguishable from an empty neighbourhood.
 *
 * `null` means nobody could be reached and `[]` means the area really is
 * unmapped. Collapsing the two would tell somebody standing outside a pharmacy
 * that there is nothing near them, which is both false and the kind of false a
 * person cannot check for themselves.
 */
export async function fetchNearby(
  latitude: number,
  longitude: number,
  language: Language,
  category: string | null = null,
): Promise<NearbyPlace[] | null> {
  const origin = { latitude, longitude };
  const [overpass, photon] = await Promise.all([
    nearbyViaOverpass(latitude, longitude, language, category),
    nearbyViaPhoton(latitude, longitude, language, category),
  ]);

  // Neither provider can be asked precisely enough to be trusted on its own —
  // Overpass can, Photon filters on the tag key only — so the promise that a
  // request for a pharmacy returns pharmacies is kept here, once, for both.
  const only = (places: NearbyPlace[]) =>
    category ? places.filter((place) => place.category === category) : places;

  for (const found of [overpass, photon]) {
    if (found === null) continue;
    const ordered = orderNearby(origin, only(found));
    if (ordered.length > 0) return ordered;
  }

  if (overpass === null && photon === null) {
    console.error("[whatsapp-geo] every nearby provider declined");
    return null;
  }
  return [];
}
