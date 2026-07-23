// ─── Library — Authors Service (Phase 3: real Supabase backend) ──────────────
// See catalog.ts header for the mock -> real swap contract. Note the frontend
// type uses `book_count` (singular "book") but the real column is
// `books_count` — mapped explicitly below, not renamed in the DB, to match
// the rest of the schema's naming (library_authors.books_count).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryAuthorRow } from "@/lib/types/library-author";
import type { LibraryOwnAuthorProfile } from "@/lib/types/library-studio";

type AuthorRow = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  books_count: number;
  follower_count: number;
  birth_year: number | null;
  nationality: string | null;
};

function mapAuthorRow(row: AuthorRow): LibraryAuthorRow {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    photo_url: row.photo_url,
    book_count: row.books_count,
    follower_count: row.follower_count,
    birth_year: row.birth_year,
    nationality: row.nationality,
  };
}

const AUTHOR_SELECT = "id, name, bio, photo_url, books_count, follower_count, birth_year, nationality";

export async function fetchAuthors(): Promise<LibraryAuthorRow[]> {
  const { data, error } = await supabase.from("library_authors").select(AUTHOR_SELECT).order("follower_count", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAuthorRow);
}

export async function fetchAuthorById(authorId: string): Promise<LibraryAuthorRow | null> {
  const { data, error } = await supabase.from("library_authors").select(AUTHOR_SELECT).eq("id", authorId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAuthorRow(data) : null;
}

export async function fetchFeaturedAuthors(limit = 6): Promise<LibraryAuthorRow[]> {
  const { data, error } = await supabase
    .from("library_authors")
    .select(AUTHOR_SELECT)
    .gt("books_count", 0)
    .order("follower_count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAuthorRow);
}

// ─── Publishing Studio — own-identity management (Phase 9) ────────────────

const OWN_PROFILE_SELECT = "id, user_id, name, slug, bio, photo_url, website_url, social_links";

/** Null if this account hasn't claimed/created an author profile yet — the
 *  Studio uses this to decide whether to show "Become an Author" or the
 *  dashboard. */
export async function fetchAuthorByUserId(userId: string): Promise<LibraryOwnAuthorProfile | null> {
  const { data, error } = await supabase.from("library_authors").select(OWN_PROFILE_SELECT).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryOwnAuthorProfile | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "author";
}

/** Self-service author-identity creation (library_authors.user_id is
 *  UNIQUE, so this is a one-time claim per account) — a plain client
 *  insert against the new "self-service create own" RLS policy, no edge
 *  function needed. Generates a unique slug by suffixing on collision. */
export async function createAuthorProfile(userId: string, fields: { name: string; bio?: string; photo_url?: string }): Promise<LibraryOwnAuthorProfile> {
  const base = slugify(fields.name);
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from("library_authors")
      .insert({ user_id: userId, name: fields.name, slug, bio: fields.bio ?? null, photo_url: fields.photo_url ?? null })
      .select(OWN_PROFILE_SELECT)
      .single();
    if (!error) return data as LibraryOwnAuthorProfile;
    if (error.code !== "23505") throw new Error(error.message); // not a unique-constraint collision — a real error
    slug = `${base}-${attempt + 2}`;
  }
  throw new Error("Couldn't generate a unique author URL — try a different name.");
}

export async function updateAuthorProfile(authorId: string, patch: Partial<Pick<LibraryOwnAuthorProfile, "name" | "bio" | "photo_url" | "website_url" | "social_links">>): Promise<void> {
  const { error } = await supabase.from("library_authors").update(patch).eq("id", authorId);
  if (error) throw new Error(error.message);
}

// ─── Follow/unfollow (Phase 9) ──────────────────────────────────────────
// library_author_followers previously didn't exist — follower_count had no
// write path at all. A trigger on this table maintains the counter and
// notifies the author (see the publishing studio migration).

export async function isFollowingAuthor(authorId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("library_author_followers").select("author_id").eq("author_id", authorId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function followAuthor(authorId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_author_followers").insert({ author_id: authorId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unfollowAuthor(authorId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_author_followers").delete().eq("author_id", authorId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
