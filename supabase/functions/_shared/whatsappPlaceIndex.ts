// Resolve a place name from the local GeoNames index before asking an outside
// service.
//
// geocodePlace calls Open-Meteo and then Nominatim. The first has no results
// for names written in Arabic (probed 2026-08-21), the second asks for
// restraint, and neither is reachable from a sender in the middle of a
// conversation if it is slow. The site speaks twenty languages, so this index
// matches on a key that folds case, accents and Arabic letter variants (see
// placeKey.ts) and holds every alternate name GeoNames lists, in whichever
// script the sender wrote.
//
// A miss is not an error. It returns null and the caller carries on with the
// outside services exactly as before, so an empty or unreachable index changes
// nothing for anyone.

import { placeKey } from "./placeKey.ts";
import type { GeocodedPlace } from "./whatsappGeo.ts";
import type { PlaceDescription } from "./whatsappLocation.ts";

/** The slice of the Supabase client this module needs, so tests can supply a stand-in. */
export interface PlaceIndexClient {
  rpc(
    fn: "lookup_geo_place",
    args: { _key: string },
  ): PromiseLike<{
    data: Array<{ name: string; country_code: string | null; latitude: number; longitude: number }> | null;
    error: unknown;
  }>;
  rpc(
    fn: "nearest_geo_place",
    args: { _latitude: number; _longitude: number; _lang: string; _max_km: number },
  ): PromiseLike<{
    data: Array<{ label: string; country_code: string | null; distance_km: number }> | null;
    error: unknown;
  }>;
}

/** How near a city must be to stand for where somebody is. Past this the outside services answer. */
export const NEAREST_CITY_MAX_KM = 25;

/** A country's name in the sender's language, or its code when the runtime has no name for it. */
export function countryName(code: string | null, language: string): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export async function lookupLocalPlace(
  db: PlaceIndexClient,
  query: string,
  language: string,
): Promise<GeocodedPlace | null> {
  const key = placeKey(query.slice(0, 80));
  if (!key) return null;

  try {
    const { data, error } = await db.rpc("lookup_geo_place", { _key: key });
    if (error) return null;
    const hit = data?.[0];
    if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: hit.name,
      country: countryName(hit.country_code, language),
    };
  } catch {
    // The index is an optimisation. Whatever went wrong, the outside services
    // are still there.
    return null;
  }
}

/**
 * The nearest city to a pair of coordinates, named in the sender's language.
 *
 * City level only: the index knows cities above fifteen thousand people, so it
 * cannot name a district, a street or a village. That is enough for a weather
 * line ("Weather in Amman") and for a last resort when every outside service has
 * declined, and it is not a replacement for the outside services where a
 * sender wants the district read back. Null means "nothing close enough".
 */
export async function nearestLocalCity(
  db: PlaceIndexClient,
  latitude: number,
  longitude: number,
  language: string,
): Promise<PlaceDescription | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  try {
    const { data, error } = await db.rpc("nearest_geo_place", {
      _latitude: latitude, _longitude: longitude, _lang: language, _max_km: NEAREST_CITY_MAX_KM,
    });
    if (error) return null;
    const hit = data?.[0];
    if (!hit?.label) return null;
    return { locality: null, city: hit.label, region: null, country: countryName(hit.country_code, language) };
  } catch {
    return null;
  }
}
