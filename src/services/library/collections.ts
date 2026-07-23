// ─── Library — Collections Service (Phase 10) ─────────────────────────────
// Covers Editor's Choice/Staff Picks/Award Winners/Seasonal/Curated — one
// mechanism, parameterized by collection_type.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryCollectionRow } from "@/lib/types/library-marketplace";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import { logLibraryAuditEvent } from "@/services/library/auditLog";

export async function fetchCollectionsByType(type: LibraryCollectionRow["collection_type"], limit = 10): Promise<LibraryCollectionRow[]> {
  const { data, error } = await supabase
    .from("library_collections")
    .select("id, collection_type, slug, title, description, cover_image_url, starts_at, ends_at, is_active, display_order")
    .eq("collection_type", type)
    .order("display_order", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCollectionRow[];
}

export async function fetchCollectionBySlug(slug: string): Promise<LibraryCollectionRow | null> {
  const { data, error } = await supabase
    .from("library_collections")
    .select("id, collection_type, slug, title, description, cover_image_url, starts_at, ends_at, is_active, display_order")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryCollectionRow | null;
}

/** Books in a collection, in curator-defined order — reuses catalog.ts's
 *  mapRawBookRow so the returned shape matches every other book listing in
 *  the app exactly. */
export async function fetchCollectionBooks(collectionId: string, limit = 20): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_collection_books")
    .select("display_order, library_books(*, library_authors(name), library_publishers(name))")
    .eq("collection_id", collectionId)
    .order("display_order", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{ library_books: RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null } }>)
    .filter((row) => row.library_books)
    .map((row) => mapRawBookRow(row.library_books, row.library_books.library_authors?.name ?? "", row.library_books.library_publishers?.name ?? null));
}

// ─── Admin curation (Phase 11) ─────────────────────────────────────────────
// Every collection type/state (including inactive/scheduled/expired ones the
// public rails filter out) — the admin manager needs to see and edit all of
// them, not just what's currently live.

export async function fetchAllCollections(): Promise<LibraryCollectionRow[]> {
  const { data, error } = await supabase
    .from("library_collections")
    .select("id, collection_type, slug, title, description, cover_image_url, starts_at, ends_at, is_active, display_order")
    .order("collection_type", { ascending: true })
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCollectionRow[];
}

export interface CollectionInput {
  collection_type: LibraryCollectionRow["collection_type"];
  title: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export async function createCollection(input: CollectionInput): Promise<LibraryCollectionRow> {
  const { data, error } = await supabase.from("library_collections").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  await logLibraryAuditEvent("collection_created", "library_collection", data.id, { title: input.title, collection_type: input.collection_type });
  return data as LibraryCollectionRow;
}

export async function updateCollection(id: string, patch: Partial<CollectionInput>): Promise<void> {
  const { error } = await supabase.from("library_collections").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logLibraryAuditEvent("collection_updated", "library_collection", id, patch);
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from("library_collections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logLibraryAuditEvent("collection_deleted", "library_collection", id);
}

export async function addBookToCollection(collectionId: string, bookId: string, displayOrder = 0): Promise<void> {
  const { error } = await supabase.from("library_collection_books").upsert(
    { collection_id: collectionId, book_id: bookId, display_order: displayOrder },
    { onConflict: "collection_id,book_id" }
  );
  if (error) throw new Error(error.message);
}

export async function removeBookFromCollection(collectionId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from("library_collection_books").delete().eq("collection_id", collectionId).eq("book_id", bookId);
  if (error) throw new Error(error.message);
}

export async function reorderCollectionBooks(collectionId: string, orderedBookIds: string[]): Promise<void> {
  await Promise.all(
    orderedBookIds.map((bookId, index) =>
      supabase.from("library_collection_books").update({ display_order: index }).eq("collection_id", collectionId).eq("book_id", bookId)
    )
  );
}
