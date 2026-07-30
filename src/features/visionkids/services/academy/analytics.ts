import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  averageScore: number;
  lessonsCompleted: number;
}

export interface LearningAnalytics {
  totalLessonsCompleted: number;
  totalMinutes: number;
  averageScore: number | null;
  activeDaysLast30: number;
  completionRate: number;
  strongSubjects: SubjectPerformance[];
  weakSubjects: SubjectPerformance[];
}

interface ProgressRow {
  status: string;
  score: number | null;
  time_spent_seconds: number;
  last_accessed_at: string;
  lesson: { course: { subject: { id: string; name: string } | null } | null } | null;
}

/**
 * Real, computed-on-read analytics over kids_lesson_progress — no separate
 * "analytics" table duplicating that data (same reasoning throughout this
 * feature: kids_reading_progress/kids_game_sessions/etc. are each the one
 * source of truth their own summary pages read from).
 */
export async function fetchMyAnalytics(userId?: string): Promise<LearningAnalytics> {
  let targetId = userId;
  if (!targetId) {
    const { data } = await kidsDb.auth.getUser();
    targetId = data.user?.id;
  }
  if (!targetId) {
    return { totalLessonsCompleted: 0, totalMinutes: 0, averageScore: null, activeDaysLast30: 0, completionRate: 0, strongSubjects: [], weakSubjects: [] };
  }

  const { data, error } = await kidsDb
    .from("kids_lesson_progress")
    .select("status, score, time_spent_seconds, last_accessed_at, lesson:kids_lessons(course:kids_courses(subject:kids_subjects(id, name)))")
    .eq("user_id", targetId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as ProgressRow[];
  const completed = rows.filter((r) => r.status === "completed");
  const scored = completed.filter((r) => r.score !== null);
  const totalSeconds = rows.reduce((sum, r) => sum + (r.time_spent_seconds ?? 0), 0);

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const activeDays = new Set(
    rows.filter((r) => new Date(r.last_accessed_at) >= since30).map((r) => r.last_accessed_at.slice(0, 10))
  );

  const bySubject = new Map<string, { name: string; scores: number[]; completedCount: number }>();
  for (const row of completed) {
    const subject = row.lesson?.course?.subject;
    if (!subject) continue;
    const entry = bySubject.get(subject.id) ?? { name: subject.name, scores: [], completedCount: 0 };
    entry.completedCount += 1;
    if (row.score !== null) entry.scores.push(row.score);
    bySubject.set(subject.id, entry);
  }

  const subjectPerf: SubjectPerformance[] = [...bySubject.entries()]
    .filter(([, v]) => v.scores.length > 0)
    .map(([id, v]) => ({ subjectId: id, subjectName: v.name, averageScore: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length), lessonsCompleted: v.completedCount }));

  const sorted = [...subjectPerf].sort((a, b) => b.averageScore - a.averageScore);

  return {
    totalLessonsCompleted: completed.length,
    totalMinutes: Math.round(totalSeconds / 60),
    averageScore: scored.length > 0 ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : null,
    activeDaysLast30: activeDays.size,
    completionRate: rows.length > 0 ? Math.round((completed.length / rows.length) * 100) : 0,
    strongSubjects: sorted.slice(0, 3),
    weakSubjects: sorted.slice(-3).reverse().filter((s) => !sorted.slice(0, 3).includes(s)),
  };
}
