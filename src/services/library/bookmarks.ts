// ─── Library — Bookmarks Service (Phase 6) ────────────────────────────────
// Plain CRUD against library_bookmarks (20260720000001_library_core_
// engagement.sql) — RLS (`FOR ALL USING/WITH CHECK auth.uid() = user_id`)
// does all the gating, no extra checks needed here.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookmarkRow } from "@/lib/types/library-reader";

const BOOKMARK_SELECT = "id, user_id, book_id, page_number, position, label, created_at";

export async function fetchBookmarks(userId: string, bookId: string): Promise<LibraryBookmarkRow[]> {
  const { data, error } = await supabase
    .from("library_bookmarks")
    .select(BOOKMARK_SELECT)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryBookmarkRow[];
}

export async function createBookmark(userId: string, bookId: string, pageNumber: number | null, position: Record<string, unknown>, label: string | null): Promise<void> {
  const { error } = await supabase.from("library_bookmarks").insert({ user_id: userId, book_id: bookId, page_number: pageNumber, position, label });
  if (error) throw new Error(error.message);
}

export async function renameBookmark(bookmarkId: string, label: string): Promise<void> {
  const { error } = await supabase.from("library_bookmarks").update({ label }).eq("id", bookmarkId);
  if (error) throw new Error(error.message);
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const { error } = await supabase.from("library_bookmarks").delete().eq("id", bookmarkId);
  if (error) throw new Error(error.message);
}
