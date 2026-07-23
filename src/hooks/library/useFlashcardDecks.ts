import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchFlashcardDecks, createFlashcardDeck, deleteFlashcardDeck, generateAiFlashcardDeck } from "@/services/library/flashcardDecks";

export function useFlashcardDecks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: decks = [], isLoading } = useQuery({
    queryKey: queryKeys.library.flashcardDecks(uid ?? ""),
    queryFn: () => fetchFlashcardDecks(uid!),
    enabled: !!uid,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.flashcardDecks(uid ?? "") });

  const createDeck = async (title: string) => {
    if (!uid || !title.trim()) return null;
    try {
      const deck = await createFlashcardDeck(uid, title.trim());
      invalidate();
      return deck;
    } catch (err) {
      toast({ title: "Couldn't create deck", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const removeDeck = async (deckId: string) => {
    try {
      await deleteFlashcardDeck(deckId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete deck", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const generateFromBook = async (bookId: string, chapterId?: string | null, title?: string) => {
    setIsGenerating(true);
    try {
      const result = await generateAiFlashcardDeck(bookId, chapterId, title);
      invalidate();
      toast({ title: "Deck generated!", description: `${result.cards.length} flashcards ready to study.` });
      return result.deckId;
    } catch (err) {
      toast({ title: "Couldn't generate flashcards", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { decks, isLoading, isGenerating, createDeck, removeDeck, generateFromBook };
}
