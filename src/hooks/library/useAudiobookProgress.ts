/**
 * useAudiobookProgress — reads/writes the single library_reading_progress
 * row for (user, book). Covers both the audiobook position (last_position
 * jsonb: {position_seconds, playback_rate}) and text-reading position
 * (last_position jsonb: {scroll_offset, chapter_id, anchor_id}) — Phase 2's
 * design intent for last_position was always "audio timestamp / epub CFI /
 * etc." on the SAME row, so ReadingProgressCard/AudiobookProgressCard
 * (Phase 5) and the Reader Engine's reflowable text pane (Phase 6) all
 * consume this one hook rather than each reading the table separately.
 *
 * Every upsert (audio or text) always spreads every tracked field —
 * current_page, percent_complete, AND last_position — from the latest known
 * state, never just the fields this particular call is changing. Without
 * that, a text-mode write could silently clobber an in-flight audio
 * position (or vice versa) on a hybrid ebook+audiobook title, since both
 * write paths share one row.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { LibraryLastPositionAudio, LibraryLastPositionText } from "@/lib/types/library-reader";

export interface LibraryReadingProgressRow {
  percent_complete: number;
  current_page: number | null;
  last_position: Partial<LibraryLastPositionAudio & LibraryLastPositionText>;
  last_read_at: string;
  completed_at: string | null;
}

const EMPTY_PROGRESS: LibraryReadingProgressRow = {
  percent_complete: 0,
  current_page: null,
  last_position: {},
  last_read_at: "",
  completed_at: null,
};

export function useAudiobookProgress(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const queryKey = ["library", "reading-progress", bookId ?? "", uid ?? ""] as const;

  const { data: progress = null, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<LibraryReadingProgressRow | null> => {
      const { data, error } = await supabase
        .from("library_reading_progress")
        .select("percent_complete, current_page, last_position, last_read_at, completed_at")
        .eq("user_id", uid)
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data as unknown as LibraryReadingProgressRow) : null;
    },
    enabled: !!bookId && !!uid,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  const current = progress ?? EMPTY_PROGRESS;

  const updatePosition = useCallback(
    async (positionSeconds: number, playbackRate: number, chapterId?: string, device?: string) => {
      if (!bookId || !uid) return;
      const { error } = await supabase.from("library_reading_progress").upsert(
        {
          user_id: uid,
          book_id: bookId,
          current_page: current.current_page,
          percent_complete: current.percent_complete,
          last_position: {
            position_seconds: positionSeconds,
            playback_rate: playbackRate,
            ...(chapterId ? { chapter_id: chapterId } : {}),
            ...(device ? { device } : {}),
          },
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      );
      if (error) {
        console.error("Failed to save audiobook position:", error.message);
        return;
      }
      invalidate();
    },
    [bookId, uid, current.current_page, current.percent_complete, invalidate]
  );

  /** Text-mode progress writer — the Reader Engine's reflowable text pane
   *  calls this on chapter/scroll change (debounced by the caller). */
  const updateTextProgress = useCallback(
    async (currentPage: number, percentComplete: number, lastPosition: LibraryLastPositionText) => {
      if (!bookId || !uid) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("library_reading_progress").upsert(
        {
          user_id: uid,
          book_id: bookId,
          current_page: currentPage,
          percent_complete: percentComplete,
          last_position: lastPosition,
          last_read_at: now,
          ...(percentComplete >= 100 ? { completed_at: now } : {}),
        },
        { onConflict: "user_id,book_id" }
      );
      if (error) {
        console.error("Failed to save reading progress:", error.message);
        return;
      }
      invalidate();
    },
    [bookId, uid, invalidate]
  );

  return { progress: current, hasStarted: !!progress, isLoading, updatePosition, updateTextProgress };
}
