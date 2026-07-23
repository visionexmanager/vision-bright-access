/**
 * useFavorites — favorited books, backed by the real library_favorites
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

type FavoriteRow = { book_id: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null }) | null };

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.favorites(uid),
    enabled: !!user,
    queryFn: async (): Promise<LibraryBookRow[]> => {
      const { data, error } = await supabase
        .from("library_favorites")
        .select("book_id, library_books(*, library_authors(name))")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as FavoriteRow[])
        .filter((row) => row.library_books !== null)
        .map((row) => mapRawBookRow(row.library_books!, row.library_books!.library_authors?.name ?? ""));
    },
  });

  const favoriteIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);

  const toggleFavorite = useCallback(
    async (bookId: string) => {
      if (!user) return;
      const wasFavorite = favoriteIds.has(bookId);
      try {
        if (wasFavorite) {
          const { error } = await supabase.from("library_favorites").delete().eq("user_id", uid).eq("book_id", bookId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("library_favorites").insert({ user_id: uid, book_id: bookId });
          if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.library.favorites(uid) });
      } catch (err) {
        toast({ title: "Couldn't update favorites", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, favoriteIds, queryClient]
  );

  const isFavorite = useCallback((bookId: string) => favoriteIds.has(bookId), [favoriteIds]);

  return { books, isLoading, error: error ? (error as Error).message : null, refetch, toggleFavorite, isFavorite };
}
