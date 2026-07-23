/**
 * useBookRails — fires one query per rail config via useQueries (React
 * Query's official "N independent queries from a dynamic array" hook).
 * Calling useQuery in a loop/.map() would violate the rules of hooks; this
 * is the correct, lint-safe way to back a config-driven rail list where the
 * number of rails is a static array, not a fixed number of named hooks.
 */

import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCatalog } from "@/services/library/catalog";
import type { LibraryCatalogFilters } from "@/lib/types/library-book";

export interface RailConfig {
  key: string;
  filters: LibraryCatalogFilters;
}

export function useBookRails(configs: RailConfig[]) {
  const results = useQueries({
    queries: configs.map((c) => ({
      queryKey: queryKeys.library.catalog(JSON.stringify(c.filters)),
      queryFn: () => fetchCatalog(c.filters),
      staleTime: 5 * 60 * 1000,
    })),
  });

  return configs.map((c, i) => ({
    key: c.key,
    books: results[i].data ?? [],
    isLoading: results[i].isLoading,
    error: results[i].error ? (results[i].error as Error).message : null,
    refetch: results[i].refetch,
  }));
}
