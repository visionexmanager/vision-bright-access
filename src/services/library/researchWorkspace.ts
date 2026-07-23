// ─── Library — Knowledge & Research Platform: Research Workspace ───────────

import { supabase } from "@/integrations/supabase/client";

export interface LibraryBookSearchHit {
  id: string;
  title: string;
  author_name: string;
  cover_image_url: string | null;
}

/** Lightweight title search for book-picker UIs (Research Assistant's
 *  multi-book selector, project item search) — plain ILIKE, not the
 *  semantic/AI search used for the main search experience, since picking a
 *  book you already know by name doesn't need embeddings. */
export async function searchBooksByTitle(query: string, limit = 8): Promise<LibraryBookSearchHit[]> {
  const term = query.trim().replace(/[%,]/g, "");
  if (!term) return [];
  const { data, error } = await supabase
    .from("library_books")
    .select("id, title, cover_image_url, library_authors(name)")
    .ilike("title", `%${term}%`)
    .eq("publish_status", "published")
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; title: string; cover_image_url: string | null; library_authors: { name: string } | null }>)
    .map((r) => ({ id: r.id, title: r.title, cover_image_url: r.cover_image_url, author_name: r.library_authors?.name ?? "" }));
}

export interface LibraryAuthorSearchHit {
  id: string;
  name: string;
}

export async function searchAuthorsByName(query: string, limit = 8): Promise<LibraryAuthorSearchHit[]> {
  const term = query.trim().replace(/[%,]/g, "");
  if (!term) return [];
  const { data, error } = await supabase.from("library_authors").select("id, name").ilike("name", `%${term}%`).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryAuthorSearchHit[];
}

export interface LibraryOwnNoteHit {
  id: string;
  content: string;
  book_title: string;
}

/** All of the current user's notes across every book — used by the Research
 *  Workspace's "add item" picker, distinct from notes.ts's fetchNotes() which
 *  is scoped to a single book (the reader's Smart Notes panel). */
export async function fetchAllUserNotes(userId: string, limit = 50): Promise<LibraryOwnNoteHit[]> {
  const { data, error } = await supabase
    .from("library_notes").select("id, content, library_books(title)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; content: string; library_books: { title: string } | null }>)
    .map((r) => ({ id: r.id, content: r.content, book_title: r.library_books?.title ?? "" }));
}

export interface LibraryOwnHighlightHit {
  id: string;
  quoted_text: string;
  book_title: string;
}

export async function fetchAllUserHighlights(userId: string, limit = 50): Promise<LibraryOwnHighlightHit[]> {
  const { data, error } = await supabase
    .from("library_highlights").select("id, quoted_text, library_books(title)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; quoted_text: string; library_books: { title: string } | null }>)
    .map((r) => ({ id: r.id, quoted_text: r.quoted_text, book_title: r.library_books?.title ?? "" }));
}
