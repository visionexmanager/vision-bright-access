/**
 * useBookCatalog / useLibraryCategories — browse the real Supabase book
 * catalog (services/library/catalog.ts). useBookCatalogPaginated is the
 * Books Explorer's data source: fetchCatalog + fetchCatalogCount together,
 * for real page-number pagination (see Pagination.tsx / BooksExplorerPanel).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCatalog, fetchCatalogCount, fetchCategories } from "@/services/library/catalog";
import type { LibraryCatalogFilters } from "@/lib/types/library-book";

export function useBookCatalog(filters: LibraryCatalogFilters = {}) {
  const filtersKey = JSON.stringify(filters);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.catalog(filtersKey),
    queryFn: () => fetchCatalog(filters),
    staleTime: 60 * 1000,
  });
  return { books: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}

export function useBookCatalogPaginated(filters: LibraryCatalogFilters = {}) {
  const filtersKey = JSON.stringify(filters);
  const pageSize = filters.limit ?? 24;

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.catalog(filtersKey),
    queryFn: () => fetchCatalog(filters),
    staleTime: 60 * 1000,
  });

  const { data: totalCount = 0, isLoading: countLoading } = useQuery({
    queryKey: queryKeys.library.catalogCount(filtersKey),
    queryFn: () => fetchCatalogCount(filters),
    staleTime: 60 * 1000,
  });

  return {
    books,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    isLoading: isLoading || countLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export function useLibraryCategories() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.categories(),
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
  return { categories: data ?? [], isLoading };
}
