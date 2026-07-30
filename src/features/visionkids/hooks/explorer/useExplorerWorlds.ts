import { useQuery } from "@tanstack/react-query";
import * as worlds from "@/features/visionkids/services/explorer/worlds";

export function useExplorerWorlds() {
  return useQuery({ queryKey: ["kids-explorer", "worlds"], queryFn: worlds.fetchExplorerWorlds });
}

export function useExplorerWorld(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-explorer", "world", slug],
    queryFn: () => worlds.fetchExplorerWorld(slug!),
    enabled: !!slug,
  });
}

export function useLocationsByWorld(worldSlug: string | undefined, category?: string) {
  return useQuery({
    queryKey: ["kids-explorer", "locations", worldSlug, category ?? "all"],
    queryFn: () => worlds.fetchLocationsByWorld(worldSlug!, category),
    enabled: !!worldSlug,
  });
}

export function useLocationBySlug(worldSlug: string | undefined, locationSlug: string | undefined) {
  return useQuery({
    queryKey: ["kids-explorer", "location", worldSlug, locationSlug],
    queryFn: () => worlds.fetchLocationBySlug(worldSlug!, locationSlug!),
    enabled: !!worldSlug && !!locationSlug,
  });
}
