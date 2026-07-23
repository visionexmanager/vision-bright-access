/**
 * useFeaturedAuthors — thin wrapper over the authors service, limited to
 * authors with at least one published book, sorted by follower count.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchFeaturedAuthors } from "@/services/library/authors";

export function useFeaturedAuthors(limit = 6) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.library.authors(), "featured", limit] as const,
    queryFn: () => fetchFeaturedAuthors(limit),
    staleTime: 15 * 60 * 1000,
  });
  return { authors: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
