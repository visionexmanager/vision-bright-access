/**
 * useDownloads — downloaded-for-offline books, backed by the real
 * library_downloads table (Phase 3 — was localStorage in Phase 1).
 *
 * library_downloads is an append-only download-event log (RLS only allows
 * SELECT-own and INSERT-own — there's deliberately no DELETE/UPDATE policy,
 * same as any real download history). So unlike the old localStorage
 * "toggle," downloading is one-way: `toggleDownload` logs a new download
 * event if the book isn't already downloaded, and is a no-op if it is —
 * there's no "un-download."
 */

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

type DownloadRow = { book_id: string; downloaded_at: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null };

export function useDownloads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.downloads(uid),
    enabled: !!user,
    queryFn: async (): Promise<LibraryBookRow[]> => {
      const { data, error } = await supabase
        .from("library_downloads")
        .select("book_id, downloaded_at, library_books(*, library_authors(name))")
        .eq("user_id", uid)
        .order("downloaded_at", { ascending: false });
      if (error) throw new Error(error.message);

      const seen = new Set<string>();
      const result: LibraryBookRow[] = [];
      for (const row of (data ?? []) as unknown as DownloadRow[]) {
        if (!row.library_books || seen.has(row.book_id)) continue;
        seen.add(row.book_id);
        result.push(mapRawBookRow(row.library_books, row.library_books.library_authors?.name ?? ""));
      }
      return result;
    },
  });

  const downloadedIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);

  const toggleDownload = useCallback(
    async (bookId: string) => {
      if (!user || downloadedIds.has(bookId)) return;
      const { error } = await supabase.from("library_downloads").insert({ user_id: uid, book_id: bookId });
      if (error) {
        toast({ title: "Couldn't start download", description: error.message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.library.downloads(uid) });
    },
    [user, uid, downloadedIds, queryClient]
  );

  const isDownloaded = useCallback((bookId: string) => downloadedIds.has(bookId), [downloadedIds]);

  return { books, isLoading, error: error ? (error as Error).message : null, refetch, toggleDownload, isDownloaded };
}
