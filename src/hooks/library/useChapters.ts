/**
 * useChapters — chapter list plus derived per-chapter read status. No
 * per-chapter progress table exists (or is needed): a chapter's status is
 * computed by comparing the book-level `current_page`
 * (library_reading_progress, via useAudiobookProgress's shared row) against
 * each chapter's page_start/page_end range — same "derive, don't store"
 * reasoning as the Phase 3 VX reward tier ladder.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchChaptersForBook } from "@/services/library/chapters";
import type { LibraryChapterRow } from "@/lib/types/library-book";

export type ChapterReadStatus = "read" | "in-progress" | "unread";

export interface ChapterWithStatus extends LibraryChapterRow {
  status: ChapterReadStatus;
  isLastRead: boolean;
}

export function useChapters(bookId: string | undefined, currentPage: number | null) {
  const { data: chapters = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.chapters(bookId ?? ""),
    queryFn: () => fetchChaptersForBook(bookId!),
    enabled: !!bookId,
  });

  const chaptersWithStatus = useMemo((): ChapterWithStatus[] => {
    if (currentPage == null) {
      return chapters.map((c) => ({ ...c, status: "unread" as const, isLastRead: false }));
    }

    let lastReadIndex = -1;
    const withStatus = chapters.map((c, i): ChapterWithStatus => {
      let status: ChapterReadStatus = "unread";
      if (c.page_start != null && c.page_end != null) {
        if (currentPage > c.page_end) status = "read";
        else if (currentPage >= c.page_start && currentPage <= c.page_end) status = "in-progress";
      } else if (c.page_start != null && currentPage > c.page_start) {
        status = "read";
      }
      if (status !== "unread") lastReadIndex = i;
      return { ...c, status, isLastRead: false };
    });

    if (lastReadIndex >= 0) withStatus[lastReadIndex] = { ...withStatus[lastReadIndex], isLastRead: true };
    return withStatus;
  }, [chapters, currentPage]);

  return { chapters: chaptersWithStatus, isLoading, error: error ? (error as Error).message : null, refetch };
}
