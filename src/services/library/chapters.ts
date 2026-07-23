// ─── Library — Chapters Service (Phase 5) ─────────────────────────────────
// RLS on library_chapters already restricts non-owners/non-purchasers to
// free-preview chapters only (20260720000000_library_core_catalog.sql), so
// a plain SELECT here naturally returns only what the caller can read —
// no client-side gating needed.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryChapterRow } from "@/lib/types/library-book";

export async function fetchChaptersForBook(bookId: string): Promise<LibraryChapterRow[]> {
  const { data, error } = await supabase
    .from("library_chapters")
    .select("id, book_id, chapter_number, title, content_text, content_url, page_start, page_end, duration_seconds, is_free_preview, order_index")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryChapterRow[];
}

// ─── Studio (author-side) chapter management (Phase 9) ────────────────────
// Read/write access here is gated by can_edit_library_book's widened RLS
// (owner/admin/owner-or-editor-role collaborator) — see the publishing
// studio migration.

export interface StudioChapterSummary {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string | null;
  order_index: number;
  is_free_preview: boolean;
}

export interface StudioChapterContent {
  id: string;
  book_id: string;
  title: string | null;
  content_json: Record<string, unknown> | null;
  content_text: string | null;
}

export async function fetchChaptersForEdit(bookId: string): Promise<StudioChapterSummary[]> {
  const { data, error } = await supabase
    .from("library_chapters")
    .select("id, book_id, chapter_number, title, order_index, is_free_preview")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioChapterSummary[];
}

export async function fetchChapterForEdit(chapterId: string): Promise<StudioChapterContent | null> {
  const { data, error } = await supabase.from("library_chapters").select("id, book_id, title, content_json, content_text").eq("id", chapterId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as StudioChapterContent | null;
}

export async function createChapter(bookId: string, title: string): Promise<StudioChapterSummary> {
  const { data: existing, error: countErr } = await supabase.from("library_chapters").select("chapter_number, order_index").eq("book_id", bookId).order("order_index", { ascending: false }).limit(1);
  if (countErr) throw new Error(countErr.message);
  const next = (existing?.[0]?.chapter_number ?? 0) + 1;
  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

  const { data, error } = await supabase
    .from("library_chapters")
    .insert({ book_id: bookId, chapter_number: next, title, order_index: nextOrder, content_text: "" })
    .select("id, book_id, chapter_number, title, order_index, is_free_preview")
    .single();
  if (error) throw new Error(error.message);
  return data as StudioChapterSummary;
}

export async function updateChapterContent(chapterId: string, content_json: Record<string, unknown>, content_text: string): Promise<void> {
  const { error } = await supabase.from("library_chapters").update({ content_json, content_text }).eq("id", chapterId);
  if (error) throw new Error(error.message);
}

export async function updateChapterMeta(chapterId: string, patch: { title?: string; is_free_preview?: boolean }): Promise<void> {
  const { error } = await supabase.from("library_chapters").update(patch).eq("id", chapterId);
  if (error) throw new Error(error.message);
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const { error } = await supabase.from("library_chapters").delete().eq("id", chapterId);
  if (error) throw new Error(error.message);
}

export async function reorderChapters(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, index) => supabase.from("library_chapters").update({ order_index: index }).eq("id", id)));
}
