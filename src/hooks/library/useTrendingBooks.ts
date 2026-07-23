/**
 * useTrendingBooks — books ranked by a weighted activity score over the
 * last N days (default 7 — "Trending Now"; pass 30 for "Popular This Month").
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchTrendingBooks } from "@/services/library/stats";

export function useTrendingBooks(limit = 12, days = 7) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.trending(days),
    queryFn: () => fetchTrendingBooks(limit, days),
    staleTime: 15 * 60 * 1000,
  });
  return { books: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
