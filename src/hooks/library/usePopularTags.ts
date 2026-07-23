/**
 * usePopularTags — most-used tags across the catalog, for the Explorer's
 * "Popular Tags" section.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchPopularTags } from "@/services/library/categories";

export function usePopularTags(limit = 12) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.library.popularTags(),
    queryFn: () => fetchPopularTags(limit),
    staleTime: 10 * 60 * 1000,
  });
  return { tags: data ?? [], isLoading, error: error ? (error as Error).message : null };
}
