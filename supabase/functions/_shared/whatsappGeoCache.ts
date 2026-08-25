// Asking the map services less often.
//
// ── Why cache something that costs nothing ──────────────────────────────────
//
// Every geo service this channel uses is free and keyless: Open-Meteo for
// weather and geocoding, Nominatim as a geocoding fallback, BigDataCloud for
// reverse geocoding, Overpass for what is nearby. There are no credits to save.
// That is exactly why the reason for caching is not cost:
//
//   the usage policies    Nominatim asks for at most one request per second and
//                         reserves the right to block. Overpass is a small
//                         volunteer-run cluster. This channel currently calls
//                         both with no throttle and no cache, once per message.
//                         A busy hour is a ban, and a ban is a feature that
//                         stops working for everybody at once.
//
//   the person waiting    A cached lookup is a database read instead of two
//                         round trips to a volunteer server in another country.
//                         For somebody who asked out loud and is holding a
//                         phone to their ear, that is the difference between an
//                         answer and a pause.
//
//   privacy               A coordinate that is answered from cache is a
//                         coordinate that was never sent anywhere.
//
// ── What is stored, and what deliberately is not ────────────────────────────
//
// A cache row is keyed on a *rounded* coordinate and nothing else. No phone
// number, no conversation id, no user. It is a fact about a place — "the
// locality at roughly 31.951, 35.923 is called Amman" — which is true for
// everybody and identifies nobody. Two customers standing on the same street
// share the row, and that is the point.
//
// The rounding is what makes that true. Full precision would be a coordinate
// trail; three decimals is about 110 metres, which names a neighbourhood and
// not a doorway.
//
// Pure: no `Deno`, no fetch, no database. The store arrives as two functions,
// the same seam `askAssistant` and `retrieveKnowledge` use, so the whole policy
// is testable without a network or a Postgres.

// ── How precise a cached place needs to be ───────────────────────────────────

/**
 * Decimal places kept for a place-name lookup. Three is about 110 metres.
 *
 * Enough to name the locality, which is all `reverseGeocode` is asked for, and
 * coarse enough that the stored value describes a neighbourhood rather than a
 * person's front door. Everyone on the street shares one row.
 */
export const PLACE_PRECISION = 3;

/**
 * Decimal places kept for weather. Two is about 1.1 kilometres.
 *
 * Weather does not vary meaningfully below that, and the coarser grid means a
 * whole town collapses into a handful of rows instead of one per sender.
 */
export const WEATHER_PRECISION = 2;

/** Round toward a fixed grid so nearby requests land on the same key. */
export const roundTo = (value: number, places: number): number => {
  const factor = 10 ** places;
  // `Math.round` on a negative half-value rounds toward positive infinity,
  // which would put two points either side of the equator on different grids.
  // Rounding the magnitude and restoring the sign keeps the grid symmetric.
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * factor);
  return rounded / factor;
};

/** Fold a place name to something two spellings of it agree on. */
export const normaliseQuery = (query: string): string =>
  (query ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 120);

// ── The keys ─────────────────────────────────────────────────────────────────

export type GeoKind = "reverse" | "geocode" | "weather" | "nearby";

/**
 * How long each answer stays true.
 *
 * A place name does not change; a month is a conservative way of saying "not
 * often". What is around a place changes when a shop opens, so a week. Weather
 * changes constantly, and the key already carries the hour — the ceiling exists
 * so a row cannot outlive its own bucket if the clock moves.
 */
export const GEO_TTL_MS: Record<GeoKind, number> = {
  reverse: 30 * 24 * 3_600_000,
  geocode: 30 * 24 * 3_600_000,
  nearby: 7 * 24 * 3_600_000,
  weather: 3_600_000,
};

/** The hour a weather answer belongs to, in UTC. */
export const weatherBucket = (nowMs: number): string =>
  new Date(nowMs).toISOString().slice(0, 13); // YYYY-MM-DDTHH

