/**
 * useBookmarks — a book's bookmarks for the signed-in viewer, with
 * add/rename/delete. RLS: user manages own rows.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookmarks, createBookmark, renameBookmark, deleteBookmark } from "@/services/library/bookmarks";

export function useBookmarks(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: queryKeys.library.bookmarks(bookId ?? "", uid),
    queryFn: () => fetchBookmarks(uid, bookId!),
    enabled: !!bookId && !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.bookmarks(bookId ?? "", uid) });
  }, [queryClient, bookId, uid]);

  const addBookmark = useCallback(
    async (pageNumber: number | null, position: Record<string, unknown>, label: string | null) => {
      if (!bookId || !user) return;
      try {
        await createBookmark(uid, bookId, pageNumber, position, label);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't add bookmark", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [bookId, user, uid, invalidate]
  );

  const rename = useCallback(
    async (bookmarkId: string, label: string) => {
      try {
        await renameBookmark(bookmarkId, label);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't rename bookmark", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const remove = useCallback(
    async (bookmarkId: string) => {
      try {
        await deleteBookmark(bookmarkId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't delete bookmark", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  return { bookmarks, isLoading, addBookmark, rename, remove };
}
