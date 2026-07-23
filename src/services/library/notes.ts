// ─── Library — Notes Service (Phase 6, enhanced in Phase 13 Learning Hub
// with voice/image notes, pinning, tags, and notebooks) ────────────────────
// Plain CRUD against library_notes (20260720000001_library_core_engagement.
// sql, widened in 20260802000000_library_learning_hub.sql).

import { supabase } from "@/integrations/supabase/client";
import type { LibrarySmartNoteRow, LibraryNoteType } from "@/lib/types/library-learning";

const NOTE_SELECT = "id, user_id, book_id, page_number, content, note_type, voice_url, image_url, is_pinned, tags, notebook_id, created_at, updated_at";

export async function fetchNotes(userId: string, bookId: string): Promise<LibrarySmartNoteRow[]> {
  const { data, error } = await supabase
    .from("library_notes")
    .select(NOTE_SELECT)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySmartNoteRow[];
}

export interface CreateNoteInput {
  noteType?: LibraryNoteType;
  voiceUrl?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  notebookId?: string | null;
}

export async function createNote(userId: string, bookId: string, pageNumber: number | null, content: string, opts: CreateNoteInput = {}): Promise<void> {
  const { error } = await supabase.from("library_notes").insert({
    user_id: userId, book_id: bookId, page_number: pageNumber, content,
    note_type: opts.noteType ?? "text",
    voice_url: opts.voiceUrl ?? null,
    image_url: opts.imageUrl ?? null,
    tags: opts.tags ?? [],
    notebook_id: opts.notebookId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateNote(noteId: string, content: string): Promise<void> {
  const { error } = await supabase.from("library_notes").update({ content }).eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("library_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function toggleNotePinned(noteId: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase.from("library_notes").update({ is_pinned: isPinned }).eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function updateNoteTags(noteId: string, tags: string[]): Promise<void> {
  const { error } = await supabase.from("library_notes").update({ tags }).eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function moveNoteToNotebook(noteId: string, notebookId: string | null): Promise<void> {
  const { error } = await supabase.from("library_notes").update({ notebook_id: notebookId }).eq("id", noteId);
  if (error) throw new Error(error.message);
}

/** Server-side search across a user's notes (any book), optionally scoped
 *  to a notebook or tag. Uses search_library_notes() RPC (pg_trgm-indexed). */
export async function searchAllNotes(query: string, notebookId?: string | null, tag?: string | null): Promise<LibrarySmartNoteRow[]> {
  const { data, error } = await supabase.rpc("search_library_notes", {
    _query: query, _notebook_id: notebookId ?? null, _tag: tag ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySmartNoteRow[];
}

/** Legacy single-book ILIKE search, kept for the in-reader notes panel. */
export async function searchNotes(userId: string, query: string): Promise<LibrarySmartNoteRow[]> {
  const term = query.trim().replace(/[%,]/g, "");
  if (!term) return [];
  const { data, error } = await supabase
    .from("library_notes")
    .select(NOTE_SELECT)
    .eq("user_id", userId)
    .ilike("content", `%${term}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySmartNoteRow[];
}

export async function uploadNoteMedia(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("library-learning-media").upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("library-learning-media").getPublicUrl(path);
  return data.publicUrl;
}

export function exportNotesAsMarkdown(bookTitle: string, notes: LibrarySmartNoteRow[]): string {
  const lines = [`# Notes — ${bookTitle}`, ""];
  for (const note of notes) {
    lines.push(`## ${note.is_pinned ? "📌 " : ""}${new Date(note.created_at).toLocaleDateString()}${note.page_number ? ` (page ${note.page_number})` : ""}`);
    if (note.tags.length > 0) lines.push(`*Tags: ${note.tags.join(", ")}*`);
    lines.push("", note.content, "");
  }
  return lines.join("\n");
}
