/**
 * Academy — Gamification Local Store (Phase 7, temporary)
 *
 * Same localStorage contract as every other *LocalStore.ts file. The
 * achievement/badge/mission CATALOGS below are fixed game-design content —
 * same precedent as XP_LEVELS in lib/academy/xp.ts, not "hardcoded data" in
 * the sense Phase 5 was told to avoid (that was about fabricating catalog
 * content; this is game rules). Unlock STATE is computed for real from the
 * existing Phase 3/4/5/6 local stores — nothing here is faked.
 *
 * VX: this file NEVER writes to user_points or academy_profiles.xp_total.
 * Whenever an achievement/mission should grant VX, the caller (page-level
 * code) calls the EXISTING awardAcademyXP() from
 * services/academy/academyService.ts — see AcademyMissionDef.xp_reason.
 *
 * Leaderboards: localStorage is per-browser, so a real cross-user ranking is
 * impossible here without a backend. getLeaderboard() below returns only the
 * current user's own entry — honest, not a fabricated multi-user list.
 */

import type {
  AcademyAchievementDef, AcademyUserAchievementRow, AcademyStreakRow,
  AcademyMissionDef, AcademyUserMissionProgressRow, AcademyLeaderboardEntry,
  AcademyLeaderboardPrivacyRow, AcademyLearningStatistics, AcademyCelebrationRow,
  AcademyCelebrationTargetType, AcademyCelebrationReaction, AcademyLearningCardDef,
  AcademyUserLearningCardRow,
} from "@/lib/types/academy-gamification";
import { STREAK_MILESTONES } from "@/lib/types/academy-gamification";
import { searchCoursesAny, getLessonsForCourseAny, getMyInstructorProfile, getCoursesByInstructorAny } from "./instructorLocalStore";
import { getCourseProgress } from "./lessonLocalStore";
import { getAllQuizAttemptsForUser, getAllProjectSubmissionsForUser } from "./assessmentLocalStore";
import { getMyCertificates } from "./certificateLocalStore";
import { getAllReadingProgressForUser } from "./libraryLocalStore";
import { getAcademyLevelInfo } from "./leveling";
import { readJSON, writeJSON } from "./localStorageUtils";

const ACHIEVEMENTS_KEY = "academy:user-achievements";
const STREAK_KEY = "academy:streak";
const MISSION_PROGRESS_KEY = "academy:mission-progress";
const LEADERBOARD_PRIVACY_KEY = "academy:leaderboard-privacy";
const CELEBRATIONS_KEY = "academy:celebrations";
const LEARNING_CARDS_KEY = "academy:learning-cards";

// ── Achievement Catalog (fixed game-design content) ───────────────────────────

