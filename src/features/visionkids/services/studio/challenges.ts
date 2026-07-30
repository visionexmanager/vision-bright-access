import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { CreativeChallenge, ChallengeSubmission } from "@/features/visionkids/types/studio.types";

function mondayOfThisWeekIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

export async function fetchThisWeeksChallenges(): Promise<CreativeChallenge[]> {
  const { data, error } = await kidsDb
    .from("kids_creative_challenges").select("*").eq("week_start", mondayOfThisWeekIso())
    .returns<CreativeChallenge[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyChallengeSubmissions(): Promise<ChallengeSubmission[]> {
  const { data, error } = await kidsDb.from("kids_creative_challenge_submissions").select("*").returns<ChallengeSubmission[]>();
  if (error) throw error;
  return data ?? [];
}

export async function submitToChallenge(challengeId: string, projectId: string): Promise<void> {
  const { data: authData } = await kidsDb.auth.getUser();
  const user_id = authData.user?.id;
  if (!user_id) throw new Error("Must be signed in");
  const { error } = await kidsDb.from("kids_creative_challenge_submissions").insert({ challenge_id: challengeId, user_id, project_id: projectId });
  if (error && error.code !== "23505") throw error;
}
