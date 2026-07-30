import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Lesson, LearningRecommendation } from "@/features/visionkids/types/academy.types";

/**
 * The "AI analyzes age/results/time/errors/speed/interests and suggests
 * lessons/exercises/review/next level" system — implemented as a real,
 * signal-driven heuristic over the student's own progress data, same
 * "real DB data, not an LLM call" precedent as Stories' recommendation
 * engine (see that file's header comment for why): the next lesson to
 * unlock, a completed lesson to review (low score), or a lesson whose
 * activities they got wrong, worth practicing again.
 */
export async function fetchLearningRecommendations(limit = 5): Promise<LearningRecommendation[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];

  const { data: enrollments } = await kidsDb.from("kids_course_enrollments").select("course_id").eq("user_id", userId);
  const courseIds = (enrollments ?? []).map((e: { course_id: string }) => e.course_id);
  if (courseIds.length === 0) return [];

  const { data: lessons } = await kidsDb
    .from("kids_lessons").select("*").in("course_id", courseIds).eq("status", "published").order("order_index")
    .returns<Lesson[]>();
  const allLessons = lessons ?? [];
  if (allLessons.length === 0) return [];

  const { data: progressRows } = await kidsDb
    .from("kids_lesson_progress").select("lesson_id, status, score").eq("user_id", userId).in("lesson_id", allLessons.map((l) => l.id));
  const progressMap = new Map((progressRows ?? []).map((p: { lesson_id: string; status: string; score: number | null }) => [p.lesson_id, p]));

  const recommendations: LearningRecommendation[] = [];

  // 1. Next not-started lesson, in course order — "next level".
  const nextLesson = allLessons.find((l) => !progressMap.has(l.id) || progressMap.get(l.id)?.status !== "completed");
  if (nextLesson && progressMap.get(nextLesson.id)?.status !== "in_progress") {
    recommendations.push({ kind: "next_lesson", lesson: nextLesson, reason: "Continue your learning path" });
  }

  // 2. Completed lessons with a low score — "review".
  const lowScoreLessons = allLessons.filter((l) => {
    const p = progressMap.get(l.id);
    return p?.status === "completed" && p.score !== null && p.score < 70;
  });
  for (const lesson of lowScoreLessons.slice(0, 2)) {
    recommendations.push({ kind: "review", lesson, reason: "Your score was low here — a quick review will help it stick" });
  }

  // 3. Lessons with wrong activity attempts — "practice".
  const { data: wrongAttempts } = await kidsDb
    .from("kids_activity_attempts")
    .select("activity_id, kids_lesson_activities!inner(lesson_id)")
    .eq("user_id", userId).eq("correct", false).limit(20);
  const wrongLessonIds = new Set(
    ((wrongAttempts ?? []) as unknown as { kids_lesson_activities: { lesson_id: string } }[]).map((a) => a.kids_lesson_activities.lesson_id)
  );
  for (const lessonId of wrongLessonIds) {
    const lesson = allLessons.find((l) => l.id === lessonId);
    if (lesson && !recommendations.some((r) => r.lesson.id === lesson.id)) {
      recommendations.push({ kind: "practice", lesson, reason: "Practice the exercises you found tricky" });
    }
    if (recommendations.length >= limit) break;
  }

  return recommendations.slice(0, limit);
}