export const ACHIEVEMENT_CATALOG: AcademyAchievementDef[] = [
  // Learning
  { id: "first-lesson", category: "learning", title: "الخطوة الأولى", description: "أكمل أول درس لك", tier: "bronze", icon: "Footprints", hidden: false, animatedAssetPrepared: false },
  { id: "lessons-10", category: "learning", title: "متعلّم مثابر", description: "أكمل 10 دروس", tier: "silver", icon: "BookOpenCheck", hidden: false, animatedAssetPrepared: false },
  { id: "lessons-50", category: "learning", title: "شغف التعلّم", description: "أكمل 50 درساً", tier: "gold", icon: "Flame", hidden: false, animatedAssetPrepared: true },
  // Courses
  { id: "first-course", category: "courses", title: "دورة كاملة!", description: "أكمل أول دورة لك بالكامل", tier: "bronze", icon: "GraduationCap", hidden: false, animatedAssetPrepared: false },
  { id: "courses-3", category: "courses", title: "جامع الدورات", description: "أكمل 3 دورات", tier: "silver", icon: "Layers", hidden: false, animatedAssetPrepared: false },
  { id: "courses-10", category: "courses", title: "خبير أكاديمي", description: "أكمل 10 دورات", tier: "platinum", icon: "Crown", hidden: false, animatedAssetPrepared: true },
  // Projects
  { id: "first-project", category: "projects", title: "أول مشروع", description: "سلّم أول مشروع لك", tier: "bronze", icon: "Rocket", hidden: false, animatedAssetPrepared: false },
  { id: "projects-5", category: "projects", title: "صانع المشاريع", description: "سلّم 5 مشاريع", tier: "gold", icon: "Hammer", hidden: false, animatedAssetPrepared: false },
  // Certificates
  { id: "first-certificate", category: "certificates", title: "شهادتي الأولى", description: "احصل على شهادتك الأولى", tier: "silver", icon: "Award", hidden: false, animatedAssetPrepared: true },
  { id: "certificates-3", category: "certificates", title: "خزانة الشهادات", description: "احصل على 3 شهادات", tier: "gold", icon: "Trophy", hidden: false, animatedAssetPrepared: true },
  // Community (unlocked via academy_community_contribution XP events — prepared, not yet auto-triggered elsewhere)
  { id: "community-helper", category: "community", title: "روح التعاون", description: "قدّم أول مساهمة مجتمعية", tier: "bronze", icon: "HeartHandshake", hidden: true, animatedAssetPrepared: false },
  { id: "community-star", category: "community", title: "نجم المجتمع", description: "قدّم 5 مساهمات مجتمعية", tier: "gold", icon: "Sparkles", hidden: true, animatedAssetPrepared: false },
  // Reading
  { id: "first-read", category: "reading", title: "قارئ نشط", description: "افتح أول مورد من المكتبة", tier: "bronze", icon: "BookOpen", hidden: false, animatedAssetPrepared: false },
  { id: "avid-reader-10", category: "reading", title: "قارئ نهم", description: "افتح 10 موارد من المكتبة", tier: "silver", icon: "Library", hidden: false, animatedAssetPrepared: false },
  // Consistency
  { id: "streak-3", category: "consistency", title: "بداية الانتظام", description: "حافظ على تتابع تعلّم 3 أيام", tier: "bronze", icon: "CalendarCheck", hidden: false, animatedAssetPrepared: false },
  { id: "streak-30", category: "consistency", title: "شهر كامل", description: "حافظ على تتابع تعلّم 30 يوماً", tier: "gold", icon: "CalendarClock", hidden: false, animatedAssetPrepared: true },
  { id: "streak-100", category: "consistency", title: "لا يُوقَف", description: "حافظ على تتابع تعلّم 100 يوم", tier: "diamond", icon: "Gem", hidden: false, animatedAssetPrepared: true },
  // Milestones
  { id: "level-10", category: "milestones", title: "المستوى 10", description: "وصل إلى المستوى 10", tier: "silver", icon: "Star", hidden: false, animatedAssetPrepared: false },
  { id: "level-25", category: "milestones", title: "المستوى 25", description: "وصل إلى المستوى 25", tier: "gold", icon: "Stars", hidden: false, animatedAssetPrepared: true },
  { id: "level-50", category: "milestones", title: "المستوى 50", description: "وصل إلى المستوى 50", tier: "platinum", icon: "Medal", hidden: false, animatedAssetPrepared: true },
  // Instructor
  { id: "became-instructor", category: "instructor", title: "مدرّس معتمد", description: "أصبحت مدرّساً في الأكاديمية", tier: "gold", icon: "GraduationCap", hidden: false, animatedAssetPrepared: false },
  { id: "first-course-published", category: "instructor", title: "أول دورة تُنشر", description: "انشر أول دورة كمدرّس", tier: "silver", icon: "Send", hidden: false, animatedAssetPrepared: false },
  // Special events (prepared — stays locked until a real seasonal event exists)
  { id: "season-pioneer", category: "special_events", title: "رائد الموسم", description: "شارك في أول فعالية موسمية بالأكاديمية", tier: "legendary", icon: "PartyPopper", hidden: true, animatedAssetPrepared: true },
  // Hidden (cross-cutting)
  { id: "perfectionist", category: "milestones", title: "الكمال بعينه", description: "احصل على علامة كاملة في 5 اختبارات", tier: "diamond", icon: "Sparkle", hidden: true, animatedAssetPrepared: true },
];

export function getAchievementCatalog(): AcademyAchievementDef[] {
  return ACHIEVEMENT_CATALOG;
}

