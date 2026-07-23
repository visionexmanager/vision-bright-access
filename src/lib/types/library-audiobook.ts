/**
 * Library — Audiobook types (Phase 1 architecture prep, extended Phase 7)
 * Mirrors library_audiobooks (one-to-one with library_books) and the new
 * library_audiobook_chapters table — see
 * supabase/migrations/20260720000000_library_core_catalog.sql and
 * supabase/migrations/20260726000000_library_audiobooks_platform.sql.
 */

export interface LibraryAudiobookRow {
  id: string;
  book_id: string;
  title: string;
  author_name: string;
  narrator_id: string | null;
  narrator_name: string;
  cover_image_url: string | null;
  duration_seconds: number;
  chapter_count: number;
  language: string;
  /** The full, access-gated audio file (library_book_files.id) — resolved to
   *  a signed URL only at actual playback time. Distinct from audio_url,
   *  which is the freely-listenable sample/preview clip. */
  audio_file_id: string | null;
  audio_url: string | null;
}

export interface LibraryAudiobookChapterRow {
  id: string;
  audiobook_id: string;
  book_id: string;
  chapter_number: number;
  title: string | null;
  audio_file_id: string | null;
  duration_seconds: number;
  order_index: number;
  is_free_preview: boolean;
  is_ai_generated: boolean;
}
