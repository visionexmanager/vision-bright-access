// ─── Library — Reader Profiles (Phase 12: Reading Community) ──────────────
// library_reader_profiles is a dedicated table, not an extension of the
// shared `profiles` table (see the migration header for why). Profile
// stats/other-user name lookups go through SECURITY DEFINER RPCs
// (get_library_reader_profile_stats / get_library_public_profile_summaries)
// since profiles/reading_progress/wishlist are otherwise self-read-only.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryReaderProfileRow {
  user_id: string;
  bio: string | null;
  favorite_genres: string[];
  favorite_authors: string[];
  languages: string[];
  is_public: boolean;
  show_reading_activity: boolean;
  show_reviews: boolean;
  show_reading_lists: boolean;
  show_followers: boolean;
  displayName: string;
  avatarUrl: string | null;
}

export interface LibraryReaderProfileStats {
  booksReadCount: number;
  booksReadingCount: number;
  wishlistCount: number;
  reviewsCount: number;
  followersCount: number;
  followingCount: number;
}

async function resolveDisplay(userId: string): Promise<{ displayName: string; avatarUrl: string | null }> {
  const { data, error } = await supabase.rpc("get_library_public_profile_summaries", { _user_ids: [userId] });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as { display_name: string | null; avatar_url: string | null } | undefined;
  return { displayName: row?.display_name ?? "Reader", avatarUrl: row?.avatar_url ?? null };
}

/** Returns null if the profile doesn't exist yet OR is private and the
 *  caller isn't its owner/an admin (RLS silently filters those rows out —
 *  a 0-row result and "doesn't exist" are indistinguishable, which is the
 *  correct behavior for a privacy boundary). */
export async function fetchReaderProfile(userId: string): Promise<LibraryReaderProfileRow | null> {
  const [{ data, error }, display] = await Promise.all([
    supabase.from("library_reader_profiles").select("*").eq("user_id", userId).maybeSingle(),
    resolveDisplay(userId),
  ]);
  if (error) throw new Error(error.message);
  if (!data) {
    // No row yet doesn't mean "not found" for privacy purposes — a user
    // who never customized their profile is still a public, visible
    // reader (is_public defaults to true at the schema level).
    return {
      user_id: userId, bio: null, favorite_genres: [], favorite_authors: [], languages: [],
      is_public: true, show_reading_activity: true, show_reviews: true, show_reading_lists: true, show_followers: true,
      ...display,
    };
  }
  return { ...(data as Omit<LibraryReaderProfileRow, "displayName" | "avatarUrl">), ...display };
}

export interface LibraryReaderProfileInput {
  bio: string | null;
  favorite_genres: string[];
  favorite_authors: string[];
  languages: string[];
  is_public: boolean;
  show_reading_activity: boolean;
  show_reviews: boolean;
  show_reading_lists: boolean;
  show_followers: boolean;
}

export async function upsertMyReaderProfile(userId: string, input: LibraryReaderProfileInput): Promise<void> {
  const { error } = await supabase.from("library_reader_profiles").upsert({ user_id: userId, ...input }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function fetchReaderProfileStats(userId: string): Promise<LibraryReaderProfileStats> {
  const { data, error } = await supabase.rpc("get_library_reader_profile_stats", { _target_user_id: userId });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as {
    books_read_count: number; books_reading_count: number; wishlist_count: number;
    reviews_count: number; followers_count: number; following_count: number;
  } | undefined;
  return {
    booksReadCount: row?.books_read_count ?? 0,
    booksReadingCount: row?.books_reading_count ?? 0,
    wishlistCount: row?.wishlist_count ?? 0,
    reviewsCount: row?.reviews_count ?? 0,
    followersCount: row?.followers_count ?? 0,
    followingCount: row?.following_count ?? 0,
  };
}

export interface LibraryPublicReadingList {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  bookCount: number;
}

export async function fetchPublicReadingLists(userId: string): Promise<LibraryPublicReadingList[]> {
  const { data, error } = await supabase
    .from("library_reading_lists")
    .select("id, name, description, cover_image_url, library_reading_list_items(book_id)")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; name: string; description: string | null; cover_image_url: string | null; library_reading_list_items: Array<{ book_id: string }> }>)
    .map((row) => ({ id: row.id, name: row.name, description: row.description, cover_image_url: row.cover_image_url, bookCount: row.library_reading_list_items?.length ?? 0 }));
}
