// ─── Library — Chapter Version History Service (Phase 9) ─────────────────
// Wraps library_book_versions. Autosave coalescing (skip inserting a new
// autosave row if the last one is <2 minutes old) lives in useChapterEditor
// .ts — this file is a thin, unopinionated CRUD layer.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookVersionRow } from "@/lib/types/library-studio";

const VERSION_SELECT = "id, book_id, chapter_id, content_json, content_text, is_autosave, version_note, created_by, created_at";

export async function fetchVersions(chapterId: string, limit = 50): Promise<LibraryBookVersionRow[]> {
  const { data, error } = await supabase
    .from("library_book_versions")
    .select(VERSION_SELECT)
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookVersionRow[];
}

/** Most recent autosave row for this chapter, if any — used to decide
 *  whether a new autosave should insert a fresh row or the debounce window
 *  hasn't elapsed yet (see useChapterEditor.ts). */
export async function fetchLatestAutosave(chapterId: string): Promise<LibraryBookVersionRow | null> {
  const { data, error } = await supabase
    .from("library_book_versions")
    .select(VERSION_SELECT)
    .eq("chapter_id", chapterId)
    .eq("is_autosave", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryBookVersionRow | null;
}

export async function saveVersion(input: {
  book_id: string;
  chapter_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
  is_autosave: boolean;
  version_note?: string;
  created_by: string;
}): Promise<LibraryBookVersionRow> {
  const { data, error } = await supabase
    .from("library_book_versions")
    .insert({
      book_id: input.book_id,
      chapter_id: input.chapter_id,
      content_json: input.content_json,
      content_text: input.content_text,
      is_autosave: input.is_autosave,
      version_note: input.version_note ?? null,
      created_by: input.created_by,
    })
    .select(VERSION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as LibraryBookVersionRow;
}

/** Restoring copies the chosen version's content back onto the live
 *  chapter AND inserts a fresh version noting where it came from — restore
 *  is itself a new version, never a destructive history rewrite. */
export async function restoreVersion(version: LibraryBookVersionRow, restoredBy: string): Promise<void> {
  const { error: updateErr } = await supabase
    .from("library_chapters")
    .update({ content_json: version.content_json, content_text: version.content_text })
    .eq("id", version.chapter_id);
  if (updateErr) throw new Error(updateErr.message);

  await saveVersion({
    book_id: version.book_id,
    chapter_id: version.chapter_id,
    content_json: version.content_json,
    content_text: version.content_text,
    is_autosave: false,
    version_note: `Restored from ${new Date(version.created_at).toLocaleString()}`,
    created_by: restoredBy,
  });
}
