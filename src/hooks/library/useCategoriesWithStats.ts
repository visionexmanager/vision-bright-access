/**
 * useCategoriesWithStats — the Categories grid page's data source
 * (book_count/author_count/updated_at per category in one RPC call).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCategoriesWithStats } from "@/services/library/categories";

export function useCategoriesWithStats() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.categoriesWithStats(),
    queryFn: fetchCategoriesWithStats,
    staleTime: 5 * 60 * 1000,
  });
  return { categories: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
