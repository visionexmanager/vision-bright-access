// ─── Library — Recently Viewed Service (Phase 4) ──────────────────────────────
// Reads/writes library_recently_viewed (RLS: "user manages own",
// 20260720000003_library_core_discovery_analytics.sql). Writing a row here
// is also what feeds the book's daily "views" stat via the existing
// library_recently_viewed_bump_stat trigger, and doubles as the "book
// opens" analytics signal — see LibraryBookDetails.tsx.

import { supabase } from "@/integrations/supabase/client";
import { mapRawBookRow, type RawLibraryBookRow } from "./catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

type RecentlyViewedRow = { book_id: string; viewed_at: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null };

export async function recordRecentlyViewed(userId: string, bookId: string): Promise<void> {
  const { error } = await supabase
    .from("library_recently_viewed")
    .upsert({ user_id: userId, book_id: bookId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,book_id" });
  if (error) console.warn("Failed to record recently-viewed book:", error.message);
}

export async function fetchRecentlyViewed(userId: string, limit = 12): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_recently_viewed")
    .select("book_id, viewed_at, library_books(*, library_authors(name))")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RecentlyViewedRow[])
    .filter((row) => row.library_books !== null)
    .map((row) => mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? ""));
}
