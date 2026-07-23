// ─── Library — Related Books Service (Phase 5) ────────────────────────────
// "Readers also read" wraps get_library_readers_also_read()
// (20260723000000_library_book_details_support.sql) — a SECURITY DEFINER
// RPC, because it aggregates across *all* users' library_favorites, which
// is RLS'd to own-rows-only. Same-category and same-author related books
// reuse fetchCatalog (Phase 4) directly — no new backend needed for those.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "./catalog";

export async function fetchReadersAlsoRead(bookId: string, limit = 8): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase.rpc("get_library_readers_also_read", { _book_id: bookId, _limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawLibraryBookRow[];
  if (rows.length === 0) return [];

  // RPC results can't use PostgREST's relation-embedding syntax, so author
  // names are resolved with one follow-up batch query keyed by author_id —
  // same technique as fetchTrendingBooks (services/library/stats.ts).
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: authors, error: authorsErr } = await supabase.from("library_authors").select("id, name").in("id", authorIds);
  if (authorsErr) throw new Error(authorsErr.message);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.name]));

  return rows.map((row) => mapRawBookRow(row, nameById.get(row.author_id) ?? ""));
}
