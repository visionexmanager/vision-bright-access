// ─── Academy — Gamification Service Stubs (Phase 7 architecture prep) ────────
// Placeholder implementations, same pattern as every other services/academy/*
// file. The real (honest, single-browser) implementation the UI runs against
// today lives in src/lib/academy/gamificationLocalStore.ts.
//
// IMPORTANT: none of these functions award VX. VX is exclusively awarded via
// awardAcademyXP() in services/academy/academyService.ts, which calls the
// EXISTING award_academy_xp RPC. Achievements/missions here only decide
// *when* to call that existing bridge — they never touch user_points
// directly and never model a balance of their own.
//
// Leaderboards specifically require server-side cross-user aggregation that
// no client-only implementation can honestly provide — see
// AcademyLeaderboardEntry's doc comment in academy-gamification.ts.

import type {
  AcademyAchievementDef, AcademyUserAchievementRow, AcademyStreakRow,
  AcademyMissionDef, AcademyUserMissionProgressRow,
  AcademyLeaderboardEntry, AcademyLeaderboardScope, AcademyLeaderboardPeriod,
  AcademyLeaderboardPrivacyRow, AcademyLearningStatistics, AcademyCelebrationRow,
  AcademyCelebrationTargetType, AcademyCelebrationReaction, AcademySeasonalEventDef,
} from "@/lib/types/academy-gamification";

// ── Achievements ───────────────────────────────────────────────────────────────

export async function fetchAchievementCatalog(): Promise<AcademyAchievementDef[]> {
  return [];
}

export async function fetchUserAchievements(userId: string): Promise<AcademyUserAchievementRow[]> {
  void userId;
  return [];
}

// ── Streaks ────────────────────────────────────────────────────────────────────

export async function fetchStreak(userId: string): Promise<AcademyStreakRow | null> {
  void userId;
  return null;
}

export async function recordDailyActivity(userId: string): Promise<AcademyStreakRow | null> {
  void userId;
  return null;
}

// ── Missions ───────────────────────────────────────────────────────────────────

export async function fetchActiveMissions(scope: string): Promise<AcademyMissionDef[]> {
  void scope;
  return [];
}

export async function fetchMissionProgress(userId: string): Promise<AcademyUserMissionProgressRow[]> {
  void userId;
  return [];
}

// ── Leaderboards ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard(
  scope: AcademyLeaderboardScope,
  period: AcademyLeaderboardPeriod
): Promise<AcademyLeaderboardEntry[]> {
  void scope;
  void period;
  return [];
}

export async function fetchLeaderboardPrivacy(userId: string): Promise<AcademyLeaderboardPrivacyRow | null> {
  void userId;
  return null;
}

export async function updateLeaderboardPrivacy(
  userId: string,
  visible: boolean,
  displayName: string | null
): Promise<boolean> {
  void userId;
  void visible;
  void displayName;
  return false;
}

// ── Statistics ─────────────────────────────────────────────────────────────────

export async function fetchLearningStatistics(userId: string): Promise<AcademyLearningStatistics | null> {
  void userId;
  return null;
}

// ── Social ─────────────────────────────────────────────────────────────────────

export async function postCelebration(
  celebration: Omit<AcademyCelebrationRow, "id" | "created_at">
): Promise<AcademyCelebrationRow | null> {
  void celebration;
  return null;
}

export async function fetchCelebrations(
  targetType: AcademyCelebrationTargetType,
  targetRefId: string
): Promise<AcademyCelebrationRow[]> {
  void targetType;
  void targetRefId;
  return [];
}

export const CELEBRATION_REACTIONS: AcademyCelebrationReaction[] = ["congrats", "fire", "clap", "star"];

// ── Seasonal Events ────────────────────────────────────────────────────────────

export async function fetchActiveSeasonalEvents(): Promise<AcademySeasonalEventDef[]> {
  return [];
}
