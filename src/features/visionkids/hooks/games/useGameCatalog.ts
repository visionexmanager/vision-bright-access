import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/games/catalog";

export function useGameCategories() {
  return useQuery({ queryKey: ["kids-games", "categories"], queryFn: catalog.fetchGameCategories, staleTime: 10 * 60 * 1000 });
}

export function useGameBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-games", "game", slug], queryFn: () => catalog.fetchGameBySlug(slug!), enabled: !!slug });
}

export function useGamesByCategory(categorySlug: string | undefined, page = 0, pageSize = 24) {
  return useQuery({
    queryKey: ["kids-games", "by-category", categorySlug, page],
    queryFn: () => catalog.fetchGamesByCategory(categorySlug!, { limit: pageSize, offset: page * pageSize }),
    enabled: !!categorySlug,
  });
}

export function useSearchGames(query: string, page = 0, pageSize = 24) {
  return useQuery({
    queryKey: ["kids-games", "search", query, page],
    queryFn: () => catalog.searchGames(query, { limit: pageSize, offset: page * pageSize }),
  });
}

export function useFeaturedGames(limit = 12) {
  return useQuery({ queryKey: ["kids-games", "featured", limit], queryFn: () => catalog.fetchFeaturedGames(limit) });
}

export function useNewGames(limit = 12) {
  return useQuery({ queryKey: ["kids-games", "new", limit], queryFn: () => catalog.fetchNewGames(limit) });
}

export function useMultiplayerGames(limit = 12) {
  return useQuery({ queryKey: ["kids-games", "multiplayer-games", limit], queryFn: () => catalog.fetchMultiplayerGames(limit) });
}

export function useAccessibleAudioGames(limit = 12) {
  return useQuery({ queryKey: ["kids-games", "accessible-audio", limit], queryFn: () => catalog.fetchAccessibleAudioGames(limit) });
}
