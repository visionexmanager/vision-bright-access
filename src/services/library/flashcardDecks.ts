// ─── Library — Learning Hub: Flashcard Decks (SM-2 spaced repetition) ──────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryFlashcardDeckRow, LibraryStudyFlashcardRow, LibraryFlashcardStudySessionRow, LibraryFlashcardDifficulty } from "@/lib/types/library-learning";

export async function fetchFlashcardDecks(userId: string): Promise<LibraryFlashcardDeckRow[]> {
  const { data, error } = await supabase.from("library_flashcard_decks").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryFlashcardDeckRow[];
}

export async function fetchFlashcardDeck(deckId: string): Promise<LibraryFlashcardDeckRow | null> {
  const { data, error } = await supabase.from("library_flashcard_decks").select("*").eq("id", deckId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryFlashcardDeckRow | null;
}

export async function createFlashcardDeck(userId: string, title: string, bookId?: string | null, chapterId?: string | null): Promise<LibraryFlashcardDeckRow> {
  const { data, error } = await supabase
    .from("library_flashcard_decks")
    .insert({ user_id: userId, title, book_id: bookId ?? null, chapter_id: chapterId ?? null })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryFlashcardDeckRow;
}

export async function deleteFlashcardDeck(deckId: string): Promise<void> {
  const { error } = await supabase.from("library_flashcard_decks").delete().eq("id", deckId);
  if (error) throw new Error(error.message);
}

export async function fetchFlashcards(deckId: string): Promise<LibraryStudyFlashcardRow[]> {
  const { data, error } = await supabase.from("library_flashcards").select("*").eq("deck_id", deckId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryStudyFlashcardRow[];
}

export async function fetchDueFlashcards(deckId: string): Promise<LibraryStudyFlashcardRow[]> {
  const { data, error } = await supabase.rpc("get_library_due_flashcards", { _deck_id: deckId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryStudyFlashcardRow[];
}

export async function addManualFlashcard(deckId: string, front: string, back: string, difficulty: LibraryFlashcardDifficulty = "medium", imageUrl?: string | null, audioUrl?: string | null): Promise<LibraryStudyFlashcardRow> {
  const { data, error } = await supabase
    .from("library_flashcards")
    .insert({ deck_id: deckId, front, back, difficulty, source: "manual", image_url: imageUrl ?? null, audio_url: audioUrl ?? null })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryStudyFlashcardRow;
}

export async function deleteFlashcard(flashcardId: string): Promise<void> {
  const { error } = await supabase.from("library_flashcards").delete().eq("id", flashcardId);
  if (error) throw new Error(error.message);
}

/** SM-2 review — _quality is a 0-5 recall grade (0-2 = forgot, 3-5 = recalled with increasing ease). */
export async function reviewFlashcard(flashcardId: string, quality: number, sessionId?: string | null): Promise<LibraryStudyFlashcardRow> {
  const { data, error } = await supabase.rpc("review_library_flashcard", { _flashcard_id: flashcardId, _quality: quality, _session_id: sessionId ?? null });
  if (error) throw new Error(error.message);
  return data as LibraryStudyFlashcardRow;
}

export async function startStudySession(userId: string, deckId: string): Promise<LibraryFlashcardStudySessionRow> {
  const { data, error } = await supabase.from("library_flashcard_study_sessions").insert({ user_id: userId, deck_id: deckId }).select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryFlashcardStudySessionRow;
}

export async function endStudySession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("library_flashcard_study_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function fetchStudySessions(userId: string, deckId: string): Promise<LibraryFlashcardStudySessionRow[]> {
  const { data, error } = await supabase
    .from("library_flashcard_study_sessions").select("*")
    .eq("user_id", userId).eq("deck_id", deckId).order("started_at", { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryFlashcardStudySessionRow[];
}

export async function generateAiFlashcardDeck(bookId: string, chapterId?: string | null, title?: string, cardCount = 10): Promise<{ deckId: string; cards: LibraryStudyFlashcardRow[] }> {
  const { data, error } = await supabase.functions.invoke("library-generate-flashcard-deck", {
    body: { book_id: bookId, chapter_id: chapterId ?? undefined, title, card_count: cardCount },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { deckId: data.deck_id as string, cards: (data.cards ?? []) as LibraryStudyFlashcardRow[] };
}