function getUnlockedAchievements(userId: string): AcademyUserAchievementRow[] {
  const all = readJSON<Record<string, AcademyUserAchievementRow[]>>(ACHIEVEMENTS_KEY, {});
  return all[userId] ?? [];
}

function unlockAchievement(userId: string, achievementId: string): boolean {
  const all = readJSON<Record<string, AcademyUserAchievementRow[]>>(ACHIEVEMENTS_KEY, {});
  const current = all[userId] ?? [];
  if (current.some((a) => a.achievement_id === achievementId)) return false;
  all[userId] = [...current, { user_id: userId, achievement_id: achievementId, unlocked_at: new Date().toISOString() }];
  writeJSON(ACHIEVEMENTS_KEY, all);
  return true;
}

export function getUserAchievementIds(userId: string): Set<string> {
  return new Set(getUnlockedAchievements(userId).map((a) => a.achievement_id));
}

// ── Statistics (computed for real from existing Phase 3–6 stores) ────────────

export function computeLearningStatistics(userId: string): AcademyLearningStatistics {
  const allCourses = searchCoursesAny({});
  let lessonsCompleted = 0;
  let coursesCompleted = 0;
  let learningSeconds = 0;

  for (const course of allCourses) {
    const lessons = getLessonsForCourseAny(course.id);
    if (lessons.length === 0) continue;
    const progress = getCourseProgress(course.id).filter((p) => p.user_id === userId);
    const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
    lessonsCompleted += completedIds.size;
    if (completedIds.size === lessons.length) coursesCompleted++;
    lessons.forEach((l) => { if (completedIds.has(l.id)) learningSeconds += l.duration_seconds; });
  }

  const attempts = getAllQuizAttemptsForUser(userId);
  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score_percent, 0) / attempts.length) : 0;
  const autoGraded = attempts.flatMap((a) => Object.values(a.question_results)).filter((r) => r.auto_graded);
  const accuracy = autoGraded.length > 0 ? Math.round((autoGraded.filter((r) => r.correct).length / autoGraded.length) * 100) : 0;

  const readingProgress = getAllReadingProgressForUser(userId);
  const readingMinutes = readingProgress.length * 5; // best-effort: no per-session timer, count sessions opened

  return {
    learning_hours: Math.round((learningSeconds / 3600) * 10) / 10,
    lessons_completed: lessonsCompleted,
    courses_completed: coursesCompleted,
    average_quiz_score_percent: avgScore,
    quiz_accuracy_percent: accuracy,
    reading_time_minutes: readingMinutes,
    projects_completed: getAllProjectSubmissionsForUser(userId).length,
    certificates_earned: getMyCertificates(userId).length,
    current_streak_days: getStreak(userId).current_streak_days,
  };
}

/** Re-evaluates every achievement's unlock criteria against real current stats. Returns newly-unlocked ids. `xpTotal` comes from the caller's already-loaded academy_profiles.xp_total (avoids re-fetching it here). */
export function evaluateAchievements(userId: string, xpTotal: number): AcademyAchievementDef[] {
  const stats = computeLearningStatistics(userId);
  const attempts = getAllQuizAttemptsForUser(userId);
  const perfectQuizCount = attempts.filter((a) => a.score_percent === 100).length;
  const isInstructor = !!getMyInstructorProfile(userId);
  const publishedCourses = isInstructor ? getCoursesByInstructorAny(getMyInstructorProfile(userId)!.id).filter((c) => c.status === "published").length : 0;
  const level = getAcademyLevelInfo(xpTotal).level;

  const checks: Record<string, boolean> = {
    "first-lesson": stats.lessons_completed >= 1,
    "lessons-10": stats.lessons_completed >= 10,
    "lessons-50": stats.lessons_completed >= 50,
    "first-course": stats.courses_completed >= 1,
    "courses-3": stats.courses_completed >= 3,
    "courses-10": stats.courses_completed >= 10,
    "first-project": stats.projects_completed >= 1,
    "projects-5": stats.projects_completed >= 5,
    "first-certificate": stats.certificates_earned >= 1,
    "certificates-3": stats.certificates_earned >= 3,
    "first-read": getAllReadingProgressForUser(userId).length >= 1,
    "avid-reader-10": getAllReadingProgressForUser(userId).length >= 10,
    "streak-3": stats.current_streak_days >= 3,
    "streak-30": stats.current_streak_days >= 30,
    "streak-100": stats.current_streak_days >= 100,
    "level-10": level >= 10,
    "level-25": level >= 25,
    "level-50": level >= 50,
    "became-instructor": isInstructor,
    "first-course-published": publishedCourses >= 1,
    "perfectionist": perfectQuizCount >= 5,
  };

  const newlyUnlocked: AcademyAchievementDef[] = [];
  for (const def of ACHIEVEMENT_CATALOG) {
    if (checks[def.id] && unlockAchievement(userId, def.id)) {
      newlyUnlocked.push(def);
    }
  }
  return newlyUnlocked;
}

