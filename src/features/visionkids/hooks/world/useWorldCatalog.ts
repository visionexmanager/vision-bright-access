import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/world/catalog";

export function useRegions() {
  return useQuery({ queryKey: ["kids-world", "regions"], queryFn: catalog.fetchRegions });
}

export function useRegion(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-world", "region", slug],
    queryFn: () => catalog.fetchRegion(slug!),
    enabled: !!slug,
  });
}

export function useActivities(region: string | undefined) {
  return useQuery({
    queryKey: ["kids-world", "activities", region],
    queryFn: () => catalog.fetchActivities(region!),
    enabled: !!region,
  });
}

export function useNpcs(region?: string) {
  return useQuery({
    queryKey: ["kids-world", "npcs", region ?? "all"],
    queryFn: () => catalog.fetchNpcs(region),
  });
}

export function useMarketItems(category?: string) {
  return useQuery({
    queryKey: ["kids-world", "market", category ?? "all"],
    queryFn: () => catalog.fetchMarketItems(category),
  });
}

export function useTransports() {
  return useQuery({ queryKey: ["kids-world", "transports"], queryFn: catalog.fetchTransports });
}
