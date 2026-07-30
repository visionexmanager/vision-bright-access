import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Subject, Course, CourseWithSubject, Unit, Lesson, LessonActivity, Worksheet, ProjectTemplate, AcademyAgeRange,
} from "@/features/visionkids/types/academy.types";

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await kidsDb.from("kids_subjects").select("*").eq("is_active", true).order("display_order").returns<Subject[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchSubjectBySlug(slug: string): Promise<Subject | null> {
  const { data, error } = await kidsDb.from("kids_subjects").select("*").eq("slug", slug).eq("is_active", true).maybeSingle().returns<Subject>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCoursesBySubject(subjectSlug: string, ageRange?: AcademyAgeRange): Promise<Course[]> {
  const subject = await fetchSubjectBySlug(subjectSlug);
  if (!subject) return [];
  let query = kidsDb.from("kids_courses").select("*").eq("status", "published").eq("subject_id", subject.id);
  if (ageRange) query = query.eq("age_range", ageRange);
  const { data, error } = await query.order("published_at", { ascending: false }).returns<Course[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseBySlug(slug: string): Promise<CourseWithSubject | null> {
  const { data, error } = await kidsDb
    .from("kids_courses").select("*, subject:kids_subjects(*)").eq("slug", slug).eq("status", "published").maybeSingle()
    .returns<CourseWithSubject>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCourseById(id: string): Promise<CourseWithSubject | null> {
  const { data, error } = await kidsDb
    .from("kids_courses").select("*, subject:kids_subjects(*)").eq("id", id).maybeSingle()
    .returns<CourseWithSubject>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchFeaturedCourses(limit = 12): Promise<Course[]> {
  const { data, error } = await kidsDb.from("kids_courses").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(limit).returns<Course[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseUnits(courseId: string): Promise<Unit[]> {
  const { data, error } = await kidsDb.from("kids_units").select("*").eq("course_id", courseId).order("order_index").returns<Unit[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseLessons(courseId: string): Promise<Lesson[]> {
  const { data, error } = await kidsDb.from("kids_lessons").select("*").eq("course_id", courseId).eq("status", "published").order("order_index").returns<Lesson[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLessonBySlug(courseId: string, slug: string): Promise<Lesson | null> {
  const { data, error } = await kidsDb
    .from("kids_lessons").select("*").eq("course_id", courseId).eq("slug", slug).eq("status", "published").maybeSingle()
    .returns<Lesson>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchLessonById(id: string): Promise<Lesson | null> {
  const { data, error } = await kidsDb.from("kids_lessons").select("*").eq("id", id).maybeSingle().returns<Lesson>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchLessonActivities(lessonId: string): Promise<LessonActivity[]> {
  const { data, error } = await kidsDb.from("kids_lesson_activities").select("*").eq("lesson_id", lessonId).order("order_index").returns<LessonActivity[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseWorksheets(courseId: string): Promise<Worksheet[]> {
  const { data, error } = await kidsDb.from("kids_worksheets").select("*").eq("course_id", courseId).returns<Worksheet[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectById(id: string): Promise<ProjectTemplate | null> {
  const { data, error } = await kidsDb.from("kids_projects").select("*").eq("id", id).maybeSingle().returns<ProjectTemplate>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCourseProjects(courseId: string): Promise<ProjectTemplate[]> {
  const { data, error } = await kidsDb.from("kids_projects").select("*").eq("course_id", courseId).returns<ProjectTemplate[]>();
  if (error) throw error;
  return data ?? [];
}

/** Lessons that actually have a video or audio file — the real candidate
 *  list for the Downloads page (nothing to download if there's no file). */
export async function fetchDownloadableLessons(limit = 30): Promise<Lesson[]> {
  const { data, error } = await kidsDb
    .from("kids_lessons").select("*").eq("status", "published")
    .or("video_url.not.is.null,audio_url.not.is.null")
    .limit(limit)
    .returns<Lesson[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllWorksheets(limit = 30): Promise<Worksheet[]> {
  const { data, error } = await kidsDb.from("kids_worksheets").select("*").limit(limit).returns<Worksheet[]>();
  if (error) throw error;
  return data ?? [];
}

export async function searchCourses(query: string, ageRange?: AcademyAgeRange, limit = 24): Promise<Course[]> {
  let q = kidsDb.from("kids_courses").select("*").eq("status", "published");
  if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
  if (ageRange) q = q.eq("age_range", ageRange);
  const { data, error } = await q.limit(limit).returns<Course[]>();
  if (error) throw error;
  return data ?? [];
}
