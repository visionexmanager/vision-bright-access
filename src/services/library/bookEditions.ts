// ─── Library — Book Editions Service (Phase 11: Digital Preservation) ─────
// Book-LEVEL edition/archive history — distinct from library_book_versions
// (chapter-draft history inside the editor, Phase 9). create_library_book_
// edition() (SECURITY DEFINER RPC) atomically retires the previous current
// edition and inserts the new one.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryBookEditionRow {
  id: string;
  book_id: string;
  edition_label: string;
  change_summary: string | null;
  is_current: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
}

export async function fetchBookEditions(bookId: string): Promise<LibraryBookEditionRow[]> {
  const { data, error } = await supabase
    .from("library_book_editions")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookEditionRow[];
}

export async function createBookEdition(bookId: string, editionLabel: string, changeSummary: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("create_library_book_edition", {
    _book_id: bookId,
    _edition_label: editionLabel,
    _change_summary: changeSummary,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
