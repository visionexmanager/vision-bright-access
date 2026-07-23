/**
 * useCollectionsAdmin — admin CRUD for curated collections (Editor's
 * Choice/Staff Picks/Award Winners/Seasonal/Curated — one mechanism,
 * see collections.ts). Distinct from useCollections (Phase 10, reader-
 * facing, active-only) — this sees every collection regardless of state.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchAllCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addBookToCollection,
  removeBookFromCollection,
  reorderCollectionBooks,
  type CollectionInput,
} from "@/services/library/collections";

export function useCollectionsAdmin() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: queryKeys.library.allCollections(),
    queryFn: fetchAllCollections,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.allCollections() });

  const create = useCallback(async (input: CollectionInput) => {
    setIsSaving(true);
    try {
      await createCollection(input);
      invalidate();
      toast({ title: "Collection created" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      toast({ title: "Couldn't create collection", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: Partial<CollectionInput>) => {
    try {
      await updateCollection(id, patch);
      invalidate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      toast({ title: "Couldn't update collection", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteCollection(id);
      invalidate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      toast({ title: "Couldn't delete collection", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, []);

  return { collections, isLoading, isSaving, create, update, remove };
}

export function useCollectionBooksAdmin(collectionId: string) {
  const queryClient = useQueryClient();

  const invalidateBooks = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.collectionBooks(collectionId) });

  const addBook = async (bookId: string, displayOrder = 0) => {
    try {
      await addBookToCollection(collectionId, bookId, displayOrder);
      invalidateBooks();
    } catch (err) {
      toast({ title: "Couldn't add book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeBook = async (bookId: string) => {
    try {
      await removeBookFromCollection(collectionId, bookId);
      invalidateBooks();
    } catch (err) {
      toast({ title: "Couldn't remove book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const reorder = async (orderedBookIds: string[]) => {
    try {
      await reorderCollectionBooks(collectionId, orderedBookIds);
      invalidateBooks();
    } catch (err) {
      toast({ title: "Couldn't reorder books", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { addBook, removeBook, reorder };
}
