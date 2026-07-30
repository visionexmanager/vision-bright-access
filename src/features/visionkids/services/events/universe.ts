import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsUniverseCity, KidsUniverseCharacter, KidsUniverseCityVisit } from "@/features/visionkids/types/events.types";

export async function fetchCities(): Promise<KidsUniverseCity[]> {
  const { data, error } = await kidsDb.from("kids_universe_cities").select("*").order("order_index").returns<KidsUniverseCity[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCityBySlug(slug: string): Promise<KidsUniverseCity | null> {
  const { data, error } = await kidsDb.from("kids_universe_cities").select("*").eq("slug", slug).maybeSingle().returns<KidsUniverseCity>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCharacters(citySlug: string): Promise<KidsUniverseCharacter[]> {
  const { data, error } = await kidsDb.from("kids_universe_characters").select("*").eq("city_slug", citySlug).returns<KidsUniverseCharacter[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyCityVisits(): Promise<KidsUniverseCityVisit[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  const { data, error } = await kidsDb.from("kids_universe_city_visits").select("*").eq("user_id", userId).returns<KidsUniverseCityVisit[]>();
  if (error) throw error;
  return data ?? [];
}

/** Idempotent — safe on every city-page mount. Returns true only if this
 *  was a brand-new visit (matches award_kids_explorer_stamp's shape,
 *  Phase 6). */
export async function visitCity(citySlug: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("award_kids_universe_visit", { _city_slug: citySlug });
  if (error) throw error;
  return !!data;
}
