import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsSocialChallenge, KidsSocialChallengeParticipant } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchActiveChallenges(): Promise<KidsSocialChallenge[]> {
  const { data, error } = await kidsDb
    .from("kids_social_challenges").select("*").eq("status", "active").order("ends_at")
    .returns<KidsSocialChallenge[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLeaderboard(challengeId: string, limit = 20): Promise<KidsSocialChallengeParticipant[]> {
  const { data, error } = await kidsDb
    .from("kids_social_challenge_participants").select("*").eq("challenge_id", challengeId).order("score", { ascending: false }).limit(limit)
    .returns<KidsSocialChallengeParticipant[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyParticipation(challengeId: string): Promise<KidsSocialChallengeParticipant | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_social_challenge_participants").select("*").eq("challenge_id", challengeId).eq("user_id", userId).maybeSingle()
    .returns<KidsSocialChallengeParticipant>();
  if (error) throw error;
  return data ?? null;
}

export async function joinChallenge(challengeId: string): Promise<void> {
  await bumpScore(challengeId, 1);
  await kidsDb.rpc("award_kids_xp", { _amount: 10, _reason: `Social challenge joined: ${challengeId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_coins", { _amount: 5, _reason: `Social challenge joined: ${challengeId}` }).then(() => {}, () => {});
}

export async function bumpScore(challengeId: string, increment: number): Promise<number> {
  const { data, error } = await kidsDb.rpc("bump_kids_social_challenge_score", { _challenge_id: challengeId, _increment: increment });
  if (error) throw error;
  return data as number;
}
