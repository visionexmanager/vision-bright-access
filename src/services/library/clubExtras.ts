// ─── Library — Club Announcements + Shared Reading Schedule (Phase 12) ────

import { supabase } from "@/integrations/supabase/client";

export interface LibraryClubAnnouncementRow {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
}

export async function fetchClubAnnouncements(clubId: string): Promise<LibraryClubAnnouncementRow[]> {
  const { data, error } = await supabase.from("library_club_announcements").select("*").eq("club_id", clubId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryClubAnnouncementRow[];
}

export async function createClubAnnouncement(clubId: string, authorId: string, title: string, body: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase.from("library_club_announcements").insert({ club_id: clubId, author_id: authorId, title, body, is_pinned: isPinned });
  if (error) throw new Error(error.message);
}

export async function deleteClubAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("library_club_announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface LibraryClubScheduleRow {
  id: string;
  club_id: string;
  book_id: string;
  start_date: string;
  end_date: string | null;
  target_description: string | null;
  is_current: boolean;
  book_title?: string;
  book_cover_url?: string | null;
}

export async function fetchClubSchedule(clubId: string): Promise<LibraryClubScheduleRow[]> {
  const { data, error } = await supabase
    .from("library_club_reading_schedule")
    .select("*, library_books(title, cover_image_url)")
    .eq("club_id", clubId)
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<LibraryClubScheduleRow & { library_books: { title: string; cover_image_url: string | null } | null }>)
    .map((row) => ({ ...row, book_title: row.library_books?.title, book_cover_url: row.library_books?.cover_image_url ?? null }));
}

export async function setClubCurrentBook(clubId: string, bookId: string, createdBy: string, startDate: string, endDate: string | null, targetDescription: string | null): Promise<void> {
  // Retire any previously-current schedule row before inserting the new one.
  const { error: retireErr } = await supabase.from("library_club_reading_schedule").update({ is_current: false }).eq("club_id", clubId).eq("is_current", true);
  if (retireErr) throw new Error(retireErr.message);

  const { error } = await supabase.from("library_club_reading_schedule").insert({
    club_id: clubId, book_id: bookId, created_by: createdBy, start_date: startDate, end_date: endDate, target_description: targetDescription, is_current: true,
  });
  if (error) throw new Error(error.message);
}

export interface LibraryClubReadingProgressRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  percent_complete: number;
  completed_at: string | null;
}

export async function fetchClubReadingProgress(clubId: string): Promise<LibraryClubReadingProgressRow[]> {
  const { data, error } = await supabase.rpc("get_library_club_reading_progress", { _club_id: clubId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryClubReadingProgressRow[];
}
