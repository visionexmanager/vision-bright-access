// ─── Library — Highlights Service (Phase 6, enhanced in Phase 13 Learning
// Hub with favorites, annotation notes, and search) ─────────────────────────
// Plain CRUD against library_highlights (20260720000001_library_core_
// engagement.sql, widened in 20260802000000_library_learning_hub.sql) —
// RLS does all the gating. No stored offset/range column (page_number +
// quoted_text only) — a reflowable engine's "position" is rendering-
// dependent (font size/margins change it), so re-anchoring by searching for
// quoted_text within the current render is the correct approach, not a
// shortcut; a stored offset would go stale on every settings change anyway.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryHighlightColor, LibraryHighlightRow } from "@/lib/types/library-reader";

const HIGHLIGHT_SELECT = "id, user_id, book_id, page_number, quoted_text, color, is_favorite, note, created_at";

export async function fetchHighlights(userId: string, bookId: string): Promise<LibraryHighlightRow[]> {
  const { data, error } = await supabase
    .from("library_highlights")
    .select(HIGHLIGHT_SELECT)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryHighlightRow[];
}

export async function createHighlight(userId: string, bookId: string, pageNumber: number | null, quotedText: string, color: LibraryHighlightColor): Promise<void> {
  const { error } = await supabase.from("library_highlights").insert({ user_id: userId, book_id: bookId, page_number: pageNumber, quoted_text: quotedText, color });
  if (error) throw new Error(error.message);
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.from("library_highlights").delete().eq("id", highlightId);
  if (error) throw new Error(error.message);
}

export async function toggleHighlightFavorite(highlightId: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase.from("library_highlights").update({ is_favorite: isFavorite }).eq("id", highlightId);
  if (error) throw new Error(error.message);
}

export async function updateHighlightNote(highlightId: string, note: string | null): Promise<void> {
  const { error } = await supabase.from("library_highlights").update({ note }).eq("id", highlightId);
  if (error) throw new Error(error.message);
}

/** Search a user's highlights (any book) by quoted text, trgm-indexed. */
export async function searchHighlights(userId: string, query: string): Promise<LibraryHighlightRow[]> {
  const term = query.trim().replace(/[%,]/g, "");
  if (!term) return [];
  const { data, error } = await supabase
    .from("library_highlights")
    .select(HIGHLIGHT_SELECT)
    .eq("user_id", userId)
    .ilike("quoted_text", `%${term}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryHighlightRow[];
}

/** Formats every highlight for a book as markdown — powers "export all" and
 *  "share quotes." Client-side formatting only, no new backend. */
export function formatHighlightsAsMarkdown(bookTitle: string, highlights: LibraryHighlightRow[]): string {
  const lines = [`# Highlights — ${bookTitle}`, ""];
  for (const h of highlights) {
    lines.push(`> ${h.quoted_text}`);
    if (h.note) lines.push(`*${h.note}*`);
    if (h.page_number != null) lines.push(`— p. ${h.page_number}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Shares a single highlight via the Web Share API when available, falling
 *  back to copying formatted text to the clipboard otherwise. */
export async function shareHighlight(bookTitle: string, highlight: LibraryHighlightRow): Promise<"shared" | "copied"> {
  const text = `"${highlight.quoted_text}"${highlight.page_number != null ? ` (p. ${highlight.page_number})` : ""} — ${bookTitle}`;
  if (navigator.share) {
    await navigator.share({ text, title: bookTitle });
    return "shared";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
