// ─── Library — Audiobooks Service (Phase 3: real Supabase backend, extended Phase 7) ─
// See catalog.ts header for the mock -> real swap contract. `audio_url` now
// maps to the audiobook's public sample_url (a short preview) rather than
// the full protected audio file — the full file lives in library_book_files
// behind purchase-gated storage RLS (20260720000004_library_storage.sql) and
// is only resolved at actual playback time (via getSignedBookFileUrl / the
// audio player engine), not in a listing query.
//
// Phase 7: fetchAudiobooks gained filter/sort/pagination options (narrator,
// category, free-only) — the join to library_books uses `!inner` so those
// filters can be applied against the embedded book row via Postgrest's
// dot-notation filtering on inner-joined resources.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryAudiobookRow } from "@/lib/types/library-audiobook";

type AudiobookRow = {
  id: string;
  book_id: string;
  audio_file_id: string | null;
  narrator_id: string | null;
  narrator_name: string | null;
  duration_seconds: number;
  chapter_count: number;
  sample_url: string | null;
  library_books: { title: string; cover_image_url: string | null; language: string; library_authors: { name: string } | null } | null;
};

const AUDIOBOOK_SELECT =
  "id, book_id, audio_file_id, narrator_id, narrator_name, duration_seconds, chapter_count, sample_url, library_books!inner(title, cover_image_url, language, is_free, category_id, library_authors(name))";

function mapAudiobookRow(row: AudiobookRow): LibraryAudiobookRow {
  return {
    id: row.id,
    book_id: row.book_id,
    title: row.library_books?.title ?? "",
    author_name: row.library_books?.library_authors?.name ?? "",
    narrator_id: row.narrator_id,
    narrator_name: row.narrator_name ?? "",
    cover_image_url: row.library_books?.cover_image_url ?? null,
    duration_seconds: row.duration_seconds,
    chapter_count: row.chapter_count,
    language: row.library_books?.language ?? "en",
    audio_file_id: row.audio_file_id,
    audio_url: row.sample_url,
  };
}

export interface FetchAudiobooksOptions {
  limit?: number;
  offset?: number;
  sort?: "newest" | "oldest" | "title";
  narratorId?: string;
  categoryId?: string;
  isFree?: boolean;
}

export async function fetchAudiobooks(options: FetchAudiobooksOptions = {}): Promise<LibraryAudiobookRow[]> {
  const { limit = 50, offset = 0, sort = "newest", narratorId, categoryId, isFree } = options;

  let query = supabase.from("library_audiobooks").select(AUDIOBOOK_SELECT);
  if (narratorId) query = query.eq("narrator_id", narratorId);
  if (categoryId) query = query.eq("library_books.category_id", categoryId);
  if (isFree !== undefined) query = query.eq("library_books.is_free", isFree);

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "title") query = query.order("title", { ascending: true, referencedTable: "library_books" });
  else query = query.order("created_at", { ascending: false });

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AudiobookRow[]).map(mapAudiobookRow);
}

export async function fetchAudiobookById(audiobookId: string): Promise<LibraryAudiobookRow | null> {
  const { data, error } = await supabase.from("library_audiobooks").select(AUDIOBOOK_SELECT).eq("id", audiobookId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAudiobookRow(data as unknown as AudiobookRow) : null;
}

/** Audiobooks for a specific set of book ids, in the order given — powers
 *  the "Most listened" rail, which ranks by book_id via a separate RPC
 *  (get_library_most_listened_books) and needs the matching audiobook rows
 *  hydrated afterward for display. */
export async function fetchAudiobooksByBookIds(bookIds: string[]): Promise<LibraryAudiobookRow[]> {
  if (bookIds.length === 0) return [];
  const { data, error } = await supabase.from("library_audiobooks").select(AUDIOBOOK_SELECT).in("book_id", bookIds);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as AudiobookRow[]).map(mapAudiobookRow);
  const byBookId = new Map(rows.map((r) => [r.book_id, r]));
  return bookIds.map((id) => byBookId.get(id)).filter((r): r is LibraryAudiobookRow => !!r);
}

/** The audio edition for a given book, plus the linked file's size (Phase 5
 *  AudiobookProgressCard's "file size" field) — RLS on library_book_files
 *  already gates that embed to whoever can actually access the content. */
export async function fetchAudiobookForBook(bookId: string): Promise<{ narratorName: string | null; durationSeconds: number; sampleUrl: string | null; fileSizeBytes: number | null } | null> {
  const { data, error } = await supabase
    .from("library_audiobooks")
    .select("narrator_name, duration_seconds, sample_url, library_book_files(file_size_bytes)")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const fileRow = data.library_book_files as unknown as { file_size_bytes: number | null } | null;
  return {
    narratorName: data.narrator_name,
    durationSeconds: data.duration_seconds,
    sampleUrl: data.sample_url,
    fileSizeBytes: fileRow?.file_size_bytes ?? null,
  };
}
