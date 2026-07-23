/**
 * useBookDetails — a single book plus similar-books rail.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookById, fetchSimilarBooks } from "@/services/library/catalog";

export function useBookDetails(bookId: string | undefined) {
  const { data: book, isLoading, error } = useQuery({
    queryKey: queryKeys.library.book(bookId ?? ""),
    queryFn: () => fetchBookById(bookId!),
    enabled: !!bookId,
  });

  const { data: similar = [] } = useQuery({
    queryKey: [...queryKeys.library.book(bookId ?? ""), "similar"] as const,
    queryFn: () => fetchSimilarBooks(bookId!),
    enabled: !!bookId,
  });

  return { book: book ?? null, similar, isLoading, error: error ? (error as Error).message : null };
}
