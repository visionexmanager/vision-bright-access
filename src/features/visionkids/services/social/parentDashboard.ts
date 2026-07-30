import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";

export interface ParentDashboardStats {
  usageMinutesToday: number;
  learningMinutes7d: number;
  playMinutes7d: number;
  storiesRead: number;
  lessonsCompleted: number;
  gamesPlayed: number;
  creativeProjects: number;
  achievementsEarned: number;
  challengesCompleted: number;
}

/** Real aggregation over existing per-phase engagement tables — no
 *  separate "parent stats" table, computed on read (same approach as
 *  fetchChildWeeklySummary in academy/parent.ts, just broadened across
 *  every VisionKids phase instead of just Academy lessons). */
export async function fetchParentDashboardStats(childUserId: string): Promise<ParentDashboardStats> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const [
    usageToday,
    gameSessions,
    readingRows,
    lessonRows,
    creativeCount,
    achievementCount,
    dailyDone,
    weeklyDone,
  ] = await Promise.all([
    kidsDb.rpc("get_kids_usage_today", { _child_user_id: childUserId }).single(),
    kidsDb.from("kids_game_sessions").select("duration_seconds, started_at").eq("user_id", childUserId).gte("started_at", sinceIso),
    kidsDb.from("kids_reading_progress").select("completed, minutes_read, last_read_at").eq("user_id", childUserId),
    kidsDb.from("kids_lesson_progress").select("status, time_spent_seconds, last_accessed_at").eq("user_id", childUserId).gte("last_accessed_at", sinceIso),
    kidsDb.from("kids_creative_projects").select("*", { count: "exact", head: true }).eq("user_id", childUserId),
    kidsDb.from("kids_user_achievements").select("*", { count: "exact", head: true }).eq("user_id", childUserId),
    kidsDb.from("kids_user_daily_challenge_progress").select("*", { count: "exact", head: true }).eq("user_id", childUserId).not("completed_at", "is", null),
    kidsDb.from("kids_user_weekly_challenge_progress").select("*", { count: "exact", head: true }).eq("user_id", childUserId).not("completed_at", "is", null),
  ]);

  const games = gameSessions.data ?? [];
  const reading = readingRows.data ?? [];
  const lessons = lessonRows.data ?? [];

  const playSeconds = games.reduce((sum: number, r: { duration_seconds: number }) => sum + (r.duration_seconds ?? 0), 0);
  const learningSeconds = lessons.reduce((sum: number, r: { time_spent_seconds: number }) => sum + (r.time_spent_seconds ?? 0), 0);

  return {
    usageMinutesToday: (usageToday.data as { minutes_used_today: number } | null)?.minutes_used_today ?? 0,
    learningMinutes7d: Math.round(learningSeconds / 60),
    playMinutes7d: Math.round(playSeconds / 60),
    storiesRead: reading.filter((r: { completed: boolean }) => r.completed).length,
    lessonsCompleted: lessons.filter((r: { status: string }) => r.status === "completed").length,
    gamesPlayed: games.length,
    creativeProjects: creativeCount.count ?? 0,
    achievementsEarned: achievementCount.count ?? 0,
    challengesCompleted: (dailyDone.count ?? 0) + (weeklyDone.count ?? 0),
  };
}

export interface ActivityTimelineEntry {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

/** kids_xp_events already logs a timestamped, reason-labeled row for
 *  nearly every meaningful action across every VisionKids phase (every
 *  award_kids_xp() call writes one) — this IS the activity timeline, no
 *  new log table needed, just reading it (RLS extended for linked parents
 *  in 20260813000000). */
export async function fetchActivityTimeline(childUserId: string, limit = 30): Promise<ActivityTimelineEntry[]> {
  const { data, error } = await kidsDb
    .from("kids_xp_events")
    .select("id, amount, reason, created_at")
    .eq("user_id", childUserId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ActivityTimelineEntry[]>();
  if (error) throw error;
  return data ?? [];
}

export interface DashboardRecommendation {
  key: string;
  titleKey: string;
  href: string;
}

/** Lightweight heuristics over the same stats, computed client-side —
 *  not a real ML recommender, just "steer a child toward something they
 *  haven't tried yet", which is what the brief's "التوصيات" needs at this
 *  scope. */
export function computeRecommendations(stats: ParentDashboardStats): DashboardRecommendation[] {
  const recs: DashboardRecommendation[] = [];
  if (stats.storiesRead === 0) recs.push({ key: "try_stories", titleKey: "kids.social.rec.tryStories", href: "/kids/stories" });
  if (stats.creativeProjects === 0) recs.push({ key: "try_studio", titleKey: "kids.social.rec.tryStudio", href: "/kids/studio" });
  if (stats.gamesPlayed === 0) recs.push({ key: "try_games", titleKey: "kids.social.rec.tryGames", href: "/kids/games" });
  if (stats.challengesCompleted === 0) recs.push({ key: "try_challenges", titleKey: "kids.social.rec.tryChallenges", href: "/kids/social/challenges" });
  if (recs.length === 0) recs.push({ key: "explore_more", titleKey: "kids.social.rec.exploreMore", href: "/kids/explorer" });
  return recs.slice(0, 3);
}
