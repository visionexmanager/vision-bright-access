/**
 * Library — Reader Engine types (Phase 6)
 *
 * Reader-session concepts, split from library-book.ts (catalog shapes) the
 * same way library-review.ts/library-audiobook.ts are already split by
 * concern. Mirrors the real Supabase rows — see
 * supabase/migrations/20260720000000_library_core_catalog.sql
 * (library_book_files) and 20260720000001_library_core_engagement.sql
 * (library_bookmarks/library_notes/library_highlights), plus
 * 20260724000000_library_reader_engine.sql (library_reader_settings).
 */

import type { LibraryFileType } from "./library-book";

export interface LibraryBookFileRow {
  id: string;
  book_id: string;
  file_type: LibraryFileType;
  storage_path: string;
  file_url: string | null;
  file_size_bytes: number | null;
  is_primary: boolean;
  created_at: string;
}

export interface LibraryBookmarkRow {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number | null;
  position: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export interface LibraryNoteRow {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export type LibraryHighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export interface LibraryHighlightRow {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number | null;
  quoted_text: string;
  color: LibraryHighlightColor;
  is_favorite: boolean;
  note: string | null;
  created_at: string;
}

export interface LibraryReaderSettings {
  fontSize: number;
  fontFamily: "serif" | "sans" | "dyslexic";
  fontWeight: "normal" | "bold";
  lineSpacing: number;
  margins: "narrow" | "normal" | "wide";
  pageWidth: "narrow" | "normal" | "wide";
  theme: "light" | "dark" | "sepia" | "high-contrast";
  scrollMode: "vertical" | "horizontal-paginated";
  pageLayout: "single" | "double";
}

export const DEFAULT_READER_SETTINGS: LibraryReaderSettings = {
  fontSize: 18,
  fontFamily: "serif",
  fontWeight: "normal",
  lineSpacing: 1.6,
  margins: "normal",
  pageWidth: "normal",
  theme: "light",
  scrollMode: "vertical",
  pageLayout: "single",
};

/** Which rendering mode LibraryReader chose for a given book — decided once
 *  at load time, see decideReaderRenderMode() in the reader page. */
export type ReaderRenderMode = "reflowable-text" | "pdf-iframe" | "unsupported";

/** The two documented shapes library_reading_progress.last_position holds —
 *  audio (Phase 5, useAudiobookProgress.ts) vs. text (Phase 6). Never both
 *  at once for a given upsert, but a hybrid ebook+audiobook title's row can
 *  legitimately hold either shape depending on which mode was last used. */
export interface LibraryLastPositionText {
  scroll_offset: number;
  chapter_id: string;
  anchor_id?: string;
}
export interface LibraryLastPositionAudio {
  position_seconds: number;
  playback_rate: number;
  /** Phase 7: which audiobook chapter this position belongs to, and which
   *  device last wrote it — both optional so pre-Phase-7 rows (and the
   *  legacy single-file audiobook case with no chapters) still parse. */
  chapter_id?: string;
  device?: string;
}
