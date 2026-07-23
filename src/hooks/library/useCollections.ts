/**
 * useCollections — one hook, parameterized by collection_type, powers
 * Editor's Choice/Staff Picks/Award Winners/Seasonal/Curated rails on the
 * Home page. Works for audiobooks too for free (a collection just holds
 * book_ids, and audiobooks are library_books rows with book_type=
 * 'audiobook') — no separate audiobook-collections mechanism needed.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCollectionsByType, fetchCollectionBySlug, fetchCollectionBooks } from "@/services/library/collections";
import type { LibraryCollectionType } from "@/lib/types/library-marketplace";

export function useCollections(type: LibraryCollectionType) {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: queryKeys.library.collections(type),
    queryFn: () => fetchCollectionsByType(type),
  });
  return { collections, isLoading };
}

/** Books for one already-known collection id — used by CollectionRail so it
 *  doesn't have to re-fetch the collection row it already has from
 *  useCollections(). */
export function useCollectionBooks(collectionId: string | undefined) {
  const { data: books = [], isLoading } = useQuery({
    queryKey: queryKeys.library.collectionBooks(collectionId ?? ""),
    queryFn: () => fetchCollectionBooks(collectionId!),
    enabled: !!collectionId,
  });
  return { books, isLoading };
}

export function useCollectionDetail(slug: string | undefined) {
  const { data: collection, isLoading: isLoadingCollection } = useQuery({
    queryKey: queryKeys.library.collectionBySlug(slug ?? ""),
    queryFn: () => fetchCollectionBySlug(slug!),
    enabled: !!slug,
  });

  const { data: books = [], isLoading: isLoadingBooks } = useQuery({
    queryKey: queryKeys.library.collectionBooks(collection?.id ?? ""),
    queryFn: () => fetchCollectionBooks(collection!.id),
    enabled: !!collection,
  });

  return { collection: collection ?? null, books, isLoading: isLoadingCollection || isLoadingBooks };
}
