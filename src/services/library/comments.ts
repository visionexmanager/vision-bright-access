// ─── Library — Book Comments Service (Phase 9) ────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookCommentRow } from "@/lib/types/library-studio";

const COMMENT_SELECT = "id, book_id, chapter_id, parent_comment_id, author_id, body, anchor, status, created_at, updated_at";

export async function fetchComments(bookId: string, chapterId?: string): Promise<LibraryBookCommentRow[]> {
  let query = supabase.from("library_book_comments").select(COMMENT_SELECT).eq("book_id", bookId).order("created_at", { ascending: true });
  if (chapterId) query = query.eq("chapter_id", chapterId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookCommentRow[];
}

export async function addComment(input: {
  book_id: string;
  chapter_id?: string;
  parent_comment_id?: string;
  author_id: string;
  body: string;
  anchor?: { from: number; to: number };
}): Promise<LibraryBookCommentRow> {
  const { data, error } = await supabase
    .from("library_book_comments")
    .insert({
      book_id: input.book_id,
      chapter_id: input.chapter_id ?? null,
      parent_comment_id: input.parent_comment_id ?? null,
      author_id: input.author_id,
      body: input.body,
      anchor: input.anchor ?? null,
    })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as LibraryBookCommentRow;
}

export async function resolveComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("library_book_comments").update({ status: "resolved" }).eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("library_book_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}
