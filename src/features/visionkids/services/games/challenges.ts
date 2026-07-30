import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { DailyChallenge, WeeklyChallenge, SeasonEvent } from "@/features/visionkids/types/games.types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfThisWeekIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export async function fetchDailyChallenges(): Promise<DailyChallenge[]> {
  const { data: challenges, error } = await kidsDb
    .from("kids_daily_challenges").select("*").eq("challenge_date", todayIso())
    .returns<DailyChallenge[]>();
  if (error) throw error;
  return attachProgress(challenges ?? [], "kids_user_daily_challenge_progress", "challenge_id");
}

export async function fetchWeeklyChallenges(): Promise<WeeklyChallenge[]> {
  const { data: challenges, error } = await kidsDb
    .from("kids_weekly_challenges").select("*").eq("week_start", mondayOfThisWeekIso())
    .returns<WeeklyChallenge[]>();
  if (error) throw error;
  return attachProgress(challenges ?? [], "kids_user_weekly_challenge_progress", "challenge_id");
}

async function attachProgress<T extends { id: string }>(
  challenges: T[],
  table: string,
  fkColumn: string
): Promise<(T & { progress?: { current_value: number; completed_at: string | null } })[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  if (!authData.user || challenges.length === 0) return challenges;

  const { data: progressRows } = await kidsDb
    .from(table)
    .select(`${fkColumn}, current_value, completed_at`)
    .eq("user_id", authData.user.id)
    .in(fkColumn, challenges.map((c) => c.id));

  const progressMap = new Map(
    ((progressRows ?? []) as Record<string, unknown>[]).map((r) => [r[fkColumn] as string, { current_value: r.current_value as number, completed_at: r.completed_at as string | null }])
  );

  return challenges.map((c) => ({ ...c, progress: progressMap.get(c.id) }));
}

async function bumpChallengeProgress(
  table: string,
  fkColumn: string,
  challengeId: string,
  targetValue: number,
  incrementBy: number
): Promise<boolean> {
  const { data: authData } = await kidsDb.auth.getUser();
  const user_id = authData.user?.id;
  if (!user_id) return false;

  const { data: existing } = await kidsDb
    .from(table).select("current_value, completed_at").eq("user_id", user_id).eq(fkColumn, challengeId).maybeSingle();

  const nextValue = ((existing as { current_value: number } | null)?.current_value ?? 0) + incrementBy;
  const alreadyCompleted = !!(existing as { completed_at: string | null } | null)?.completed_at;
  const justCompleted = !alreadyCompleted && nextValue >= targetValue;

  await kidsDb.from(table).upsert(
    { user_id, [fkColumn]: challengeId, current_value: nextValue, completed_at: justCompleted ? new Date().toISOString() : (existing as { completed_at: string | null } | null)?.completed_at ?? null },
    { onConflict: `user_id,${fkColumn}` }
  );

  return justCompleted;
}

export function bumpDailyChallengeProgress(challengeId: string, targetValue: number, incrementBy = 1) {
  return bumpChallengeProgress("kids_user_daily_challenge_progress", "challenge_id", challengeId, targetValue, incrementBy);
}

export function bumpWeeklyChallengeProgress(challengeId: string, targetValue: number, incrementBy = 1) {
  return bumpChallengeProgress("kids_user_weekly_challenge_progress", "challenge_id", challengeId, targetValue, incrementBy);
}

export async function fetchActiveSeasonEvents(): Promise<SeasonEvent[]> {
  const now = new Date().toISOString();
  const { data, error } = await kidsDb
    .from("kids_season_events").select("*").eq("is_active", true).lte("starts_at", now).gte("ends_at", now)
    .returns<SeasonEvent[]>();
  if (error) throw error;
  return data ?? [];
}
