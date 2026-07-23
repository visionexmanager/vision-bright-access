// ─── Library — Series Suggestions Service (Phase 11) ──────────────────────
// AI proposes (library-detect-series edge function), the author/admin
// reviews here. Approving a "new series" suggestion creates the
// library_series row first, then links the book to it — both plain
// authenticated writes gated by the existing library_series/library_books
// RLS (author/admin manage), no service-role needed.

import { supabase } from "@/integrations/supabase/client";

export interface LibrarySeriesSuggestionRow {
  id: string;
  book_id: string;
  suggested_series_id: string | null;
  suggested_series_title: string | null;
  suggested_position: number | null;
  confidence: number | null;
  reasoning: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function slugifyTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series";
}

export async function detectSeriesForBook(bookId: string): Promise<{ suggestion: LibrarySeriesSuggestionRow | null; reasoning: string }> {
  const { data, error } = await supabase.functions.invoke("library-detect-series", { body: { book_id: bookId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { suggestion: data?.suggestion ?? null, reasoning: data?.reasoning ?? "" };
}

export async function fetchSeriesSuggestions(bookId: string): Promise<LibrarySeriesSuggestionRow[]> {
  const { data, error } = await supabase
    .from("library_series_suggestions")
    .select("*")
    .eq("book_id", bookId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySeriesSuggestionRow[];
}

export async function approveSeriesSuggestion(suggestion: LibrarySeriesSuggestionRow, authorId: string, reviewedBy: string): Promise<void> {
  let seriesId = suggestion.suggested_series_id;

  if (!seriesId) {
    if (!suggestion.suggested_series_title) throw new Error("This suggestion has no series to link");
    const { data: newSeries, error: seriesErr } = await supabase
      .from("library_series")
      .insert({ title: suggestion.suggested_series_title, slug: slugifyTitle(suggestion.suggested_series_title), author_id: authorId })
      .select("id")
      .single();
    if (seriesErr) throw new Error(seriesErr.message);
    seriesId = newSeries.id;
  }

  const { error: bookErr } = await supabase
    .from("library_books")
    .update({ series_id: seriesId, series_position: suggestion.suggested_position ?? 1 })
    .eq("id", suggestion.book_id);
  if (bookErr) throw new Error(bookErr.message);

  const { error: statusErr } = await supabase
    .from("library_series_suggestions")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq("id", suggestion.id);
  if (statusErr) throw new Error(statusErr.message);
}

export async function rejectSeriesSuggestion(suggestionId: string, reviewedBy: string): Promise<void> {
  const { error } = await supabase
    .from("library_series_suggestions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq("id", suggestionId);
  if (error) throw new Error(error.message);
}
