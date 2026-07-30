import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { TeacherProfile, Course, Unit, Lesson } from "@/features/visionkids/types/academy.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchMyTeacherProfile(): Promise<TeacherProfile | null> {
  const { data, error } = await kidsDb.from("kids_teacher_profiles").select("*").maybeSingle().returns<TeacherProfile>();
  if (error) throw error;
  return data ?? null;
}

export async function becomeTeacher(displayName: string, bio?: string): Promise<TeacherProfile> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_teacher_profiles")
    .upsert({ user_id, display_name: displayName, bio: bio ?? null }, { onConflict: "user_id" })
    .select("*").single().returns<TeacherProfile>();
  if (error) throw error;
  return data;
}

export async function fetchMyCourses(): Promise<Course[]> {
  const { data, error } = await kidsDb.from("kids_courses").select("*").order("created_at", { ascending: false }).returns<Course[]>();
  if (error) throw error;
  return data ?? [];
}

export interface CreateCourseInput {
  title: string;
  description: string;
  subjectId: string;
  ageRange: Course["age_range"];
  difficulty: Course["difficulty"];
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "") || `course-${Date.now()}`;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const teacher_id = await requireUserId();
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const { data, error } = await kidsDb
    .from("kids_courses")
    .insert({
      teacher_id, slug, title: input.title, description: input.description,
      subject_id: input.subjectId, age_range: input.ageRange, difficulty: input.difficulty,
      status: "draft",
    })
    .select("*").single().returns<Course>();
  if (error) throw error;
  return data;
}

export async function publishCourse(courseId: string, publish: boolean): Promise<void> {
  const { error } = await kidsDb
    .from("kids_courses")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", courseId);
  if (error) throw error;
}

export async function createUnit(courseId: string, title: string, orderIndex: number): Promise<Unit> {
  const { data, error } = await kidsDb
    .from("kids_units").insert({ course_id: courseId, title, order_index: orderIndex }).select("*").single().returns<Unit>();
  if (error) throw error;
  return data;
}

export interface CreateLessonInput {
  unitId: string;
  courseId: string;
  title: string;
  description?: string;
  content: string;
  orderIndex: number;
  estimatedMinutes?: number;
}

export async function createLesson(input: CreateLessonInput): Promise<Lesson> {
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const { data, error } = await kidsDb
    .from("kids_lessons")
    .insert({
      unit_id: input.unitId, course_id: input.courseId, slug, title: input.title,
      description: input.description ?? null, content: input.content, order_index: input.orderIndex,
      estimated_minutes: input.estimatedMinutes ?? 10, status: "published",
    })
    .select("*").single().returns<Lesson>();
  if (error) throw error;
  return data;
}

export async function fetchCourseRoster(courseId: string): Promise<{ user_id: string; enrolled_at: string }[]> {
  const { data, error } = await kidsDb.from("kids_course_enrollments").select("user_id, enrolled_at").eq("course_id", courseId);
  if (error) throw error;
  return data ?? [];
}
