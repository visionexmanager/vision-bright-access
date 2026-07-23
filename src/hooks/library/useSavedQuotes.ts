/**
 * useSavedQuotes — the Book Details "Quotes" section: the book's quotes
 * plus which ones the signed-in viewer has saved, with a save/unsave
 * toggle. Signed-out viewers still see the quotes list, just with every
 * quote reporting isSaved=false and toggleSave() as a no-op.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchQuotesForBook, fetchSavedQuoteIds, saveQuote, unsaveQuote } from "@/services/library/quotes";

export function useSavedQuotes(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.quotesByBook(bookId ?? ""),
    queryFn: () => fetchQuotesForBook(bookId!),
    enabled: !!bookId,
  });

  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: queryKeys.library.savedQuotes(uid, bookId ?? ""),
    queryFn: () => fetchSavedQuoteIds(uid, quotes.map((q) => q.id)),
    enabled: !!user && !!bookId && quotes.length > 0,
  });

  const toggleSave = useCallback(
    async (quoteId: string) => {
      if (!user) return;
      try {
        if (savedIds.has(quoteId)) {
          await unsaveQuote(uid, quoteId);
        } else {
          await saveQuote(uid, quoteId);
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.library.savedQuotes(uid, bookId ?? "") });
      } catch (err) {
        toast({ title: "Couldn't update saved quotes", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, savedIds, queryClient, bookId]
  );

  return { quotes, isLoading, isSaved: (quoteId: string) => savedIds.has(quoteId), toggleSave };
}
