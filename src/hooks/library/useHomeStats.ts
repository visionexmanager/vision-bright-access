/**
 * useHomeStats — platform-wide catalog stats for the hero/statistics sections.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchHomeStats } from "@/services/library/stats";

export function useHomeStats() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.homeStats(),
    queryFn: fetchHomeStats,
    staleTime: 5 * 60 * 1000,
  });
  return { stats: data ?? null, isLoading, error: error ? (error as Error).message : null, refetch };
}
