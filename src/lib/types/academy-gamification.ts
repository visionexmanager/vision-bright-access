/**
 * Academy — Gamification Types (Phase 7 architecture prep)
 *
 * Achievements/badges/streaks/missions/leaderboards/collections are all
 * Academy-specific progress/collectible systems — NOT currency. None of
 * these award VX directly; when a gamification event should grant VX it
 * goes through the EXISTING award_academy_xp() bridge (see
 * lib/types/academy.ts's AcademyXPReason + services/academy/academyService.ts).
 * This file never models a wallet/balance of its own.
 */

// ── Achievements ───────────────────────────────────────────────────────────────
// Planned table: academy_achievements (catalog) + academy_user_achievements (unlocks)
// The catalog itself is fixed game-design content (same precedent as
// XP_LEVELS in lib/academy/xp.ts) — user unlock state is what's dynamic.

export type AcademyAchievementCategory =
  | "learning" | "courses" | "projects" | "certificates" | "community"
  | "reading" | "consistency" | "milestones" | "instructor" | "special_events";

export type AcademyBadgeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legendary";

export interface AcademyAchievementDef {
  id: string;
  category: AcademyAchievementCategory;
  title: string;
  description: string;
  tier: AcademyBadgeTier;
  icon: string; // lucide icon name, resolved by the UI layer
  /** Hidden achievements don't reveal their title/description until unlocked. */
  hidden: boolean;
  /** Reserved for a real animated-badge asset later — no asset pipeline yet. */
  animatedAssetPrepared: boolean;
}

export interface AcademyUserAchievementRow {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

// ── Badges ─────────────────────────────────────────────────────────────────────
// A badge is the visual/collectible representation of an achievement tier —
// no separate unlock table; badges are derived 1:1 from unlocked achievements.

export interface AcademyBadgeDisplay {
  achievement_id: string;
  tier: AcademyBadgeTier;
  title: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

// ── Streaks ────────────────────────────────────────────────────────────────────
// Planned table: academy_learning_streaks (one row per user)

export interface AcademyStreakRow {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string; // YYYY-MM-DD
  /** Prepared, not yet consumable — "streak freeze" (skip a day without breaking the streak). */
  freeze_tokens_available: number;
  freeze_tokens_used_total: number;
}

export const STREAK_MILESTONES = [3, 7, 15, 30, 100, 365] as const;

// ── Missions ───────────────────────────────────────────────────────────────────
// Planned tables: academy_missions (catalog) + academy_user_mission_progress

export type AcademyMissionScope = "daily" | "weekly" | "monthly" | "seasonal";
export type AcademyMissionActionType =
  | "watch_lessons" | "complete_quizzes" | "finish_projects" | "read_resources"
  | "community_help" | "study_minutes" | "perfect_quiz" | "login";

export interface AcademyMissionDef {
  id: string;
  scope: AcademyMissionScope;
  title: string;
  description: string;
  action_type: AcademyMissionActionType;
  target_count: number;
  xp_reason: string; // AcademyXPReason value awarded on completion, via the existing bridge
}

export interface AcademyUserMissionProgressRow {
  user_id: string;
  mission_id: string;
  /** e.g. "2026-W27" for weekly, "2026-07" for monthly, ISO date for daily — resets progress per period. */
  period_key: string;
  progress_count: number;
  completed: boolean;
  completed_at: string | null;
}

// ── Leaderboards ───────────────────────────────────────────────────────────────
// Computed, not stored. A REAL cross-user leaderboard needs server-side
// aggregation this client-only phase cannot provide (localStorage is
// per-browser) — see lib/academy/gamificationLocalStore.ts for the honest
// current-user-only implementation and services/academy/gamification.ts for
// the future server-backed contract this type models.

export type AcademyLeaderboardScope = "global" | "friends" | "country" | "university" | "course" | "instructor";
export type AcademyLeaderboardPeriod = "weekly" | "monthly" | "all_time";

export interface AcademyLeaderboardEntry {
  user_id: string;
  display_name: string;
  xp: number;
  level: number;
  rank_position: number;
}

export interface AcademyLeaderboardPrivacyRow {
  user_id: string;
  visible_on_leaderboards: boolean;
  visible_display_name: string | null; // null = use account display name
}

// ── Collections ────────────────────────────────────────────────────────────────
// Aggregates badges + certificates + achievements + learning cards + event
// rewards into one collectible view. Learning Cards are a new lightweight
// collectible type (per the Phase 7 brief) — no dedicated table needed
// beyond the catalog below; ownership reuses AcademyUserAchievementRow-style
// unlock rows.

export type AcademyLearningCardRarity = "common" | "rare" | "epic" | "legendary";

export interface AcademyLearningCardDef {
  id: string;
  title: string;
  rarity: AcademyLearningCardRarity;
  subject: string;
  icon: string;
}

export interface AcademyUserLearningCardRow {
  user_id: string;
  card_id: string;
  unlocked_at: string;
}

// ── Social ─────────────────────────────────────────────────────────────────────
// Planned table: academy_celebrations — lightweight reactions/congratulations
// on a milestone (achievement unlock, certificate earned, level up).

export type AcademyCelebrationTargetType = "achievement" | "certificate" | "level_up" | "streak_milestone";
export type AcademyCelebrationReaction = "congrats" | "fire" | "clap" | "star";

export interface AcademyCelebrationRow {
  id: string;
  /** The user being celebrated. */
  target_user_id: string;
  target_type: AcademyCelebrationTargetType;
  target_ref_id: string; // achievement_id / certificate_id / etc.
  /** The user reacting. */
  from_user_id: string;
  reaction: AcademyCelebrationReaction;
  created_at: string;
}

// ── Seasonal Events ────────────────────────────────────────────────────────────
// Planned table: academy_seasonal_events — architecture prep only, no real
// event content ships with Phase 7.

export interface AcademySeasonalEventDef {
  id: string;
  name: string;
  theme: string;
  starts_at: string;
  ends_at: string;
  limited_achievement_ids: string[];
  limited_badge_tier: AcademyBadgeTier | null;
  is_active: boolean;
}

// ── Statistics ─────────────────────────────────────────────────────────────────
// Computed on-demand from existing Phase 3/6 local stores — not a stored row.

export interface AcademyLearningStatistics {
  learning_hours: number;
  lessons_completed: number;
  courses_completed: number;
  average_quiz_score_percent: number;
  quiz_accuracy_percent: number;
  reading_time_minutes: number;
  projects_completed: number;
  certificates_earned: number;
  current_streak_days: number;
}