// ── Streaks ────────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function getStreak(userId: string): AcademyStreakRow {
  const all = readJSON<Record<string, AcademyStreakRow>>(STREAK_KEY, {});
  return all[userId] ?? { user_id: userId, current_streak_days: 0, longest_streak_days: 0, last_active_date: "", freeze_tokens_available: 1, freeze_tokens_used_total: 0 };
}

/** Call once per day the user is active in Academy. Returns the updated streak + any milestone just reached. */
export function recordDailyActivityLocal(userId: string): { streak: AcademyStreakRow; milestoneReached: number | null } {
  const all = readJSON<Record<string, AcademyStreakRow>>(STREAK_KEY, {});
  const existing = getStreak(userId);
  const today = todayKey();

  if (existing.last_active_date === today) {
    return { streak: existing, milestoneReached: null };
  }

  const gap = existing.last_active_date ? daysBetween(existing.last_active_date, today) : null;
  let nextStreak: number;
  if (gap === 1) nextStreak = existing.current_streak_days + 1;
  else if (gap === null) nextStreak = 1;
  else if (gap === 2 && existing.freeze_tokens_available > 0) {
    // Freeze consumed automatically to bridge exactly one missed day.
    nextStreak = existing.current_streak_days + 1;
    existing.freeze_tokens_available -= 1;
    existing.freeze_tokens_used_total += 1;
  } else {
    nextStreak = 1;
  }

  const updated: AcademyStreakRow = {
    ...existing,
    current_streak_days: nextStreak,
    longest_streak_days: Math.max(existing.longest_streak_days, nextStreak),
    last_active_date: today,
  };
  all[userId] = updated;
  writeJSON(STREAK_KEY, all);

  const milestone = [...STREAK_MILESTONES].reverse().find((m) => m === nextStreak) ?? null;
  return { streak: updated, milestoneReached: milestone };
}

// ── Missions (fixed catalog, real progress from existing stats) ──────────────

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const MISSION_CATALOG: AcademyMissionDef[] = [
  { id: "daily-watch-lesson", scope: "daily", title: "شاهد درساً اليوم", description: "أكمل درساً واحداً على الأقل اليوم", action_type: "watch_lessons", target_count: 1, xp_reason: "academy_daily_login" },
  { id: "daily-quiz", scope: "daily", title: "حل اختباراً", description: "أكمل اختباراً واحداً اليوم", action_type: "complete_quizzes", target_count: 1, xp_reason: "academy_quiz_passed" },
  { id: "weekly-lessons-5", scope: "weekly", title: "5 دروس هذا الأسبوع", description: "أكمل 5 دروس خلال الأسبوع", action_type: "watch_lessons", target_count: 5, xp_reason: "academy_weekly_goal" },
  { id: "weekly-quiz-3", scope: "weekly", title: "3 اختبارات هذا الأسبوع", description: "اجتز 3 اختبارات خلال الأسبوع", action_type: "complete_quizzes", target_count: 3, xp_reason: "academy_weekly_goal" },
  { id: "monthly-course", scope: "monthly", title: "أكمل دورة هذا الشهر", description: "أكمل دورة كاملة خلال الشهر", action_type: "watch_lessons", target_count: 1, xp_reason: "academy_monthly_goal" },
  { id: "monthly-reading-5", scope: "monthly", title: "5 موارد قراءة هذا الشهر", description: "افتح 5 موارد من المكتبة خلال الشهر", action_type: "read_resources", target_count: 5, xp_reason: "academy_monthly_goal" },
];

