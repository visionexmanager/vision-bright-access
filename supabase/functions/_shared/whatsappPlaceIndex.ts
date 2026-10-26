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

/** The slice of the Supabase client this module needs, so tests can supply a stand-in. */
export interface PlaceIndexClient {
  rpc(
    fn: "lookup_geo_place",
    args: { _key: string },
  ): PromiseLike<{
    data: Array<{ name: string; country_code: string | null; latitude: number; longitude: number }> | null;
    error: unknown;
  }>;
}

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
