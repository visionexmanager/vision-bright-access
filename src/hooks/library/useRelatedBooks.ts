import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchRelatedBooks } from "@/services/library/classification";

/** AI-computed semantic similarity (library_related_books, populated by
 *  library-ai-classify-book) — distinct from useReadersAlsoRead
 *  (co-occurrence) and the category/author rails on LibraryBookDetails. */
export function useRelatedBooks(bookId: string | undefined) {
  const { data: books = [], isLoading } = useQuery({
    queryKey: queryKeys.library.relatedBooks(bookId ?? ""),
    queryFn: () => fetchRelatedBooks(bookId!),
    enabled: !!bookId,
  });
  return { books, isLoading };
}
