import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { DailyChallenge, WeeklyChallenge, SeasonEvent } from "@/features/visionkids/types/games.types";

/**
 * Daily and weekly challenges track progress in two separate tables with
 * identical shapes (user_id, challenge_id, current_value, completed_at).
 *
 * These used to be reached through a `table: string` parameter, which meant
 * postgrest could not resolve a row type from the table name and recursed
 * until TypeScript gave up. Passing the period instead and branching on it
 * keeps every `.from()` argument a literal, so each query is typed against
 * its real table.
 */
type ChallengePeriod = "daily" | "weekly";

interface ChallengeProgressRow {
  challenge_id: string;
  current_value: number;
  completed_at: string | null;
}

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
  return attachProgress(challenges ?? [], "daily");
}

export async function fetchWeeklyChallenges(): Promise<WeeklyChallenge[]> {
  const { data: challenges, error } = await kidsDb
    .from("kids_weekly_challenges").select("*").eq("week_start", mondayOfThisWeekIso())
    .returns<WeeklyChallenge[]>();
  if (error) throw error;
  return attachProgress(challenges ?? [], "weekly");
}

async function fetchProgressRows(period: ChallengePeriod, userId: string, challengeIds: string[]): Promise<ChallengeProgressRow[]> {
  const { data } = period === "daily"
    ? await kidsDb.from("kids_user_daily_challenge_progress")
        .select("challenge_id, current_value, completed_at").eq("user_id", userId).in("challenge_id", challengeIds)
    : await kidsDb.from("kids_user_weekly_challenge_progress")
        .select("challenge_id, current_value, completed_at").eq("user_id", userId).in("challenge_id", challengeIds);
  return data ?? [];
}

async function attachProgress<T extends { id: string }>(
  challenges: T[],
  period: ChallengePeriod
): Promise<(T & { progress?: { current_value: number; completed_at: string | null } })[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  if (!authData.user || challenges.length === 0) return challenges;

  const progressRows = await fetchProgressRows(period, authData.user.id, challenges.map((c) => c.id));
  const progressMap = new Map(
    progressRows.map((r) => [r.challenge_id, { current_value: r.current_value, completed_at: r.completed_at }])
  );

  return challenges.map((c) => ({ ...c, progress: progressMap.get(c.id) }));
}

async function readProgress(period: ChallengePeriod, userId: string, challengeId: string): Promise<Omit<ChallengeProgressRow, "challenge_id"> | null> {
  const { data } = period === "daily"
    ? await kidsDb.from("kids_user_daily_challenge_progress")
        .select("current_value, completed_at").eq("user_id", userId).eq("challenge_id", challengeId).maybeSingle()
    : await kidsDb.from("kids_user_weekly_challenge_progress")
        .select("current_value, completed_at").eq("user_id", userId).eq("challenge_id", challengeId).maybeSingle();
  return data;
}

async function writeProgress(period: ChallengePeriod, row: ChallengeProgressRow & { user_id: string }): Promise<void> {
  if (period === "daily") {
    await kidsDb.from("kids_user_daily_challenge_progress").upsert(row, { onConflict: "user_id,challenge_id" });
  } else {
    await kidsDb.from("kids_user_weekly_challenge_progress").upsert(row, { onConflict: "user_id,challenge_id" });
  }
}

async function bumpChallengeProgress(
  period: ChallengePeriod,
  challengeId: string,
  targetValue: number,
  incrementBy: number
): Promise<boolean> {
  const { data: authData } = await kidsDb.auth.getUser();
  const user_id = authData.user?.id;
  if (!user_id) return false;

  const existing = await readProgress(period, user_id, challengeId);

  const nextValue = (existing?.current_value ?? 0) + incrementBy;
  const alreadyCompleted = !!existing?.completed_at;
  const justCompleted = !alreadyCompleted && nextValue >= targetValue;

  await writeProgress(period, {
    user_id,
    challenge_id: challengeId,
    current_value: nextValue,
    completed_at: justCompleted ? new Date().toISOString() : existing?.completed_at ?? null,
  });

  return justCompleted;
}

export function bumpDailyChallengeProgress(challengeId: string, targetValue: number, incrementBy = 1) {
  return bumpChallengeProgress("daily", challengeId, targetValue, incrementBy);
}

export function bumpWeeklyChallengeProgress(challengeId: string, targetValue: number, incrementBy = 1) {
  return bumpChallengeProgress("weekly", challengeId, targetValue, incrementBy);
}

export async function fetchActiveSeasonEvents(): Promise<SeasonEvent[]> {
  const now = new Date().toISOString();
  const { data, error } = await kidsDb
    .from("kids_season_events").select("*").eq("is_active", true).lte("starts_at", now).gte("ends_at", now)
    .returns<SeasonEvent[]>();
  if (error) throw error;
  return data ?? [];
}
