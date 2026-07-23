/**
 * useHighlights — a book's highlights for the signed-in viewer, with
 * add/delete, favoriting, annotation notes, search, share, and markdown
 * export. RLS: user manages own rows.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchHighlights, createHighlight, deleteHighlight, formatHighlightsAsMarkdown,
  toggleHighlightFavorite, updateHighlightNote, searchHighlights, shareHighlight,
} from "@/services/library/highlights";
import type { LibraryHighlightColor, LibraryHighlightRow } from "@/lib/types/library-reader";

export function useHighlights(bookId: string | undefined, bookTitle: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";
  const [searchResults, setSearchResults] = useState<LibraryHighlightRow[] | null>(null);

  const { data: highlights = [], isLoading } = useQuery({
    queryKey: queryKeys.library.highlights(bookId ?? "", uid),
    queryFn: () => fetchHighlights(uid, bookId!),
    enabled: !!bookId && !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.highlights(bookId ?? "", uid) });
  }, [queryClient, bookId, uid]);

  const addHighlight = useCallback(
    async (pageNumber: number | null, quotedText: string, color: LibraryHighlightColor) => {
      if (!bookId || !user || !quotedText.trim()) return;
      try {
        await createHighlight(uid, bookId, pageNumber, quotedText.trim(), color);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't add highlight", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [bookId, user, uid, invalidate]
  );

  const removeHighlight = useCallback(
    async (highlightId: string) => {
      try {
        await deleteHighlight(highlightId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't delete highlight", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const toggleFavorite = useCallback(
    async (highlightId: string, isFavorite: boolean) => {
      try {
        await toggleHighlightFavorite(highlightId, isFavorite);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update highlight", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const setNote = useCallback(
    async (highlightId: string, note: string | null) => {
      try {
        await updateHighlightNote(highlightId, note);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const share = useCallback(
    async (highlight: LibraryHighlightRow) => {
      try {
        const result = await shareHighlight(bookTitle, highlight);
        if (result === "copied") toast({ title: "Copied to clipboard" });
      } catch {
        // user cancelled the native share sheet — not an error
      }
    },
    [bookTitle]
  );

  const search = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) {
        setSearchResults(null);
        return;
      }
      try {
        const results = await searchHighlights(uid, query);
        setSearchResults(bookId ? results.filter((h) => h.book_id === bookId) : results);
      } catch (err) {
        toast({ title: "Search failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, bookId]
  );

  const exportAsMarkdown = useCallback(() => formatHighlightsAsMarkdown(bookTitle, highlights), [bookTitle, highlights]);

  return {
    highlights: searchResults ?? highlights, isLoading,
    addHighlight, removeHighlight, toggleFavorite, setNote, share, search, exportAsMarkdown,
  };
}
