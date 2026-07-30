import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsEventRegistration } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

/** parental_approval_status is decided server-side inside this RPC (based
 *  on whether the caller has a linked parent) — never settable by the
 *  client. See register_for_kids_event()'s own comment. */
export async function registerForEvent(eventId: string): Promise<KidsEventRegistration> {
  const { data, error } = await kidsDb.rpc("register_for_kids_event", { _event_id: eventId }).single();
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 10, _reason: `Event registered: ${eventId}` }).then(() => {}, () => {});
  return data as KidsEventRegistration;
}

export async function cancelRegistration(registrationId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_event_registrations").update({ status: "cancelled" }).eq("id", registrationId);
  if (error) throw error;
}

export async function fetchMyRegistration(eventId: string): Promise<KidsEventRegistration | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_registrations").select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle()
    .returns<KidsEventRegistration>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMyRegistrations(): Promise<KidsEventRegistration[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_registrations").select("*").eq("user_id", userId).order("registered_at", { ascending: false })
    .returns<KidsEventRegistration[]>();
  if (error) throw error;
  return data ?? [];
}

/** For a linked parent: every pending-approval registration across all
 *  their children. */
export async function fetchPendingApprovalsForChild(childUserId: string): Promise<KidsEventRegistration[]> {
  const { data, error } = await kidsDb
    .from("kids_event_registrations").select("*").eq("user_id", childUserId).eq("parental_approval_status", "pending")
    .returns<KidsEventRegistration[]>();
  if (error) throw error;
  return data ?? [];
}

export async function decideRegistration(registrationId: string, approve: boolean): Promise<void> {
  const { error } = await kidsDb.rpc("decide_kids_event_registration", { _registration_id: registrationId, _approve: approve });
  if (error) throw error;
}
