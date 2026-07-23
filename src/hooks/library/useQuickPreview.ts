/**
 * useQuickPreview — aggregates everything the Quick Preview dialog shows:
 * the book + similar books (reuses useBookDetails), the author's bio, and
 * one quote for the book. Only fetches once the dialog is actually opened
 * (`enabled`), not eagerly for every card in a grid.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { useBookDetails } from "@/hooks/library/useBookDetails";
import { fetchAuthorById } from "@/services/library/authors";
import { fetchQuoteForBook } from "@/services/library/quotes";

export function useQuickPreview(bookId: string | undefined, open: boolean) {
  const { book, similar, isLoading: bookLoading } = useBookDetails(open ? bookId : undefined);

  const { data: author, isLoading: authorLoading } = useQuery({
    queryKey: queryKeys.library.author(book?.author_id ?? ""),
    queryFn: () => fetchAuthorById(book!.author_id),
    enabled: open && !!book,
  });

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: queryKeys.library.quotesByBook(bookId ?? ""),
    queryFn: () => fetchQuoteForBook(bookId!),
    enabled: open && !!bookId,
  });

  return {
    book,
    similar,
    author: author ?? null,
    quote: quote ?? null,
    isLoading: bookLoading || authorLoading || quoteLoading,
  };
}
