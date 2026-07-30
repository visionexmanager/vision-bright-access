import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsEventAttendance } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

/** Called once when a child joins a live event's room — creates the
 *  attendance row that later gates the "event_participation" certificate. */
export async function checkIn(eventId: string): Promise<KidsEventAttendance> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_attendance").insert({ event_id: eventId, user_id: userId }).select("*").single()
    .returns<KidsEventAttendance>();
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 40, _reason: `Event attended: ${eventId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_coins", { _amount: 20, _reason: `Event attended: ${eventId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_achievement", { _key: "event_explorer" }).then(() => {}, () => {});
  return data;
}

export async function checkOut(attendanceId: string, durationSeconds: number): Promise<void> {
  const { error } = await kidsDb
    .from("kids_event_attendance")
    .update({ left_at: new Date().toISOString(), duration_seconds: durationSeconds })
    .eq("id", attendanceId);
  if (error) throw error;
}

export async function fetchMyAttendanceForEvent(eventId: string): Promise<KidsEventAttendance | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_attendance").select("*").eq("event_id", eventId).eq("user_id", userId)
    .order("joined_at", { ascending: false }).limit(1).maybeSingle()
    .returns<KidsEventAttendance>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchAttendanceCount(eventId: string): Promise<number> {
  const { count, error } = await kidsDb
    .from("kids_event_attendance").select("*", { count: "exact", head: true }).eq("event_id", eventId);
  if (error) throw error;
  return count ?? 0;
}
