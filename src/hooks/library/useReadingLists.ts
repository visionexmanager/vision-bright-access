/**
 * useReadingLists — real Supabase-backed reading lists (Phase 11 — replaces
 * the Phase 1 localStorage version, which could never support real sharing
 * since a localStorage list is only ever visible in one browser).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchReadingLists,
  fetchSharedWithMeReadingLists,
  createReadingList,
  deleteReadingList,
  addBookToReadingList,
  removeBookFromReadingList,
  updateReadingListVisibility,
  type LibraryReadingListRow,
} from "@/services/library/readingLists";

export function useReadingLists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  const { data: lists = [], isLoading } = useQuery({
    queryKey: queryKeys.library.readingLists(uid),
    enabled: !!user,
    queryFn: () => fetchReadingLists(uid),
  });

  const { data: sharedLists = [] } = useQuery({
    queryKey: queryKeys.library.sharedReadingLists(uid),
    enabled: !!user,
    queryFn: () => fetchSharedWithMeReadingLists(uid),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.readingLists(uid) });
  }, [queryClient, uid]);

  const createList = useCallback(
    async (name: string, description?: string, visibility: LibraryReadingListRow["visibility"] = "private", listType: LibraryReadingListRow["list_type"] = "personal") => {
      if (!user) return;
      try {
        await createReadingList(uid, name, description ?? null, visibility, listType);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't create list", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, invalidate]
  );

  const addBookToList = useCallback(
    async (listId: string, bookId: string) => {
      if (!user) return;
      try {
        await addBookToReadingList(listId, bookId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't add book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, invalidate]
  );

  const removeBookFromList = useCallback(
    async (listId: string, bookId: string) => {
      if (!user) return;
      try {
        await removeBookFromReadingList(listId, bookId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't remove book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, invalidate]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      if (!user) return;
      try {
        await deleteReadingList(listId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't delete list", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, invalidate]
  );

  const setVisibility = useCallback(
    async (listId: string, visibility: LibraryReadingListRow["visibility"]) => {
      if (!user) return;
      try {
        await updateReadingListVisibility(listId, visibility);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update visibility", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, invalidate]
  );

  return { lists, sharedLists, isLoading, createList, addBookToList, removeBookFromList, deleteList, setVisibility };
}
