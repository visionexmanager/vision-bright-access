import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { CourseEnrollment, LessonProgress } from "@/features/visionkids/types/academy.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function enrollInCourse(courseId: string): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_course_enrollments").insert({ user_id, course_id: courseId });
  if (error && error.code !== "23505") throw error;
}

export async function fetchMyEnrollment(courseId: string): Promise<CourseEnrollment | null> {
  const { data, error } = await kidsDb.from("kids_course_enrollments").select("*").eq("course_id", courseId).maybeSingle().returns<CourseEnrollment>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMyEnrolledCourses(): Promise<CourseEnrollment[]> {
  const { data, error } = await kidsDb.from("kids_course_enrollments").select("*, course:kids_courses(*)").order("enrolled_at", { ascending: false }).returns<CourseEnrollment[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLessonProgress(lessonId: string): Promise<LessonProgress | null> {
  const { data, error } = await kidsDb.from("kids_lesson_progress").select("*").eq("lesson_id", lessonId).maybeSingle().returns<LessonProgress>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCourseProgress(courseId: string): Promise<LessonProgress[]> {
  const { data: lessons } = await kidsDb.from("kids_lessons").select("id").eq("course_id", courseId).eq("status", "published");
  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id);
  if (lessonIds.length === 0) return [];
  const { data, error } = await kidsDb.from("kids_lesson_progress").select("*").in("lesson_id", lessonIds).returns<LessonProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export interface SaveLessonProgressInput {
  lessonId: string;
  status: "in_progress" | "completed";
  score?: number;
  timeSpentDeltaSeconds?: number;
}

export async function saveLessonProgress(input: SaveLessonProgressInput): Promise<void> {
  const user_id = await requireUserId();
  const existing = await fetchLessonProgress(input.lessonId);
  const time_spent_seconds = (existing?.time_spent_seconds ?? 0) + (input.timeSpentDeltaSeconds ?? 0);

  const { error } = await kidsDb.from("kids_lesson_progress").upsert(
    {
      user_id,
      lesson_id: input.lessonId,
      status: input.status,
      score: input.score ?? existing?.score ?? null,
      time_spent_seconds,
      completed_at: input.status === "completed" ? new Date().toISOString() : existing?.completed_at ?? null,
      last_accessed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (error) throw error;
}

export async function fetchRecentLessonProgress(limit = 10): Promise<LessonProgress[]> {
  const { data, error } = await kidsDb
    .from("kids_lesson_progress").select("*, lesson:kids_lessons(*)").order("last_accessed_at", { ascending: false }).limit(limit)
    .returns<LessonProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export async function submitActivityAttempt(activityId: string, answer: Record<string, unknown>, correct: boolean): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_activity_attempts").insert({ user_id, activity_id: activityId, answer, correct });
  if (error) throw error;
}

export async function fetchCompletedLessonsCount(): Promise<number> {
  const { count, error } = await kidsDb
    .from("kids_lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}
