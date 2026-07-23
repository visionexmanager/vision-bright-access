// ─── Library — Home Stats & Trending Service (Phase 3) ───────────────────────
// Wraps the 3 SECURITY DEFINER RPCs added in
// 20260721000000_library_home_stats_functions.sql — these exist because the
// underlying tables (library_book_daily_stats, library_reading_progress,
// library_search_history) are deliberately RLS'd to owner/admin or own-rows-
// only, so a visitor's client can't aggregate them directly. Each RPC
// returns only aggregated, non-personal data.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryHomeStats } from "@/lib/types/library-home";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "./catalog";

export async function fetchHomeStats(): Promise<LibraryHomeStats | null> {
  const { data, error } = await supabase.rpc("get_library_home_stats");
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}

export async function fetchTrendingBooks(limit = 12, days = 7): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase.rpc("get_library_trending_books", { _limit: limit, _days: days });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawLibraryBookRow[];
  if (rows.length === 0) return [];

  // RPC results can't use PostgREST's relation-embedding syntax, so author
  // names are resolved with one follow-up batch query keyed by author_id.
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: authors, error: authorsErr } = await supabase.from("library_authors").select("id, name").in("id", authorIds);
  if (authorsErr) throw new Error(authorsErr.message);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.name]));

  return rows.map((row) => mapRawBookRow(row, nameById.get(row.author_id) ?? ""));
}

export async function fetchPopularSearches(limit = 8): Promise<{ query: string; search_count: number }[]> {
  const { data, error } = await supabase.rpc("get_library_popular_searches", { _limit: limit });
  if (error) throw new Error(error.message);
  return data ?? [];
}
