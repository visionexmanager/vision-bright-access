/**
 * useInBookSearch — pure client-side search across a book's already-loaded
 * chapter text (useChapters already fetches every chapter's content_text in
 * one query — see that hook's header). No backend call needed at this
 * content scale; a substring/regex search over in-memory text is instant.
 */

import { useMemo, useState } from "react";
import type { ChapterWithStatus } from "@/hooks/library/useChapters";

export interface InBookSearchResult {
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  pageNumber: number | null;
  snippet: string;
  matchIndex: number;
}

const SNIPPET_RADIUS = 60;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function useInBookSearch(chapters: ChapterWithStatus[]) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo((): InBookSearchResult[] => {
    const term = query.trim();
    if (term.length < 2) return [];
    const re = new RegExp(escapeRegExp(term), "gi");
    const found: InBookSearchResult[] = [];
    for (const chapter of chapters) {
      const text = chapter.content_text ?? "";
      if (!text) continue;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const start = Math.max(0, match.index - SNIPPET_RADIUS);
        const end = Math.min(text.length, match.index + term.length + SNIPPET_RADIUS);
        found.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title || `Chapter ${chapter.chapter_number}`,
          chapterNumber: chapter.chapter_number,
          pageNumber: chapter.page_start,
          snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
          matchIndex: match.index,
        });
        if (found.length >= 200) return found; // sane cap for a pathological match count
      }
    }
    return found;
  }, [chapters, query]);

  const setQueryAndReset = (q: string) => {
    setQuery(q);
    setActiveIndex(0);
  };

  const next = () => setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
  const prev = () => setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));

  return { query, setQuery: setQueryAndReset, results, activeIndex, setActiveIndex, next, prev };
}
