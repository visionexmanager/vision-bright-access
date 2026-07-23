/**
 * useListeningStats — self-scoped listening summary (hours, completed
 * audiobooks, avg speed, streak) via get_library_listening_stats().
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchListeningStats } from "@/services/library/listeningStats";

export function useListeningStats() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.library.listeningStats(uid),
    queryFn: fetchListeningStats,
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  return { stats: data ?? null, isLoading, refetch };
}
