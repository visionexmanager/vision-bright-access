import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsEventMedal, KidsEventSubmission, KidsEventLimitedReward, MedalType } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

// ── Medals ──
export async function fetchEventMedals(eventId: string): Promise<KidsEventMedal[]> {
  const { data, error } = await kidsDb.from("kids_event_medals").select("*").eq("event_id", eventId).returns<KidsEventMedal[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyMedals(): Promise<KidsEventMedal[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb.from("kids_event_medals").select("*").eq("user_id", userId).returns<KidsEventMedal[]>();
  if (error) throw error;
  return data ?? [];
}

export async function awardMedal(eventId: string, userId: string, medalType: MedalType): Promise<void> {
  const moderatorId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_event_medals")
    .upsert({ event_id: eventId, user_id: userId, medal_type: medalType, awarded_by: moderatorId }, { onConflict: "event_id,user_id" });
  if (error) throw error;
}

// ── Competition submissions ──
export async function fetchSubmissions(eventId: string): Promise<KidsEventSubmission[]> {
  const { data, error } = await kidsDb
    .from("kids_event_submissions").select("*").eq("event_id", eventId).order("submitted_at", { ascending: false })
    .returns<KidsEventSubmission[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMySubmission(eventId: string): Promise<KidsEventSubmission | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_submissions").select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle()
    .returns<KidsEventSubmission>();
  if (error) throw error;
  return data ?? null;
}

export async function submitEntry(eventId: string, content?: string, fileUrl?: string): Promise<KidsEventSubmission> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_submissions")
    .upsert({ event_id: eventId, user_id: userId, content: content ?? null, file_url: fileUrl ?? null, submitted_at: new Date().toISOString() }, { onConflict: "event_id,user_id" })
    .select("*").single()
    .returns<KidsEventSubmission>();
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 30, _reason: `Competition entered: ${eventId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_coins", { _amount: 15, _reason: `Competition entered: ${eventId}` }).then(() => {}, () => {});
  return data;
}

// ── Limited rewards ──
export async function fetchLimitedRewards(): Promise<KidsEventLimitedReward[]> {
  const { data, error } = await kidsDb
    .from("kids_event_limited_rewards").select("*").order("created_at", { ascending: false })
    .returns<KidsEventLimitedReward[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyClaimedRewardIds(): Promise<string[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb.from("kids_user_limited_rewards").select("reward_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.reward_id as string);
}

export async function claimLimitedReward(rewardId: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("claim_kids_limited_reward", { _reward_id: rewardId });
  if (error) throw error;
  return !!data;
}
