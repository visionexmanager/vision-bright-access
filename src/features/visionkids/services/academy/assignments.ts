import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Homework, HomeworkSubmission, StudentProject } from "@/features/visionkids/types/academy.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

// ── Homework ─────────────────────────────────────────────────────────────
export async function fetchCourseHomework(courseId: string): Promise<Homework[]> {
  const { data, error } = await kidsDb.from("kids_homework").select("*").eq("course_id", courseId).order("created_at", { ascending: false }).returns<Homework[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyHomework(): Promise<Homework[]> {
  const { data: enrollments } = await kidsDb.from("kids_course_enrollments").select("course_id");
  const courseIds = (enrollments ?? []).map((e: { course_id: string }) => e.course_id);
  if (courseIds.length === 0) return [];
  const { data, error } = await kidsDb.from("kids_homework").select("*").in("course_id", courseIds).order("created_at", { ascending: false }).returns<Homework[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyHomeworkSubmission(homeworkId: string): Promise<HomeworkSubmission | null> {
  const { data, error } = await kidsDb.from("kids_homework_submissions").select("*").eq("homework_id", homeworkId).maybeSingle().returns<HomeworkSubmission>();
  if (error) throw error;
  return data ?? null;
}

export interface SubmitHomeworkInput {
  homeworkId: string;
  textAnswer?: string;
  fileUrls?: string[];
}

export async function submitHomework(input: SubmitHomeworkInput): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_homework_submissions").upsert(
    { user_id, homework_id: input.homeworkId, text_answer: input.textAnswer ?? null, file_urls: input.fileUrls ?? [], status: "submitted", submitted_at: new Date().toISOString() },
    { onConflict: "homework_id,user_id" }
  );
  if (error) throw error;
}

export async function fetchSubmissionsForHomework(homeworkId: string): Promise<HomeworkSubmission[]> {
  const { data, error } = await kidsDb.from("kids_homework_submissions").select("*").eq("homework_id", homeworkId).order("submitted_at", { ascending: false }).returns<HomeworkSubmission[]>();
  if (error) throw error;
  return data ?? [];
}

export async function gradeHomeworkSubmission(submissionId: string, grade: number, feedback?: string): Promise<void> {
  const { error } = await kidsDb.from("kids_homework_submissions").update({ grade, feedback: feedback ?? null }).eq("id", submissionId);
  if (error) throw error;
}

// ── Projects ─────────────────────────────────────────────────────────────
export async function fetchMyProjectSubmission(projectId: string): Promise<StudentProject | null> {
  const { data, error } = await kidsDb.from("kids_student_projects").select("*").eq("project_id", projectId).maybeSingle().returns<StudentProject>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMyProjectSubmissions(): Promise<StudentProject[]> {
  const { data, error } = await kidsDb.from("kids_student_projects").select("*, project:kids_projects(*)").order("submitted_at", { ascending: false }).returns<StudentProject[]>();
  if (error) throw error;
  return data ?? [];
}

export interface SubmitProjectInput {
  projectId: string;
  textContent?: string;
  fileUrls?: string[];
}

export async function submitProject(input: SubmitProjectInput): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_student_projects").upsert(
    { user_id, project_id: input.projectId, text_content: input.textContent ?? null, file_urls: input.fileUrls ?? [], status: "submitted", submitted_at: new Date().toISOString() },
    { onConflict: "project_id,user_id" }
  );
  if (error) throw error;
}

export async function fetchSubmissionsForProject(projectId: string): Promise<StudentProject[]> {
  const { data, error } = await kidsDb.from("kids_student_projects").select("*").eq("project_id", projectId).order("submitted_at", { ascending: false }).returns<StudentProject[]>();
  if (error) throw error;
  return data ?? [];
}

export async function gradeProjectSubmission(submissionId: string, grade: number, feedback?: string): Promise<void> {
  const { error } = await kidsDb.from("kids_student_projects").update({ grade, feedback: feedback ?? null }).eq("id", submissionId);
  if (error) throw error;
}

// ── File uploads (kids-submissions private bucket) ──────────────────────
export async function uploadSubmissionFile(file: File, ownerFolder: string): Promise<string> {
  const user_id = await requireUserId();
  const path = `${user_id}/${ownerFolder}/${Date.now()}-${file.name}`;
  const { error } = await kidsDb.storage.from("kids-submissions").upload(path, file);
  if (error) throw error;
  const { data } = kidsDb.storage.from("kids-submissions").getPublicUrl(path);
  return data.publicUrl;
}
