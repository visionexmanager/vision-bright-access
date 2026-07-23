// ─── Library — AI Classification Service (Phase 11) ───────────────────────
// Client wrapper for the library-ai-classify-book edge function, plus reads
// of the library_related_books cache it populates.

import { supabase } from "@/integrations/supabase/client";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

export interface LibraryBookClassification {
  topics: string[];
  subtopics: string[];
  keywords: string[];
  difficulty_level: "beginner" | "intermediate" | "advanced";
  reading_level: "early_reader" | "middle_grade" | "young_adult" | "adult" | "graduate";
  related_book_ids: string[];
}

export async function classifyLibraryBook(bookId: string): Promise<LibraryBookClassification> {
  const { data, error } = await supabase.functions.invoke("library-ai-classify-book", { body: { book_id: bookId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryBookClassification;
}

/** Cached related books (populated by classifyLibraryBook) — a fast read,
 *  no on-the-fly embedding similarity call. */
export async function fetchRelatedBooks(bookId: string, limit = 6): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_related_books")
    .select("similarity, library_books!library_related_books_related_book_id_fkey(*, library_authors(name), library_publishers(name))")
    .eq("book_id", bookId)
    .order("similarity", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{ library_books: (RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null }) | null }>)
    .filter((row) => row.library_books)
    .map((row) => mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? "", row.library_books!.library_publishers?.name ?? null));
}
