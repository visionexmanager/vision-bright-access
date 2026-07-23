// ─── Library — Book Awards Service (Phase 10) ─────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookAwardRow } from "@/lib/types/library-marketplace";

export async function fetchBookAwards(bookId: string): Promise<LibraryBookAwardRow[]> {
  const { data, error } = await supabase.from("library_book_awards").select("id, book_id, name, awarding_body, year, rank, icon_url").eq("book_id", bookId).order("year", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookAwardRow[];
}
