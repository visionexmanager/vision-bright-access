// ─── Library — Reader Files Service (Phase 6) ─────────────────────────────
// library_book_files rows + signed URLs for the private library-book-files/
// library-audiobooks buckets. Both buckets' storage.objects SELECT policy is
// gated by can_access_library_book_content(((storage.foldername(name))[1])
// ::uuid) — objects live at `{book_id}/{filename}`, so RLS alone decides
// whether createSignedUrl succeeds; no edge function is needed, matching
// the existing getSignedVideoUrl precedent (services/ai-media-studio/
// videoStudioService.ts).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookFileRow } from "@/lib/types/library-reader";

export async function fetchBookFiles(bookId: string): Promise<LibraryBookFileRow[]> {
  const { data, error } = await supabase
    .from("library_book_files")
    .select("id, book_id, file_type, storage_path, file_url, file_size_bytes, is_primary, created_at")
    .eq("book_id", bookId);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookFileRow[];
}

/** Single file row by id — used by the audio player engine to resolve a
 *  chapter's (or a legacy single-file audiobook's) audio_file_id into a
 *  storage_path it can sign a URL for. */
export async function fetchBookFileById(fileId: string): Promise<LibraryBookFileRow | null> {
  const { data, error } = await supabase
    .from("library_book_files")
    .select("id, book_id, file_type, storage_path, file_url, file_size_bytes, is_primary, created_at")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LibraryBookFileRow) ?? null;
}

/** Fetches one chapter's content_text/content_url on demand — the reader
 *  loads one chapter at a time (see Performance in the Phase 6 plan) rather
 *  than holding every chapter's full text in memory at once. */
export async function fetchChapterContent(chapterId: string): Promise<{ content_text: string | null; content_url: string | null } | null> {
  const { data, error } = await supabase.from("library_chapters").select("content_text, content_url").eq("id", chapterId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSignedBookFileUrl(storagePath: string, bucket: "library-book-files" | "library-audiobooks", expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.warn(`Failed to sign ${bucket} URL:`, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
