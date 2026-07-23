// ─── Library — Book Translations Service (Phase 11) ───────────────────────
// Client wrapper for library-translate-book-metadata + reads of the
// library_book_translations overlay it populates.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryBookTranslationRow {
  id: string;
  book_id: string;
  language_code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  description_long: string | null;
  keywords: string[];
  translated_by: "ai" | "human";
  created_at: string;
  updated_at: string;
}

export async function translateBookMetadata(bookId: string, targetLanguage: string): Promise<LibraryBookTranslationRow> {
  const { data, error } = await supabase.functions.invoke("library-translate-book-metadata", { body: { book_id: bookId, target_language: targetLanguage } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.translation as LibraryBookTranslationRow;
}

export async function fetchBookTranslations(bookId: string): Promise<LibraryBookTranslationRow[]> {
  const { data, error } = await supabase.from("library_book_translations").select("*").eq("book_id", bookId);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookTranslationRow[];
}
