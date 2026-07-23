// ─── Library — Recommendations Service (Phase 3) ──────────────────────────────
// Reads the library_book_recommendations cache table (populated by the
// library-recommend-books edge function, Phase 2). RLS restricts this table
// to "user reads own" — there is no direct-write policy for regular users,
// so this service is read-only; recommendations are generated server-side,
// not requested synchronously from the home page.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "./catalog";

type RecommendationRow = {
  score: number;
  reason: string | null;
  library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null;
};

export async function fetchRecommendations(userId: string, limit = 12): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_book_recommendations")
    .select("score, reason, library_books(*, library_authors(name))")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RecommendationRow[])
    .filter((row) => row.library_books !== null)
    .map((row) => mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? ""));
}
