// ─── Library — Series Service (Phase 10) ──────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibrarySeriesRow } from "@/lib/types/library-marketplace";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";

export async function fetchSeriesById(seriesId: string): Promise<LibrarySeriesRow | null> {
  const { data, error } = await supabase.from("library_series").select("id, title, slug, description, cover_image_url, author_id").eq("id", seriesId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibrarySeriesRow | null;
}

/** For the public /library/series/:slug route — SeriesSection.tsx links by
 *  slug (matching the collections/publishers URL convention), not id. */
export async function fetchSeriesBySlug(slug: string): Promise<LibrarySeriesRow | null> {
  const { data, error } = await supabase.from("library_series").select("id, title, slug, description, cover_image_url, author_id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibrarySeriesRow | null;
}

/** Every book in a series, in reading order (series_position). */
export async function fetchSeriesBooks(seriesId: string): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase
    .from("library_books")
    .select("*, library_authors(name), library_publishers(name)")
    .eq("series_id", seriesId)
    .eq("publish_status", "published")
    .order("series_position", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null }>)
    .map((row) => mapRawBookRow(row, row.library_authors?.name ?? "", row.library_publishers?.name ?? null));
}
