import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Game, GameWithCategory, GameCategory } from "@/features/visionkids/types/games.types";

const GAME_RELATIONS = "*, category:kids_game_categories(*)";

export async function fetchGameCategories(): Promise<GameCategory[]> {
  const { data, error } = await kidsDb
    .from("kids_game_categories").select("*").eq("is_active", true).order("display_order")
    .returns<GameCategory[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchGameCategoryBySlug(slug: string): Promise<GameCategory | null> {
  const { data, error } = await kidsDb
    .from("kids_game_categories").select("*").eq("slug", slug).eq("is_active", true).maybeSingle()
    .returns<GameCategory>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchGameBySlug(slug: string): Promise<GameWithCategory | null> {
  const { data, error } = await kidsDb
    .from("kids_games").select(GAME_RELATIONS).eq("slug", slug).eq("status", "published").maybeSingle()
    .returns<GameWithCategory>();
  if (error) throw error;
  return data ?? null;
}

export interface GamesPage {
  games: Game[];
  count: number;
}

export async function fetchGamesByCategory(categorySlug: string, { limit = 24, offset = 0 } = {}): Promise<GamesPage> {
  const category = await fetchGameCategoryBySlug(categorySlug);
  if (!category) return { games: [], count: 0 };

  const { data, error, count } = await kidsDb
    .from("kids_games")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("category_id", category.id)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<Game[]>();
  if (error) throw error;
  return { games: data ?? [], count: count ?? 0 };
}

export async function searchGames(query: string, { limit = 24, offset = 0 } = {}): Promise<GamesPage> {
  let q = kidsDb.from("kids_games").select("*", { count: "exact" }).eq("status", "published");
  if (query.trim()) q = q.textSearch("search_vector", query.trim(), { type: "websearch", config: "simple" });
  const { data, error, count } = await q.order("rating_avg", { ascending: false }).range(offset, offset + limit - 1).returns<Game[]>();
  if (error) throw error;
  return { games: data ?? [], count: count ?? 0 };
}

export async function fetchFeaturedGames(limit = 12): Promise<Game[]> {
  const { data, error } = await kidsDb
    .from("kids_games").select("*").eq("status", "published").order("players_count", { ascending: false }).limit(limit)
    .returns<Game[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchNewGames(limit = 12): Promise<Game[]> {
  const { data, error } = await kidsDb
    .from("kids_games").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(limit)
    .returns<Game[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMultiplayerGames(limit = 12): Promise<Game[]> {
  const { data, error } = await kidsDb
    .from("kids_games").select("*").eq("status", "published").eq("is_multiplayer", true).limit(limit)
    .returns<Game[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchAccessibleAudioGames(limit = 12): Promise<Game[]> {
  const { data, error } = await kidsDb
    .from("kids_games").select("*").eq("status", "published").eq("is_accessible_audio", true).limit(limit)
    .returns<Game[]>();
  if (error) throw error;
  return data ?? [];
}
