/**
 * useSeriesSuggestions — one book's pending AI series suggestions, plus the
 * detect/approve/reject actions. Lives in the Studio Organization tab next
 * to useBookClassification, since both are "run AI, then a human decides"
 * flows on the same screen.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  detectSeriesForBook,
  fetchSeriesSuggestions,
  approveSeriesSuggestion,
  rejectSeriesSuggestion,
} from "@/services/library/seriesSuggestions";

export function useSeriesSuggestions(bookId: string | undefined, authorId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDetecting, setIsDetecting] = useState(false);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.seriesSuggestions(bookId ?? ""),
    queryFn: () => fetchSeriesSuggestions(bookId!),
    enabled: !!bookId,
  });

  const invalidate = () => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.seriesSuggestions(bookId) });
    if (bookId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.book(bookId) });
  };

  const detect = useCallback(async () => {
    if (!bookId) return;
    setIsDetecting(true);
    try {
      const { suggestion, reasoning } = await detectSeriesForBook(bookId);
      if (suggestion) {
        toast({ title: "Series suggestion ready", description: "Review it below." });
        invalidate();
      } else {
        toast({ title: "No series detected", description: reasoning || "This book doesn't appear to be part of a series." });
      }
    } catch (err) {
      toast({ title: "Series detection failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDetecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const approve = async (suggestionId: string) => {
    if (!user || !authorId) return;
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    try {
      await approveSeriesSuggestion(suggestion, authorId, user.id);
      invalidate();
      toast({ title: "Series linked" });
    } catch (err) {
      toast({ title: "Couldn't approve suggestion", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const reject = async (suggestionId: string) => {
    if (!user) return;
    try {
      await rejectSeriesSuggestion(suggestionId, user.id);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't reject suggestion", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { suggestions, isLoading, isDetecting, detect, approve, reject };
}
