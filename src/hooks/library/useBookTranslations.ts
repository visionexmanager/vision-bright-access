/**
 * useBookTranslations — reads every translation available for a book
 * (public, anyone browsing can pick a language to view in) plus an author-
 * gated `translate(targetLanguage)` action that calls the AI pipeline.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookTranslations, translateBookMetadata } from "@/services/library/bookTranslations";

export function useBookTranslations(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [isTranslating, setIsTranslating] = useState(false);

  const { data: translations = [], isLoading } = useQuery({
    queryKey: queryKeys.library.bookTranslations(bookId ?? ""),
    queryFn: () => fetchBookTranslations(bookId!),
    enabled: !!bookId,
  });

  const translate = useCallback(async (targetLanguage: string) => {
    if (!bookId) return null;
    setIsTranslating(true);
    try {
      const translation = await translateBookMetadata(bookId, targetLanguage);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.bookTranslations(bookId) });
      toast({ title: "Translation ready" });
      return translation;
    } catch (err) {
      toast({ title: "Translation failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [bookId, queryClient]);

  return { translations, isLoading, translate, isTranslating };
}
