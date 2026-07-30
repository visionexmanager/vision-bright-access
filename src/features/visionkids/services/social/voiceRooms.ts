import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsVoiceRoom, KidsVoiceRoomMember } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

const FALLBACK_LIVEKIT_URL = "wss://visionex-hn3vb5hz.livekit.cloud";

function resolveLiveKitUrl(): string {
  const configured = (import.meta.env.VITE_LIVEKIT_URL as string | undefined)?.trim().replace(/^["']|["']$/g, "");
  if (!configured || configured.includes("YOUR_PROJECT") || !configured.startsWith("wss://")) return FALLBACK_LIVEKIT_URL;
  return configured;
}

/** Kids voice rooms reuse the SAME livekit-token edge function the adult
 *  site uses (see that function's own header comment) — room ids are
 *  namespaced client-side (`kids-<uuid>`) so a kids room can never collide
 *  with, or be joined via, an adult room id. */
export async function fetchLiveKitToken(roomId: string, userName: string): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: { roomId: `kids-${roomId}`, userName } });
  if (error) throw error;
  if (!data?.token) throw new Error(data?.error || "Could not get a voice room token");
  return { token: data.token, url: data.url || resolveLiveKitUrl() };
}

export async function fetchVoiceRooms(): Promise<KidsVoiceRoom[]> {
  const { data, error } = await kidsDb
    .from("kids_voice_rooms").select("*").in("status", ["scheduled", "live"]).order("created_at", { ascending: false })
    .returns<KidsVoiceRoom[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchVoiceRoom(roomId: string): Promise<KidsVoiceRoom | null> {
  const { data, error } = await kidsDb.from("kids_voice_rooms").select("*").eq("id", roomId).maybeSingle().returns<KidsVoiceRoom>();
  if (error) throw error;
  return data ?? null;
}

export interface CreateVoiceRoomInput {
  roomName: string;
  topic?: string;
  groupId?: string;
  maxUsers?: number;
}

export async function createVoiceRoom(input: CreateVoiceRoomInput): Promise<KidsVoiceRoom> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_voice_rooms")
    .insert({ owner_id: userId, room_name: input.roomName, topic: input.topic ?? null, group_id: input.groupId ?? null, max_users: input.maxUsers ?? 12 })
    .select("*").single()
    .returns<KidsVoiceRoom>();
  if (error) throw error;

  await kidsDb.rpc("award_kids_achievement", { _key: "voice_room_host" }).then(() => {}, () => {});
  return data;
}

export async function endVoiceRoom(roomId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_voice_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
  if (error) throw error;
}

export async function fetchRoomMembers(roomId: string): Promise<KidsVoiceRoomMember[]> {
  const { data, error } = await kidsDb.from("kids_voice_room_members").select("*").eq("room_id", roomId).returns<KidsVoiceRoomMember[]>();
  if (error) throw error;
  return data ?? [];
}

export async function joinVoiceRoom(roomId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_voice_room_members").upsert({ room_id: roomId, user_id: userId }, { onConflict: "room_id,user_id" });
  if (error) throw error;
}

export async function leaveVoiceRoom(roomId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_voice_room_members").delete().eq("room_id", roomId).eq("user_id", userId);
  if (error) throw error;
}

export async function raiseHand(roomId: string, raised: boolean): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_voice_room_members")
    .update({ raised_at: raised ? new Date().toISOString() : null })
    .eq("room_id", roomId).eq("user_id", userId);
  if (error) throw error;
}

/** Moderator/owner-only in practice — the "lock privileged fields"
 *  trigger on kids_voice_room_members reverts this if the caller isn't a
 *  moderator, so this is safe to expose to any member's client. */
export async function setMemberMuted(roomId: string, userId: string, muted: boolean): Promise<void> {
  const { error } = await kidsDb.from("kids_voice_room_members").update({ is_muted: muted }).eq("room_id", roomId).eq("user_id", userId);
  if (error) throw error;
}

export async function promoteToModerator(roomId: string, userId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_voice_room_members").update({ role: "moderator" }).eq("room_id", roomId).eq("user_id", userId);
  if (error) throw error;
}

export async function banFromRoom(roomId: string, userId: string): Promise<void> {
  const moderatorId = await requireUserId();
  const { error } = await kidsDb.from("kids_voice_room_bans").insert({ room_id: roomId, user_id: userId, banned_by: moderatorId });
  if (error) throw error;
  await kidsDb.from("kids_voice_room_members").delete().eq("room_id", roomId).eq("user_id", userId);
}

/** Returns false if the toggle was denied (missing parental consent from
 *  at least one member) — see set_kids_voice_room_recording()'s own
 *  comment on what "recording" actually means here. */
export async function setRoomRecording(roomId: string, active: boolean): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("set_kids_voice_room_recording", { _room_id: roomId, _active: active });
  if (error) throw error;
  return !!data;
}
