// ─── Library — Chapter Suggestions Service (Phase 9) ──────────────────────
// "Track changes" for roles that can't write chapters directly (proofreader/
// translator/reviewer) — full alternate-chapter-JSON snapshots, diffed
// client-side (via the `diff` package) against the base version rather than
// a real operational-transform patch, since no verified free Tiptap
// track-changes package exists to depend on. See the schema migration's
// header note on library_book_suggestions for the full rationale.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookSuggestionRow } from "@/lib/types/library-studio";
import { flattenTiptapDocToText } from "@/lib/library/tiptapUtils";

const SUGGESTION_SELECT = "id, book_id, chapter_id, suggested_by, base_version_id, suggested_content, note, status, reviewed_by, reviewed_at, created_at";

export async function fetchSuggestions(chapterId: string): Promise<LibraryBookSuggestionRow[]> {
  const { data, error } = await supabase
    .from("library_book_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookSuggestionRow[];
}

export async function submitSuggestion(input: {
  book_id: string;
  chapter_id: string;
  suggested_by: string;
  base_version_id?: string;
  suggested_content: Record<string, unknown>;
  note?: string;
}): Promise<LibraryBookSuggestionRow> {
  const { data, error } = await supabase
    .from("library_book_suggestions")
    .insert({
      book_id: input.book_id,
      chapter_id: input.chapter_id,
      suggested_by: input.suggested_by,
      base_version_id: input.base_version_id ?? null,
      suggested_content: input.suggested_content,
      note: input.note ?? null,
    })
    .select(SUGGESTION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as LibraryBookSuggestionRow;
}

/** Accepting a suggestion applies its content to the live chapter (the
 *  editor/owner reviewing it is trusted to have already compared the diff
 *  in SuggestionsPanel before calling this) and records who reviewed it. */
export async function acceptSuggestion(suggestion: LibraryBookSuggestionRow, reviewedBy: string): Promise<void> {
  const { error: updateErr } = await supabase
    .from("library_chapters")
    .update({
      content_json: suggestion.suggested_content,
      content_text: flattenTiptapDocToText(suggestion.suggested_content as Parameters<typeof flattenTiptapDocToText>[0]),
    })
    .eq("id", suggestion.chapter_id);
  if (updateErr) throw new Error(updateErr.message);

  const { error: statusErr } = await supabase
    .from("library_book_suggestions")
    .update({ status: "accepted", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", suggestion.id);
  if (statusErr) throw new Error(statusErr.message);
}

export async function rejectSuggestion(suggestionId: string, reviewedBy: string): Promise<void> {
  const { error } = await supabase
    .from("library_book_suggestions")
    .update({ status: "rejected", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (error) throw new Error(error.message);
}
