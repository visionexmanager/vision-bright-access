/**
 * Library — Narrator types (Phase 7)
 * Mirrors supabase/migrations/20260726000000_library_audiobooks_platform.sql
 * (library_narrators table + get_library_narrator_stats RPC).
 */

export interface LibraryNarratorRow {
  id: string;
  user_id: string | null;
  name: string;
  bio: string | null;
  photo_url: string | null;
  languages: string[];
  created_at: string;
}

export interface LibraryNarratorStats {
  book_count: number;
  rating_avg: number | null;
  rating_count: number;
}