export function reverseKey(latitude: number, longitude: number, language: string): string {
  return `reverse:${roundTo(latitude, PLACE_PRECISION)}:${roundTo(longitude, PLACE_PRECISION)}:${language}`;
}

export function geocodeKey(query: string): string {
  return `geocode:${normaliseQuery(query)}`;
}

export function nearbyKey(latitude: number, longitude: number, language: string): string {
  return `nearby:${roundTo(latitude, PLACE_PRECISION)}:${roundTo(longitude, PLACE_PRECISION)}:${language}`;
}

export function weatherKey(latitude: number, longitude: number, nowMs: number): string {
  return `weather:${roundTo(latitude, WEATHER_PRECISION)}:${roundTo(longitude, WEATHER_PRECISION)}:${weatherBucket(nowMs)}`;
}

/**
 * Whether a key could have come from this module.
 *
 * A cache read is a database read with a caller-supplied key, so the key is
 * checked rather than trusted — the same reasoning as the interactive-id scope
 * check in `whatsappSafety.ts`. Nothing here is user-controlled today; this is
 * what keeps that true.
 */
// Upper case is included because a weather key carries an ISO hour and that
// hour has a `T` in it. A lowercase-only class silently classified every
// weather key as not-cacheable, which disabled weather caching entirely while
// looking like it worked — a test comparing a real key against this is what
// caught it.
const KEY_SHAPE = /^(reverse|geocode|nearby|weather):[A-Za-z0-9 .:@+-]{0,160}$/u;
export const isGeoKey = (key: string): boolean => KEY_SHAPE.test(key ?? "");

// ── The store, handed in ─────────────────────────────────────────────────────

export interface GeoCacheStore {
  /** The cached value, or null on a miss. Must never throw. */
  read(key: string): Promise<unknown | null>;
  /** Store a value with a lifetime. Must never throw. */
  write(key: string, value: unknown, ttlMs: number): Promise<void>;
}

export type CacheOutcome = "hit" | "miss" | "stored" | "not_cacheable" | "unavailable";

export interface CacheResult<T> {
  value: T | null;
  outcome: CacheOutcome;
}

/**
 * Answer from cache, or ask and remember.
 *
 * ── Three rules that are easy to get wrong ──────────────────────────────────
 *
 * A cache miss must never become a failure. If the store is unreachable the
 * lookup still happens, uncached; the customer gets their answer and the log
 * records that caching was unavailable. A cache is an optimisation and must
 * behave like one.
 *
 * A null answer is not cached. `reverseGeocode` returning null means the
 * service was unreachable or had nothing — a transient state — and storing it
 * for thirty days would turn one bad minute into a month of wrong answers.
 * Only a real answer is worth remembering.
 *
 * And a *fetch* failure is not a cache failure. If the upstream service throws,
 * that propagates as null exactly as it does today; this wrapper changes when
 * the service is called, never what happens when it fails.
 */
export async function cached<T>(
  key: string,
  kind: GeoKind,
  store: GeoCacheStore | null,
  fetcher: () => Promise<T | null>,
): Promise<CacheResult<T>> {
  if (!store || !isGeoKey(key)) {
    return { value: await fetcher(), outcome: "not_cacheable" };
  }

  let unavailable = false;
  try {
    const hit = await store.read(key);
    if (hit !== null && hit !== undefined) return { value: hit as T, outcome: "hit" };
  } catch {
    unavailable = true;
  }

  const value = await fetcher();
  // Nothing to remember, and nothing worth remembering: see above.
  if (value === null || value === undefined) {
    return { value: null, outcome: unavailable ? "unavailable" : "miss" };
  }
  if (unavailable) return { value, outcome: "unavailable" };

  try {
    await store.write(key, value, GEO_TTL_MS[kind]);
    return { value, outcome: "stored" };
  } catch {
    // Written or not, the customer has their answer.
    return { value, outcome: "unavailable" };
  }
}