function periodKeyFor(scope: AcademyMissionDef["scope"]): string {
  const now = new Date();
  if (scope === "daily") return todayKey();
  if (scope === "weekly") return isoWeekKey(now);
  if (scope === "monthly") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return "seasonal";
}

export interface MissionWithProgress {
  mission: AcademyMissionDef;
  progress: number;
  completed: boolean;
}

/** Progress is derived live from real stats each time — no manual "increment" calls needed for watch/quiz/read missions. */
export function getMissionsWithProgress(userId: string): MissionWithProgress[] {
  const stats = computeLearningStatistics(userId);
  const progressMap = readJSON<Record<string, AcademyUserMissionProgressRow>>(MISSION_PROGRESS_KEY, {});

  return MISSION_CATALOG.map((mission) => {
    const key = `${userId}:${mission.id}:${periodKeyFor(mission.scope)}`;
    const stored = progressMap[key];

    let liveProgress = stored?.progress_count ?? 0;
    if (mission.action_type === "watch_lessons") liveProgress = Math.min(mission.target_count, stats.lessons_completed);
    else if (mission.action_type === "complete_quizzes") liveProgress = Math.min(mission.target_count, getAllQuizAttemptsForUser(userId).filter((a) => a.passed).length);
    else if (mission.action_type === "read_resources") liveProgress = Math.min(mission.target_count, getAllReadingProgressForUser(userId).length);

    const completed = liveProgress >= mission.target_count;
    return { mission, progress: liveProgress, completed };
  });
}

/** Marks a mission complete for its current period so the caller can award XP exactly once via awardAcademyXP(). */
export function claimMissionIfNewlyCompleted(userId: string, missionId: string): boolean {
  const mission = MISSION_CATALOG.find((m) => m.id === missionId);
  if (!mission) return false;
  const key = `${userId}:${mission.id}:${periodKeyFor(mission.scope)}`;
  const progressMap = readJSON<Record<string, AcademyUserMissionProgressRow>>(MISSION_PROGRESS_KEY, {});
  if (progressMap[key]?.completed) return false;

  const { completed } = getMissionsWithProgress(userId).find((m) => m.mission.id === missionId) ?? { completed: false };
  if (!completed) return false;

  progressMap[key] = { user_id: userId, mission_id: missionId, period_key: periodKeyFor(mission.scope), progress_count: mission.target_count, completed: true, completed_at: new Date().toISOString() };
  writeJSON(MISSION_PROGRESS_KEY, progressMap);
  return true;
}

export interface GamificationTickResult {
  newAchievements: AcademyAchievementDef[];
  newLearningCards: AcademyLearningCardDef[];
  streakMilestone: number | null;
  /** AcademyXPReason values the caller should award via the EXISTING awardAcademyXP() bridge — this function never awards XP itself. */
  missionXPReasonsToAward: string[];
}

/**
 * Single entry point the UI calls after any completion event (lesson done,
 * quiz passed, project submitted, etc.) — re-evaluates achievements, learning
 * cards, streak, and missions all at once against fresh stats. Returns what's
 * new so the caller can show a celebration AND award any earned mission XP
 * through the existing VX bridge. This function itself never touches VX.
 */
export function runGamificationTick(userId: string, xpTotal: number): GamificationTickResult {
  const newAchievements = evaluateAchievements(userId, xpTotal);
  const newLearningCards = evaluateLearningCards(userId);
  const { milestoneReached } = recordDailyActivityLocal(userId);

  const missionXPReasonsToAward: string[] = [];
  for (const { mission, completed } of getMissionsWithProgress(userId)) {
    if (completed && claimMissionIfNewlyCompleted(userId, mission.id)) {
      missionXPReasonsToAward.push(mission.xp_reason);
    }
  }

  return { newAchievements, newLearningCards, streakMilestone: milestoneReached, missionXPReasonsToAward };
}

// ── Leaderboard (honest, current-user-only) ───────────────────────────────────

export function getLeaderboardPrivacy(userId: string): AcademyLeaderboardPrivacyRow {
  const all = readJSON<Record<string, AcademyLeaderboardPrivacyRow>>(LEADERBOARD_PRIVACY_KEY, {});
  return all[userId] ?? { user_id: userId, visible_on_leaderboards: true, visible_display_name: null };
}

