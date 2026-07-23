// ─── Library — Reading Lists Service (Phase 11 — real backend) ───────────
// Replaces the Phase 1 localStorage-backed useReadingLists (libraryLocalStore.ts)
// with the real library_reading_lists/library_reading_list_items/
// library_reading_list_shares tables — a localStorage list can only ever be
// visible in the same browser, which made "shared"/"public"/"course"/
// "school" visibility meaningless before this. libraryLocalStore.ts's
// reading-list functions are now unused (kept for any other caller, but
// none remain after this change).

import { supabase } from "@/integrations/supabase/client";

export interface LibraryReadingListRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  visibility: "private" | "shared" | "public";
  list_type: "personal" | "course" | "school";
  cover_image_url: string | null;
  book_ids: string[];
  created_at: string;
  updated_at: string;
}

type RawListRow = Omit<LibraryReadingListRow, "book_ids"> & {
  library_reading_list_items: Array<{ book_id: string }>;
};

function mapList(row: RawListRow): LibraryReadingListRow {
  const { library_reading_list_items, ...rest } = row;
  return { ...rest, book_ids: (library_reading_list_items ?? []).map((i) => i.book_id) };
}

const LIST_SELECT = "*, library_reading_list_items(book_id)";

export async function fetchReadingLists(userId: string): Promise<LibraryReadingListRow[]> {
  const { data, error } = await supabase.from("library_reading_lists").select(LIST_SELECT).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawListRow[]).map(mapList);
}

/** Lists someone else shared with the caller (visibility='shared' +
 *  a library_reading_list_shares row) — distinct from the caller's own
 *  lists above. */
export async function fetchSharedWithMeReadingLists(userId: string): Promise<LibraryReadingListRow[]> {
  const { data, error } = await supabase
    .from("library_reading_list_shares")
    .select(`library_reading_lists!inner(${LIST_SELECT})`)
    .eq("shared_with_user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ library_reading_lists: RawListRow }>).map((row) => mapList(row.library_reading_lists));
}

export async function createReadingList(
  userId: string,
  name: string,
  description: string | null,
  visibility: LibraryReadingListRow["visibility"],
  listType: LibraryReadingListRow["list_type"]
): Promise<LibraryReadingListRow> {
  const { data, error } = await supabase
    .from("library_reading_lists")
    .insert({ user_id: userId, name, description, visibility, list_type: listType })
    .select(LIST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapList(data as unknown as RawListRow);
}

export async function deleteReadingList(listId: string): Promise<void> {
  const { error } = await supabase.from("library_reading_lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
}

export async function updateReadingListVisibility(listId: string, visibility: LibraryReadingListRow["visibility"]): Promise<void> {
  const { error } = await supabase.from("library_reading_lists").update({ visibility }).eq("id", listId);
  if (error) throw new Error(error.message);
}

export async function addBookToReadingList(listId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from("library_reading_list_items").upsert({ list_id: listId, book_id: bookId }, { onConflict: "list_id,book_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeBookFromReadingList(listId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from("library_reading_list_items").delete().eq("list_id", listId).eq("book_id", bookId);
  if (error) throw new Error(error.message);
}

export interface LibraryReadingListShare {
  list_id: string;
  shared_with_user_id: string;
  created_at: string;
}

export async function fetchReadingListShares(listId: string): Promise<LibraryReadingListShare[]> {
  const { data, error } = await supabase.from("library_reading_list_shares").select("*").eq("list_id", listId);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryReadingListShare[];
}

/** Resolves the email server-side and inserts the share row atomically
 *  (share_library_reading_list RPC) — returns false if no account matches
 *  that email, without revealing anything further. */
export async function shareReadingListByEmail(listId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("share_library_reading_list", { _list_id: listId, _email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function unshareReadingList(listId: string, sharedWithUserId: string): Promise<void> {
  const { error } = await supabase.from("library_reading_list_shares").delete().eq("list_id", listId).eq("shared_with_user_id", sharedWithUserId);
  if (error) throw new Error(error.message);
}
