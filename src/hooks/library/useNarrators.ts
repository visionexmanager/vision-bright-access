/**
 * useNarrators / useNarratorDetails / useNarratorStats — thin wrappers over
 * the narrators service, mirroring useAudiobooks.ts / useFeaturedAuthors.ts.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchNarrators, fetchNarratorById, fetchNarratorStats } from "@/services/library/narrators";

export function useNarrators(limit = 50) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.library.narrators(String(limit)),
    queryFn: () => fetchNarrators(limit),
    staleTime: 15 * 60 * 1000,
  });
  return { narrators: data ?? [], isLoading, error: error ? (error as Error).message : null };
}

export function useNarratorDetails(narratorId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.narrator(narratorId ?? ""),
    queryFn: () => fetchNarratorById(narratorId!),
    enabled: !!narratorId,
  });
  return { narrator: data ?? null, isLoading };
}

export function useNarratorStats(narratorId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.narratorStats(narratorId ?? ""),
    queryFn: () => fetchNarratorStats(narratorId!),
    enabled: !!narratorId,
    staleTime: 15 * 60 * 1000,
  });
  return { stats: data ?? null, isLoading };
}
