/**
 * useFlashcardDeck — saved flashcards for a book, plus AI generation via
 * the existing "flashcards" mode and a VX reward on save (matching the
 * spec's "reward on creating flashcards" trigger).
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchFlashcards, saveFlashcards, toggleFlashcardMastered, deleteFlashcard } from "@/services/library/flashcards";
import { runLibraryAiAssistant } from "@/services/library/aiAssistant";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import type { LibraryAiFlashcard } from "@/services/library/aiAssistant";

const FLASHCARDS_VX_REWARD = 10;

export function useFlashcardDeck(bookId: string | undefined, chapterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";
  const [generated, setGenerated] = useState<LibraryAiFlashcard[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: savedCards = [], isLoading } = useQuery({
    queryKey: queryKeys.library.aiFlashcards(bookId ?? "", uid),
    queryFn: () => fetchFlashcards(uid, bookId!),
    enabled: !!bookId && !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.aiFlashcards(bookId ?? "", uid) });
  }, [queryClient, bookId, uid]);

  const generate = useCallback(async () => {
    if (!bookId) return;
    setIsGenerating(true);
    try {
      const res = await runLibraryAiAssistant({ mode: "flashcards", book_id: bookId, chapter_id: chapterId });
      if (res.mode === "flashcards") setGenerated(res.result.flashcards);
    } catch (err) {
      toast({ title: "Couldn't generate flashcards", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [bookId, chapterId]);

  const saveGenerated = useCallback(async () => {
    if (!bookId || !user || !generated || generated.length === 0) return;
    try {
      await saveFlashcards(uid, bookId, chapterId ?? null, generated);
      setGenerated(null);
      invalidate();
      void logLibraryAnalyticsEvent("ai_assistant_used", { userId: uid, entityType: "book", entityId: bookId, metadata: { mode: "flashcards-saved" } });
      try {
        await supabase.rpc("award_library_xp", { _amount: FLASHCARDS_VX_REWARD, _reason: `Flashcards created:${bookId}` });
      } catch {
        // Best-effort reward — a failure here shouldn't block the save the user actually cares about.
      }
      toast({ title: "Flashcards saved" });
    } catch (err) {
      toast({ title: "Couldn't save flashcards", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, [bookId, user, uid, generated, chapterId, invalidate]);

  const toggleMastered = useCallback(
    async (flashcardId: string, mastered: boolean) => {
      try {
        await toggleFlashcardMastered(flashcardId, mastered);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update flashcard", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const remove = useCallback(
    async (flashcardId: string) => {
      try {
        await deleteFlashcard(flashcardId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't delete flashcard", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  return { savedCards, isLoading, generated, isGenerating, generate, saveGenerated, toggleMastered, remove };
}
