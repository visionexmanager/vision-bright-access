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
const OVERPASS_TIMEOUT_MS = 9_000;

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
export async function geocodePlace(query: string): Promise<GeocodedPlace | null> {
  const term = query.trim().slice(0, 80);
  if (!term) return null;

  const openMeteo = await getJson<{
    results?: Array<{
      latitude?: number; longitude?: number; name?: string; country?: string;
      admin1?: string;
    }>;
  }>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=1&format=json`);

  const hit = openMeteo?.results?.[0];
  if (hit && typeof hit.latitude === "number" && typeof hit.longitude === "number") {
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: hit.name ?? term,
      country: hit.country ?? null,
    };
  }

  const nominatim = await getJson<Array<{
    lat?: string; lon?: string; name?: string; display_name?: string;
  }>>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&limit=1&addressdetails=0`,
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
 * Turn coordinates into a place name, in the sender's language.
 *
 * BigDataCloud's client endpoint takes a `localityLanguage` and returns Arabic
 * properly — `الرياض، منطقة الرياض، السعودية` — which matters more here than
 * anywhere else in this feature: the whole point of answering a pin is to say
 * where someone is in words they can hear in their own language.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<PlaceDescription | null> {
  const data = await getJson<{
    locality?: string; city?: string; principalSubdivision?: string; countryName?: string;
  }>(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language}`,
  );
  if (!data) return null;

  const clean = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  return {
    locality: clean(data.locality),
    city: clean(data.city),
    region: clean(data.principalSubdivision),
    country: clean(data.countryName),
  };
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

/** How far out to look for something worth mentioning. A short walk. */
const NEARBY_RADIUS_M = 500;

/** How many places to name. A list read aloud stops being useful past this. */
const NEARBY_LIMIT = 8;

/**
 * What is around a coordinate, from OpenStreetMap.
 *
 * Restricted to named features in a handful of categories — a list of forty
 * unnamed benches and lamp posts is not an answer. Overpass is a volunteer
 * service under real load, so this asks for a small radius, caps the result set
 * server-side, and gives up rather than retrying.
 *
 * `null` means the lookup failed and `[]` means the area really is unmapped.
 * Collapsing the two would tell somebody standing outside a pharmacy that
 * there is nothing near them, which is both false and the kind of false a
 * person cannot check for themselves.
 */
export async function fetchNearby(
  latitude: number,
  longitude: number,
  language: Language,
): Promise<NearbyPlace[] | null> {
  const around = `${NEARBY_RADIUS_M},${latitude},${longitude}`;
  const query = `[out:json][timeout:8];(` +
    `node(around:${around})["amenity"~"^(pharmacy|hospital|clinic|bank|atm|restaurant|cafe|fuel|police|post_office|school|place_of_worship)$"]["name"];` +
    `node(around:${around})["shop"~"^(supermarket|bakery|convenience)$"]["name"];` +
    `node(around:${around})["highway"="bus_stop"]["name"];` +
    `);out body ${NEARBY_LIMIT * 4};`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  let data: {
    elements?: Array<{
      lat?: number; lon?: number;
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
    if (!name || typeof element.lat !== "number" || typeof element.lon !== "number") continue;

    const category = tags.amenity ?? tags.shop ?? (tags.highway === "bus_stop" ? "bus_stop" : null);
    if (!category) continue;

    places.push({ name, category, latitude: element.lat, longitude: element.lon });
  }

  // Overpass returns in its own order, which is not distance. Nearest first is
  // the only order that makes sense when the list is being read aloud and the
  // listener will act on the first item they hear. A chain with four branches
  // in one street would otherwise fill the whole list, so the same name is kept
  // once — the closest one.
  const seen = new Set<string>();
  return places
    .sort(
      (a, b) =>
        distanceMetres({ latitude, longitude }, a) - distanceMetres({ latitude, longitude }, b),
    )
    .filter((place) => {
      const key = `${place.name.toLowerCase()}|${place.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, NEARBY_LIMIT);
}
