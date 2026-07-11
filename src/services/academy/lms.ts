// ─── Academy — LMS Service (Phase 1 backend) ──────────────────────────────────
// Real Supabase-backed implementations for the course/lesson backbone.
// Tables: academy_courses, academy_course_modules, academy_lessons,
//         academy_enrollments, academy_lesson_progress, academy_lesson_notes,
//         academy_lesson_bookmarks, academy_course_reviews,
//         academy_learning_tracks, academy_learning_track_progress.
// RLS enforces ownership/visibility server-side — these functions don't
// re-check permissions client-side beyond what's needed for a good UX.

import { supabase } from "@/integrations/supabase/client";
import type {
  AcademyLessonRow,
  AcademyLessonProgressRow,
  AcademyLessonNoteRow,
  AcademyLessonBookmarkRow,
  AcademyCourseReviewRow,
  AcademyLearningTrackRow,
  AcademyLearningTrackProgressRow,
} from "@/lib/types/academy-lms";
import type {
  AcademyCourseRow,
  AcademyCourseModuleRow,
  AcademyEnrollmentRow,
  AcademyInstructorRow,
  AcademyCourseDifficulty,
  AcademyCourseSource,
} from "@/lib/types/academy-modules";

// ── Courses (Discovery) ──────────────────────────────────────────────────────

export interface CourseFilters {
  query?: string;
  category?: string;
  difficulty?: AcademyCourseDifficulty;
  source?: AcademyCourseSource;
  sort?: "featured" | "popular" | "new";
}

export async function fetchCourseCatalog(filters: CourseFilters = {}): Promise<AcademyCourseRow[]> {
  let q = (supabase.from("academy_courses") as any).select("*").eq("status", "published");

  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%,]/g, "");
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.difficulty) q = q.eq("difficulty", filters.difficulty);
  if (filters.source) q = q.eq("source", filters.source);

  if (filters.sort === "popular") {
    q = q.order("students_count", { ascending: false });
  } else if (filters.sort === "new") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order("rating_avg", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseRow[];
}

export async function fetchCourseById(courseId: string): Promise<AcademyCourseRow | null> {
  const { data, error } = await (supabase.from("academy_courses") as any)
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyCourseRow | null;
}

