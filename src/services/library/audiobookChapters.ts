// ─── Library — Audiobook Chapters Service (Phase 7) ───────────────────────
// RLS on library_audiobook_chapters (is_free_preview OR
// can_access_library_book_content(book_id)) already gates this query —
// a non-purchaser simply gets fewer/no rows back, same pattern as
// readerFiles.ts's fetchBookFiles.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryAudiobookChapterRow } from "@/lib/types/library-audiobook";

const CHAPTER_SELECT = "id, audiobook_id, book_id, chapter_number, title, audio_file_id, duration_seconds, order_index, is_free_preview, is_ai_generated";

export async function fetchChaptersForAudiobook(audiobookId: string): Promise<LibraryAudiobookChapterRow[]> {
  const { data, error } = await supabase
    .from("library_audiobook_chapters")
    .select(CHAPTER_SELECT)
    .eq("audiobook_id", audiobookId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryAudiobookChapterRow[];
}
