// ─── Library — AI Flashcards Service (Phase 6.5) ──────────────────────────
// CRUD against library_ai_flashcards — RLS `user manages own` does all the
// gating, plain client-side inserts/updates/deletes.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryFlashcardRow } from "@/lib/types/library-ai";

const SELECT = "id, user_id, book_id, chapter_id, front, back, mastered, created_at";

export async function fetchFlashcards(userId: string, bookId: string): Promise<LibraryFlashcardRow[]> {
  const { data, error } = await supabase
    .from("library_ai_flashcards")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryFlashcardRow[];
}

export async function saveFlashcards(userId: string, bookId: string, chapterId: string | null, cards: { front: string; back: string }[]): Promise<void> {
  if (cards.length === 0) return;
  const rows = cards.map((c) => ({ user_id: userId, book_id: bookId, chapter_id: chapterId, front: c.front, back: c.back }));
  const { error } = await supabase.from("library_ai_flashcards").insert(rows);
  if (error) throw new Error(error.message);
}

export async function toggleFlashcardMastered(flashcardId: string, mastered: boolean): Promise<void> {
  const { error } = await supabase.from("library_ai_flashcards").update({ mastered }).eq("id", flashcardId);
  if (error) throw new Error(error.message);
}

export async function deleteFlashcard(flashcardId: string): Promise<void> {
  const { error } = await supabase.from("library_ai_flashcards").delete().eq("id", flashcardId);
  if (error) throw new Error(error.message);
}
