import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as progress from "@/features/visionkids/services/world/progress";

export function useWorldStats() {
  return useQuery({ queryKey: ["kids-world", "stats"], queryFn: progress.fetchWorldStats });
}

export function useHome() {
  return useQuery({ queryKey: ["kids-world", "home"], queryFn: progress.fetchHome });
}

export function useSaveHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, theme, rooms }: { name: string; theme: string; rooms: Record<string, unknown> }) =>
      progress.saveHome(name, theme, rooms),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-world", "home"] });
      qc.invalidateQueries({ queryKey: ["kids-world", "stats"] });
      qc.invalidateQueries({ queryKey: ["points-total"] });
    },
  });
}

export function useInventory() {
  return useQuery({ queryKey: ["kids-world", "inventory"], queryFn: progress.fetchInventory });
}

export function useQuestProgress() {
  return useQuery({ queryKey: ["kids-world", "quest-progress"], queryFn: progress.fetchQuestProgress });
}

export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) => progress.completeQuest(activityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-world", "quest-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-world", "stats"] });
      qc.invalidateQueries({ queryKey: ["points-total"] });
    },
  });
}

export function useVisitedRegions() {
  return useQuery({ queryKey: ["kids-world", "visits"], queryFn: progress.fetchVisitedRegionSlugs });
}

export function useVisitRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regionSlug: string) => progress.visitRegion(regionSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-world", "visits"] });
      qc.invalidateQueries({ queryKey: ["kids-world", "stats"] });
    },
  });
}

export function useTransportUnlocks() {
  return useQuery({ queryKey: ["kids-world", "transport-unlocks"], queryFn: progress.fetchTransportUnlocks });
}

export function useUnlockTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transportSlug: string) => progress.unlockTransport(transportSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-world", "transport-unlocks"] });
      qc.invalidateQueries({ queryKey: ["kids-world", "stats"] });
    },
  });
}

export function useWorldSettings() {
  return useQuery({ queryKey: ["kids-world", "settings"], queryFn: progress.fetchWorldSettings });
}

export function useUpsertWorldSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: progress.upsertWorldSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-world", "settings"] }),
  });
}
