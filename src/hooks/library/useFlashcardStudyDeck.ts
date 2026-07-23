/**
 * useFlashcardStudyDeck — Learning Hub structured flashcard deck (SM-2
 * spaced repetition), distinct from useFlashcardDeck.ts (the ephemeral
 * per-book AI-sidebar flashcard hook backed by library_ai_flashcards).
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchFlashcardDeck, fetchFlashcards, fetchDueFlashcards, addManualFlashcard, deleteFlashcard,
  reviewFlashcard, startStudySession, endStudySession,
} from "@/services/library/flashcardDecks";
import type { LibraryFlashcardDifficulty } from "@/lib/types/library-learning";

export function useFlashcardStudyDeck(deckId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: deck } = useQuery({
    queryKey: queryKeys.library.flashcardDeck(deckId ?? ""),
    queryFn: () => fetchFlashcardDeck(deckId!),
    enabled: !!deckId,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.flashcardDeck(deckId ?? ""), "cards"],
    queryFn: () => fetchFlashcards(deckId!),
    enabled: !!deckId,
  });

  const { data: dueCards = [], refetch: refetchDue } = useQuery({
    queryKey: queryKeys.library.dueFlashcards(deckId ?? ""),
    queryFn: () => fetchDueFlashcards(deckId!),
    enabled: !!deckId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.flashcardDeck(deckId ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.dueFlashcards(deckId ?? "") });
  };

  const addCard = async (front: string, back: string, difficulty: LibraryFlashcardDifficulty = "medium") => {
    if (!deckId || !front.trim() || !back.trim()) return;
    try {
      await addManualFlashcard(deckId, front.trim(), back.trim(), difficulty);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add card", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeCard = async (flashcardId: string) => {
    try {
      await deleteFlashcard(flashcardId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete card", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const startSession = async () => {
    if (!user || !deckId) return;
    try {
      const session = await startStudySession(user.id, deckId);
      setSessionId(session.id);
    } catch (err) {
      toast({ title: "Couldn't start study session", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    try {
      await endStudySession(sessionId);
    } finally {
      setSessionId(null);
    }
  };

  const review = async (flashcardId: string, quality: number) => {
    try {
      await reviewFlashcard(flashcardId, quality, sessionId);
      await refetchDue();
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't save review", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { deck, cards, dueCards, isLoading, sessionId, addCard, removeCard, startSession, endSession, review };
}
