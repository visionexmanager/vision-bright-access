/**
 * useBookClassification — triggers library-ai-classify-book for a book the
 * caller can edit, and invalidates the book's catalog/detail queries on
 * success so the new topics/subtopics/reading level show up immediately.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { classifyLibraryBook } from "@/services/library/classification";

export function useBookClassification(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [isClassifying, setIsClassifying] = useState(false);

  const classify = useCallback(async () => {
    if (!bookId) return null;
    setIsClassifying(true);
    try {
      const result = await classifyLibraryBook(bookId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.book(bookId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.bookDetail(bookId) });
      toast({ title: "Book classified", description: `${result.topics.length} topics, ${result.related_book_ids.length} related books found.` });
      return result;
    } catch (err) {
      toast({ title: "Classification failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsClassifying(false);
    }
  }, [bookId, queryClient]);

  return { classify, isClassifying };
}
