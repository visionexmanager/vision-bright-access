/**
 * useContinueReading — in-progress books, backed by the real
 * library_reading_progress table (Phase 3 — was localStorage in Phase 1).
 * RLS: user manages own rows.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

export interface ContinueReadingItem {
  book: LibraryBookRow;
  percent_complete: number;
  current_page: number | null;
  last_read_at: string;
  completed_at: string | null;
}

type ProgressRow = {
  percent_complete: number;
  current_page: number | null;
  last_read_at: string;
  completed_at: string | null;
  library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null;
};

export function useContinueReading() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.continueReading(uid),
    enabled: !!user,
    queryFn: async (): Promise<ContinueReadingItem[]> => {
      const { data, error } = await supabase
        .from("library_reading_progress")
        .select("percent_complete, current_page, last_read_at, completed_at, library_books(*, library_authors(name))")
        .eq("user_id", uid)
        .is("completed_at", null)
        .order("last_read_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as ProgressRow[])
        .filter((row) => row.library_books !== null)
        .map((row) => ({
          book: mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? ""),
          percent_complete: row.percent_complete,
          current_page: row.current_page,
          last_read_at: row.last_read_at,
          completed_at: row.completed_at,
        }));
    },
  });

  const setProgress = useCallback(
    async (bookId: string, percentComplete: number) => {
      if (!user) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("library_reading_progress").upsert(
        {
          user_id: uid,
          book_id: bookId,
          percent_complete: percentComplete,
          last_read_at: now,
          ...(percentComplete >= 100 ? { completed_at: now } : {}),
        },
        { onConflict: "user_id,book_id" }
      );
      if (error) {
        console.error("Failed to update reading progress:", error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.library.continueReading(uid) });
    },
    [user, uid, queryClient]
  );

  return { items, isLoading, error: error ? (error as Error).message : null, refetch, setProgress };
}
