// ─── Library — Wishlist Service (Phase 10) ────────────────────────────────
// library_wishlist — Library-specific, distinct from the generic site-wide
// `wishlists` table used by other products; see the marketplace migration's
// header note for why.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";

export async function fetchWishlistBookIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("library_wishlist").select("book_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.book_id));
}

export async function fetchWishlistBooks(userId: string): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_wishlist")
    .select("created_at, library_books(*, library_authors(name), library_publishers(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{ library_books: RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null } }>)
    .filter((row) => row.library_books)
    .map((row) => mapRawBookRow(row.library_books, row.library_books.library_authors?.name ?? "", row.library_books.library_publishers?.name ?? null));
}

export async function addToWishlist(userId: string, bookId: string, note?: string): Promise<void> {
  const { error } = await supabase.from("library_wishlist").upsert({ user_id: userId, book_id: bookId, note: note ?? null }, { onConflict: "user_id,book_id" });
  if (error) throw new Error(error.message);
}

export async function removeFromWishlist(userId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from("library_wishlist").delete().eq("user_id", userId).eq("book_id", bookId);
  if (error) throw new Error(error.message);
}
