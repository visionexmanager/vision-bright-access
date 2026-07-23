/**
 * useBookSuggestions — pending "track changes" suggestions for a chapter
 * (from proofreader/translator/reviewer collaborators who can't write the
 * chapter directly) plus accept/reject actions for the owner/editor
 * reviewing them.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchSuggestions, submitSuggestion, acceptSuggestion, rejectSuggestion } from "@/services/library/suggestions";
import type { LibraryBookSuggestionRow } from "@/lib/types/library-studio";

export function useBookSuggestions(bookId: string | undefined, chapterId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.studio.suggestions(chapterId ?? ""),
    queryFn: () => fetchSuggestions(chapterId!),
    enabled: !!chapterId,
  });

  const invalidate = useCallback(() => {
    if (chapterId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.suggestions(chapterId) });
  }, [chapterId, queryClient]);

  const submit = useCallback(
    async (suggestedContent: Record<string, unknown>, note?: string, baseVersionId?: string) => {
      if (!bookId || !chapterId || !user) return;
      await submitSuggestion({ book_id: bookId, chapter_id: chapterId, suggested_by: user.id, suggested_content: suggestedContent, note, base_version_id: baseVersionId });
      invalidate();
      toast({ title: "Suggestion submitted for review" });
    },
    [bookId, chapterId, user, invalidate]
  );

  const accept = useCallback(
    async (suggestion: LibraryBookSuggestionRow) => {
      if (!user) return;
      await acceptSuggestion(suggestion, user.id);
      invalidate();
      // The chapter's content_json/content_text changed — the editor
      // reloads its own chapter query separately (see useChapterEditor).
    },
    [user, invalidate]
  );

  const reject = useCallback(
    async (suggestionId: string) => {
      if (!user) return;
      await rejectSuggestion(suggestionId, user.id);
      invalidate();
    },
    [user, invalidate]
  );

  return { suggestions, isLoading, submit, accept, reject };
}