export async function fetchSimilarCourses(courseId: string, limit = 4): Promise<AcademyCourseRow[]> {
  const course = await fetchCourseById(courseId);
  if (!course) return [];
  const { data, error } = await (supabase.from("academy_courses") as any)
    .select("*")
    .eq("status", "published")
    .neq("id", courseId)
    .or(`category.eq.${course.category},subject.eq.${course.subject}`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseRow[];
}

export async function fetchAllCategories(): Promise<string[]> {
  const { data, error } = await (supabase.from("academy_courses") as any)
    .select("category")
    .eq("status", "published");
  if (error) throw new Error(error.message);
  const categories = ((data ?? []) as { category: string }[]).map((c) => c.category).filter(Boolean);
  return Array.from(new Set(categories));
}

// ── Modules & Lessons ─────────────────────────────────────────────────────────

export async function fetchCourseModules(courseId: string): Promise<AcademyCourseModuleRow[]> {
  const { data, error } = await (supabase.from("academy_course_modules") as any)
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseModuleRow[];
}

export async function fetchModuleLessons(moduleId: string): Promise<AcademyLessonRow[]> {
  const { data, error } = await (supabase.from("academy_lessons") as any)
    .select("*")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonRow[];
}

/** All lessons across every module of a course, ordered — RLS naturally limits
 *  rows to preview/enrolled/owner content, same as browsing module-by-module. */
export async function fetchCourseLessons(courseId: string): Promise<AcademyLessonRow[]> {
  const { data, error } = await (supabase.from("academy_lessons") as any)
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonRow[];
}

export async function fetchLessonById(lessonId: string): Promise<AcademyLessonRow | null> {
  const { data, error } = await (supabase.from("academy_lessons") as any)
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyLessonRow | null;
}

// ── Enrollment & Progress ─────────────────────────────────────────────────────

export async function fetchEnrollment(userId: string, courseId: string): Promise<AcademyEnrollmentRow | null> {
  const { data, error } = await (supabase.from("academy_enrollments") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyEnrollmentRow | null;
}

export async function fetchMyEnrollments(userId: string): Promise<AcademyEnrollmentRow[]> {
  const { data, error } = await (supabase.from("academy_enrollments") as any)
    .select("*")
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyEnrollmentRow[];
}

export async function enrollInCourse(userId: string, courseId: string): Promise<AcademyEnrollmentRow | null> {
  const { data, error } = await (supabase.from("academy_enrollments") as any)
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as AcademyEnrollmentRow;
  // ignoreDuplicates skips returning the existing row — fetch it explicitly.
  return fetchEnrollment(userId, courseId);
}

/**
 * Marks a lesson's playback progress and keeps the parent enrollment
 * (current_lesson_id, last_position_seconds, progress_percent, completed_at)
 * in sync — mirrors what lessonLocalStore.setLessonProgress used to do
 * client-side, now persisted centrally.
 */
export async function markLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  update: Partial<Pick<AcademyLessonProgressRow, "completed" | "last_position_seconds">>
): Promise<AcademyLessonProgressRow> {
  const { data: progressRow, error: progressErr } = await (supabase.from("academy_lesson_progress") as any)
    .upsert(
      { user_id: userId, course_id: courseId, lesson_id: lessonId, ...update, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    )
    .select()
    .single();
  if (progressErr) throw new Error(progressErr.message);

  const [{ count: totalLessons }, { count: completedLessons }] = await Promise.all([
    (supabase.from("academy_lessons") as any).select("id", { count: "exact", head: true }).eq("course_id", courseId),
    (supabase.from("academy_lesson_progress") as any)
      .select("lesson_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("completed", true),
  ]);

  const progressPercent = totalLessons ? Math.round(((completedLessons ?? 0) / totalLessons) * 100) : 0;
  const isCourseComplete = totalLessons != null && totalLessons > 0 && completedLessons === totalLessons;

  await (supabase.from("academy_enrollments") as any)
    .update({
      current_lesson_id: lessonId,
      last_position_seconds: update.last_position_seconds ?? 0,
      progress_percent: progressPercent,
      ...(isCourseComplete ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  return progressRow as AcademyLessonProgressRow;
}

export async function fetchCourseProgress(userId: string, courseId: string): Promise<AcademyLessonProgressRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_progress") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonProgressRow[];
}

export async function fetchAllProgressForUser(userId: string): Promise<AcademyLessonProgressRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_progress") as any).select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonProgressRow[];
}

// ── Notes & Bookmarks ─────────────────────────────────────────────────────────

export async function fetchLessonNotes(userId: string, lessonId: string): Promise<AcademyLessonNoteRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_notes") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonNoteRow[];
}

export async function saveLessonNote(
  note: Omit<AcademyLessonNoteRow, "id" | "created_at">
): Promise<AcademyLessonNoteRow> {
  const { data, error } = await (supabase.from("academy_lesson_notes") as any).insert(note).select().single();
  if (error) throw new Error(error.message);
  return data as AcademyLessonNoteRow;
}

export async function removeLessonNote(noteId: string): Promise<void> {
  const { error } = await (supabase.from("academy_lesson_notes") as any).delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function fetchAllNotesForUser(userId: string): Promise<AcademyLessonNoteRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_notes") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonNoteRow[];
}

export async function fetchLessonBookmarks(userId: string, lessonId: string): Promise<AcademyLessonBookmarkRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_bookmarks") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonBookmarkRow[];
}

export async function addLessonBookmark(
  userId: string,
  lessonId: string,
  timestampSeconds: number | null,
  label: string | null = null
): Promise<AcademyLessonBookmarkRow> {
  const { data, error } = await (supabase.from("academy_lesson_bookmarks") as any)
    .insert({ user_id: userId, lesson_id: lessonId, timestamp_seconds: timestampSeconds, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AcademyLessonBookmarkRow;
}

export async function removeLessonBookmark(bookmarkId: string): Promise<void> {
  const { error } = await (supabase.from("academy_lesson_bookmarks") as any).delete().eq("id", bookmarkId);
  if (error) throw new Error(error.message);
}

export async function fetchAllBookmarksForUser(userId: string): Promise<AcademyLessonBookmarkRow[]> {
  const { data, error } = await (supabase.from("academy_lesson_bookmarks") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLessonBookmarkRow[];
}

// ── Reviews & Ratings ─────────────────────────────────────────────────────────

export async function fetchCourseReviews(courseId: string): Promise<AcademyCourseReviewRow[]> {
  const { data, error } = await (supabase.from("academy_course_reviews") as any)
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseReviewRow[];
}

export async function submitCourseReview(
  review: Omit<AcademyCourseReviewRow, "id" | "created_at">
): Promise<AcademyCourseReviewRow> {
  const { data, error } = await (supabase.from("academy_course_reviews") as any)
    .upsert(review, { onConflict: "user_id,course_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AcademyCourseReviewRow;
}

// ── Learning Tracks ────────────────────────────────────────────────────────────

export async function fetchLearningTracks(): Promise<AcademyLearningTrackRow[]> {
  const { data, error } = await (supabase.from("academy_learning_tracks") as any).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyLearningTrackRow[];
}

export async function fetchLearningTrackById(trackId: string): Promise<AcademyLearningTrackRow | null> {
  const { data, error } = await (supabase.from("academy_learning_tracks") as any)
    .select("*")
    .eq("id", trackId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyLearningTrackRow | null;
}

export async function fetchLearningTrackProgress(
  userId: string,
  trackId: string
): Promise<AcademyLearningTrackProgressRow | null> {
  const { data, error } = await (supabase.from("academy_learning_track_progress") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyLearningTrackProgressRow | null;
}

export async function upsertLearningTrackProgress(
  userId: string,
  trackId: string,
  completedCourseIds: string[]
): Promise<AcademyLearningTrackProgressRow> {
  const { data, error } = await (supabase.from("academy_learning_track_progress") as any)
    .upsert(
      { user_id: userId, track_id: trackId, completed_course_ids: completedCourseIds, updated_at: new Date().toISOString() },
      { onConflict: "user_id,track_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AcademyLearningTrackProgressRow;
}

// ── Instructors (public profile) ──────────────────────────────────────────────

export async function fetchInstructorById(instructorId: string): Promise<AcademyInstructorRow | null> {
  const { data, error } = await (supabase.from("academy_instructors") as any)
    .select("*")
    .eq("id", instructorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorRow | null;
}

export async function fetchInstructorCourses(instructorId: string): Promise<AcademyCourseRow[]> {
  const { data, error } = await (supabase.from("academy_courses") as any)
    .select("*")
    .eq("instructor_id", instructorId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseRow[];
}
