/**
 * useMyShelf — "My Library" shelf, backed by the real library_shelf_items
 * table (Phase 3 — was localStorage in Phase 1). RLS: user manages own rows.
 */

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

type ShelfRow = { book_id: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null };

export function useMyShelf() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.myShelf(uid),
    enabled: !!user,
    queryFn: async (): Promise<LibraryBookRow[]> => {
      const { data, error } = await supabase
        .from("library_shelf_items")
        .select("book_id, library_books(*, library_authors(name))")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as ShelfRow[])
        .filter((row) => row.library_books !== null)
        .map((row) => mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? ""));
    },
  });

  const shelfIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);

  const toggleShelf = useCallback(
    async (bookId: string) => {
      if (!user) return;
      const wasOnShelf = shelfIds.has(bookId);
      try {
        if (wasOnShelf) {
          const { error } = await supabase.from("library_shelf_items").delete().eq("user_id", uid).eq("book_id", bookId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("library_shelf_items").insert({ user_id: uid, book_id: bookId });
          if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.library.myShelf(uid) });
      } catch (err) {
        toast({ title: "Couldn't update your library", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, shelfIds, queryClient, toast]
  );

  const isOnShelf = useCallback((bookId: string) => shelfIds.has(bookId), [shelfIds]);

  return { books, isLoading, error: error ? (error as Error).message : null, refetch, toggleShelf, isOnShelf };
}