export function setLeaderboardPrivacy(userId: string, visible: boolean, displayName: string | null): void {
  const all = readJSON<Record<string, AcademyLeaderboardPrivacyRow>>(LEADERBOARD_PRIVACY_KEY, {});
  all[userId] = { user_id: userId, visible_on_leaderboards: visible, visible_display_name: displayName };
  writeJSON(LEADERBOARD_PRIVACY_KEY, all);
}

/** Honest: this browser can only ever know about the current user, never other students — see file header. */
export function getMyLeaderboardEntry(userId: string, displayName: string, xpTotal: number, level: number): AcademyLeaderboardEntry {
  return { user_id: userId, display_name: displayName, xp: xpTotal, level, rank_position: 1 };
}

// ── Collections (Learning Cards) ──────────────────────────────────────────────

export const LEARNING_CARD_CATALOG: AcademyLearningCardDef[] = [
  { id: "card-python", title: "بطاقة بايثون", rarity: "common", subject: "برمجة", icon: "Code" },
  { id: "card-flutter", title: "بطاقة Flutter", rarity: "rare", subject: "تطوير تطبيقات", icon: "Smartphone" },
  { id: "card-data-science", title: "بطاقة علم البيانات", rarity: "epic", subject: "علم البيانات", icon: "BarChart3" },
  { id: "card-cybersecurity", title: "بطاقة الأمن السيبراني", rarity: "legendary", subject: "أمن سيبراني", icon: "ShieldCheck" },
];

export function getUnlockedLearningCards(userId: string): Set<string> {
  const all = readJSON<Record<string, AcademyUserLearningCardRow[]>>(LEARNING_CARDS_KEY, {});
  return new Set((all[userId] ?? []).map((c) => c.card_id));
}

/** A card unlocks the first time a student completes any course tagged with its subject. */
export function evaluateLearningCards(userId: string): AcademyLearningCardDef[] {
  const allCourses = searchCoursesAny({});
  const completedSubjects = new Set<string>();
  for (const course of allCourses) {
    const lessons = getLessonsForCourseAny(course.id);
    if (lessons.length === 0) continue;
    const progress = getCourseProgress(course.id).filter((p) => p.user_id === userId && p.completed);
    if (progress.length === lessons.length) completedSubjects.add(course.subject);
  }

  const all = readJSON<Record<string, AcademyUserLearningCardRow[]>>(LEARNING_CARDS_KEY, {});
  const current = all[userId] ?? [];
  const currentIds = new Set(current.map((c) => c.card_id));
  const newlyUnlocked: AcademyLearningCardDef[] = [];

  for (const card of LEARNING_CARD_CATALOG) {
    if (!currentIds.has(card.id) && completedSubjects.has(card.subject)) {
      current.push({ user_id: userId, card_id: card.id, unlocked_at: new Date().toISOString() });
      newlyUnlocked.push(card);
    }
  }
  if (newlyUnlocked.length > 0) {
    all[userId] = current;
    writeJSON(LEARNING_CARDS_KEY, all);
  }
  return newlyUnlocked;
}

// ── Social (celebrations/reactions) ───────────────────────────────────────────

export function getCelebrations(targetType: AcademyCelebrationTargetType, targetRefId: string): AcademyCelebrationRow[] {
  const all = readJSON<AcademyCelebrationRow[]>(CELEBRATIONS_KEY, []);
  return all.filter((c) => c.target_type === targetType && c.target_ref_id === targetRefId);
}

export function addCelebration(
  targetUserId: string,
  targetType: AcademyCelebrationTargetType,
  targetRefId: string,
  fromUserId: string,
  reaction: AcademyCelebrationReaction
): AcademyCelebrationRow {
  const all = readJSON<AcademyCelebrationRow[]>(CELEBRATIONS_KEY, []);
  const celebration: AcademyCelebrationRow = {
    id: crypto.randomUUID(), target_user_id: targetUserId, target_type: targetType, target_ref_id: targetRefId,
    from_user_id: fromUserId, reaction, created_at: new Date().toISOString(),
  };
  all.push(celebration);
  writeJSON(CELEBRATIONS_KEY, all);
  return celebration;
}
