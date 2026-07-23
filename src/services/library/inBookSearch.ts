// ─── Library — Search Inside a Book (Phase 11) ─────────────────────────────
// Client wrapper for search_inside_library_book(), which full-text-searches
// a book's chapter content server-side (respecting free-preview/purchase
// access) — distinct from useInBookSearch.ts's client-side scan, which only
// works once a book's chapters are already loaded in the reader. This lets a
// reader search inside a book they haven't opened yet, e.g. from the book's
// details page.
//
// Scope: this only searches library_chapters.content_text — plain-text
// chapter content already extracted at import/authoring time. It does NOT
// OCR scanned page images or transcribe audiobook audio; no such pipeline
// exists in this app, and none is faked here. A book with no extracted text
// (e.g. an image-only PDF) simply returns no matches.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryInBookSearchResult {
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  /** Split on \x01/\x02 markers (see the migration) to highlight matches
   *  without ever rendering book content as raw HTML. */
  snippetParts: Array<{ text: string; matched: boolean }>;
  rank: number;
}

const MATCH_START = "\x01";
const MATCH_END = "\x02";

function parseSnippet(snippet: string): Array<{ text: string; matched: boolean }> {
  const parts: Array<{ text: string; matched: boolean }> = [];
  let rest = snippet;
  while (rest.length > 0) {
    const start = rest.indexOf(MATCH_START);
    if (start === -1) {
      parts.push({ text: rest, matched: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), matched: false });
    const end = rest.indexOf(MATCH_END, start + 1);
    if (end === -1) {
      parts.push({ text: rest.slice(start + 1), matched: true });
      break;
    }
    parts.push({ text: rest.slice(start + 1, end), matched: true });
    rest = rest.slice(end + 1);
  }
  return parts;
}

export async function searchInsideBook(bookId: string, query: string): Promise<LibraryInBookSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_inside_library_book", { _book_id: bookId, _query: query.trim() });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{ chapter_id: string; chapter_title: string; chapter_number: number; snippet: string; rank: number }>).map((row) => ({
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    chapterNumber: row.chapter_number,
    snippetParts: parseSnippet(row.snippet ?? ""),
    rank: row.rank,
  }));
}
