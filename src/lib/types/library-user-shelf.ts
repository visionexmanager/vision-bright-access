/**
 * Library — Personal shelf types (Phase 1 architecture prep)
 *
 * Client-only shape today (see src/lib/library/libraryLocalStore.ts, same
 * temporary-localStorage contract as Academy's *LocalStore.ts files) —
 * fields mirror the planned tables (library_shelf_items,
 * library_reading_progress, library_downloads, library_reading_lists) so
 * migrating to real persistence later is a drop-in swap, not a redesign.
 */

export interface LibraryShelfItem {
  user_id: string;
  book_id: string;
  added_at: string;
}

export interface LibraryFavoriteItem {
  user_id: string;
  book_id: string;
  added_at: string;
}

export interface LibraryReadingProgress {
  user_id: string;
  book_id: string;
  percent_complete: number;
  last_opened_at: string;
}

export interface LibraryDownloadItem {
  user_id: string;
  book_id: string;
  downloaded_at: string;
}

// LibraryReadingListRow moved to services/library/readingLists.ts (Phase 11
// — real Supabase persistence with visibility/list_type/sharing, replacing
// this file's localStorage-only shape).
