// ─── Library — Live Events (Phase 12: Reading Community) ──────────────────
// "Live Audio Rooms" reuse the existing generic voice_rooms + LiveKit
// infrastructure (see start_library_event_voice_room in the migration) —
// joining a live event's room navigates to the same /community/voice-room/:id
// route the top-level Community section already uses, rather than a
// parallel audio UI.

import { supabase } from "@/integrations/supabase/client";

export type LibraryEventType = "author_qa" | "book_launch" | "reading_session" | "live_audio" | "webinar" | "workshop" | "meetup";
export type LibraryEventRsvpStatus = "going" | "interested" | "declined";

export interface LibraryEventRow {
  id: string;
  event_type: LibraryEventType;
  title: string;
  description: string | null;
  host_id: string;
  club_id: string | null;
  book_id: string | null;
  author_id: string | null;
  cover_image_url: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  voice_room_id: string | null;
  max_attendees: number | null;
  is_cancelled: boolean;
  hostName: string;
}

const EVENT_SELECT = "id, event_type, title, description, host_id, club_id, book_id, author_id, cover_image_url, scheduled_start, scheduled_end, voice_room_id, max_attendees, is_cancelled";

async function resolveHostNames(hostIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(hostIds)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_library_public_profile_summaries", { _user_ids: unique });
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r: { user_id: string; display_name: string | null }) => [r.user_id, r.display_name ?? "Host"]));
}

export async function fetchUpcomingEvents(clubId?: string): Promise<LibraryEventRow[]> {
  let q = supabase.from("library_events").select(EVENT_SELECT).eq("is_cancelled", false).gte("scheduled_start", new Date().toISOString()).order("scheduled_start");
  q = clubId ? q.eq("club_id", clubId) : q.is("club_id", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<LibraryEventRow, "hostName">[];
  const names = await resolveHostNames(rows.map((r) => r.host_id));
  return rows.map((r) => ({ ...r, hostName: names.get(r.host_id) ?? "Host" }));
}

export async function fetchEvent(eventId: string): Promise<LibraryEventRow | null> {
  const { data, error } = await supabase.from("library_events").select(EVENT_SELECT).eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const names = await resolveHostNames([data.host_id]);
  return { ...data, hostName: names.get(data.host_id) ?? "Host" };
}

export interface LibraryEventInput {
  event_type: LibraryEventType;
  title: string;
  description: string | null;
  club_id: string | null;
  book_id: string | null;
  author_id: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  max_attendees: number | null;
}

export async function createEvent(hostId: string, input: LibraryEventInput): Promise<LibraryEventRow> {
  const { data, error } = await supabase.from("library_events").insert({ ...input, host_id: hostId }).select(EVENT_SELECT).single();
  if (error) throw new Error(error.message);
  return { ...data, hostName: "" };
}

export async function cancelEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("library_events").update({ is_cancelled: true }).eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function rsvpToEvent(eventId: string, status: LibraryEventRsvpStatus): Promise<void> {
  const { error } = await supabase.rpc("rsvp_library_event", { _event_id: eventId, _status: status });
  if (error) throw new Error(error.message);
}

export async function fetchMyRsvp(eventId: string, userId: string): Promise<LibraryEventRsvpStatus | null> {
  const { data, error } = await supabase.from("library_event_rsvps").select("status").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.status as LibraryEventRsvpStatus) ?? null;
}

export async function fetchRsvpCount(eventId: string): Promise<number> {
  const { count, error } = await supabase.from("library_event_rsvps").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "going");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Host-only — creates (or returns the existing) LiveKit-backed voice room
 *  for this event, returning its id so the caller can navigate to
 *  /community/voice-room/:id. */
export async function startEventVoiceRoom(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_library_event_voice_room", { _event_id: eventId });
  if (error) throw new Error(error.message);
  return data as string;
}
