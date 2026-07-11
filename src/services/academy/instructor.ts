// ─── Academy — Instructor Platform Service ────────────────────────────────────
// Applications, instructor profiles, and course/module/lesson management are
// real Supabase-backed implementations (Phase 1 backend). Organizations,
// announcements, lesson Q&A, review replies/reports, analytics, and the
// admin suspend/verify actions remain stubs — out of Phase 1 scope, still
// backed by src/lib/academy/instructorLocalStore.ts where the UI needs them.
//
// Payment processing, revenue distribution, live streaming, and video hosting
// are explicitly NOT implemented here (out of scope).

import { supabase } from "@/integrations/supabase/client";
import type { AcademyCourseRow, AcademyCourseModuleRow, AcademyInstructorRow } from "@/lib/types/academy-modules";
import type {
  AcademyLessonRow,
  AcademyInstructorApplicationRow,
  AcademyAnnouncementRow,
} from "@/lib/types/academy-lms";
import type {
  AcademyOrganizationRow,
  AcademyLessonQuestionRow,
  AcademyLessonAnswerRow,
  AcademyCourseReviewReplyRow,
  AcademyReviewReportRow,
  AcademyInstructorAnalyticsSnapshot,
} from "@/lib/types/academy-instructor";

// ── Instructor Applications ───────────────────────────────────────────────────

export async function fetchMyApplication(userId: string): Promise<AcademyInstructorApplicationRow | null> {
  const { data, error } = await (supabase.from("academy_instructor_applications") as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorApplicationRow | null;
}

/** Creates or updates the caller's own draft application. Never touches `status`. */
export async function saveApplication(
  application: Partial<Omit<AcademyInstructorApplicationRow, "id" | "user_id" | "status">> & { user_id: string }
): Promise<AcademyInstructorApplicationRow> {
  const { data, error } = await (supabase.from("academy_instructor_applications") as any)
    .upsert(application, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorApplicationRow;
}

export async function submitInstructorApplication(userId: string): Promise<AcademyInstructorApplicationRow | null> {
  const { data, error } = await (supabase.from("academy_instructor_applications") as any)
    .update({ status: "pending", submitted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorApplicationRow | null;
}

/** Lets a rejected applicant edit and resubmit. */
export async function resetApplicationToDraft(userId: string): Promise<AcademyInstructorApplicationRow | null> {
  const { data, error } = await (supabase.from("academy_instructor_applications") as any)
    .update({ status: "draft", submitted_at: null, review_note: null, reviewed_at: null, reviewed_by_user_id: null })
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorApplicationRow | null;
}

/** Admin only — enforced by RLS. */
export async function fetchAllApplications(): Promise<AcademyInstructorApplicationRow[]> {
  const { data, error } = await (supabase.from("academy_instructor_applications") as any)
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyInstructorApplicationRow[];
}

/** Admin only — enforced by RLS. Does not auto-create the instructor profile;
 *  the newly-approved user creates their own row on first dashboard visit via
 *  getOrCreateMyInstructorProfile() (RLS requires auth.uid() = user_id on insert). */
export async function reviewApplication(
  applicationId: string,
  status: AcademyInstructorApplicationRow["status"],
  reviewNote: string | null,
  adminUserId: string
): Promise<boolean> {
  const { error } = await (supabase.from("academy_instructor_applications") as any)
    .update({ status, review_note: reviewNote, reviewed_at: new Date().toISOString(), reviewed_by_user_id: adminUserId })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
  return true;
}

// ── Instructor Profiles ───────────────────────────────────────────────────────

export async function fetchInstructorById(instructorId: string): Promise<AcademyInstructorRow | null> {
  const { data, error } = await (supabase.from("academy_instructors") as any)
    .select("*")
    .eq("id", instructorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorRow | null;
}

export async function fetchMyInstructorProfile(userId: string): Promise<AcademyInstructorRow | null> {
  const { data, error } = await (supabase.from("academy_instructors") as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorRow | null;
}

/** Creates the instructor profile from an approved application, if one doesn't exist yet. */
export async function getOrCreateMyInstructorProfile(userId: string): Promise<AcademyInstructorRow | null> {
  const existing = await fetchMyInstructorProfile(userId);
  if (existing) return existing;

  const application = await fetchMyApplication(userId);
  if (!application || application.status !== "approved") return null;

  const { data, error } = await (supabase.from("academy_instructors") as any)
    .insert({
      user_id: userId,
      name: application.headline || "مدرّس جديد",
      headline: application.headline || null,
      bio: application.bio || null,
      subjects: application.expertise,
      social_links: application.portfolio_url ? { website: application.portfolio_url } : {},
      skills: application.skills,
      expertise: application.expertise,
      languages: application.languages,
      country: application.country,
      portfolio_url: application.portfolio_url,
      level: "new",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AcademyInstructorRow;
}

export async function updateInstructorProfile(
  instructorId: string,
  updates: Partial<Omit<AcademyInstructorRow, "id" | "user_id">>
): Promise<boolean> {
  const { error } = await (supabase.from("academy_instructors") as any).update(updates).eq("id", instructorId);
  if (error) throw new Error(error.message);
  return true;
}

// ── Organizations (out of Phase 1 scope — stub) ──────────────────────────────

export async function fetchOrganizationById(orgId: string): Promise<AcademyOrganizationRow | null> {
  void orgId;
  return null;
}

export async function fetchOrganizationInstructors(orgId: string): Promise<AcademyInstructorRow[]> {
  void orgId;
  return [];
}

// ── Course Management ─────────────────────────────────────────────────────────

/** All of the instructor's own courses regardless of status — for their dashboard. */
export async function fetchInstructorCourses(instructorId: string): Promise<AcademyCourseRow[]> {
  const { data, error } = await (supabase.from("academy_courses") as any)
    .select("*")
    .eq("instructor_id", instructorId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyCourseRow[];
}

export async function createCourse(
  course: Partial<AcademyCourseRow> & { instructor_id: string }
): Promise<AcademyCourseRow> {
  const payload = {
    title: "دورة جديدة بدون عنوان",
    description: "",
    level: "",
    subject: "",
    status: "draft",
    published: false,
    source: "marketplace",
    difficulty: "beginner",
    language: "العربية",
    category: "عام",
    tags: [],
    is_free: true,
    ...course,
  };
  const { data, error } = await (supabase.from("academy_courses") as any).insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as AcademyCourseRow;
}

export async function updateCourse(courseId: string, updates: Partial<AcademyCourseRow>): Promise<boolean> {
  const { error } = await (supabase.from("academy_courses") as any).update(updates).eq("id", courseId);
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const { error } = await (supabase.from("academy_courses") as any).delete().eq("id", courseId);
  if (error) throw new Error(error.message);
  return true;
}

export async function duplicateCourse(courseId: string): Promise<AcademyCourseRow | null> {
  const { data: source, error: sourceErr } = await (supabase.from("academy_courses") as any)
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (sourceErr) throw new Error(sourceErr.message);
  if (!source) return null;

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = source as AcademyCourseRow & Record<string, unknown>;
  const newCourse = await createCourse({
    ...(rest as Partial<AcademyCourseRow>),
    instructor_id: source.instructor_id,
    title: `${source.title} (نسخة)`,
    status: "draft",
    published: false,
  });

  const { data: modules, error: modErr } = await (supabase.from("academy_course_modules") as any)
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (modErr) throw new Error(modErr.message);

  for (const m of (modules ?? []) as AcademyCourseModuleRow[]) {
    const { data: newModule, error: newModErr } = await (supabase.from("academy_course_modules") as any)
      .insert({ course_id: newCourse.id, title: m.title, order_index: m.order_index, content_url: m.content_url })
      .select()
      .single();
    if (newModErr) throw new Error(newModErr.message);

    const { data: lessons, error: lessonErr } = await (supabase.from("academy_lessons") as any)
      .select("*")
      .eq("module_id", m.id)
      .order("order_index", { ascending: true });
    if (lessonErr) throw new Error(lessonErr.message);

    for (const l of (lessons ?? []) as AcademyLessonRow[]) {
      const { id: _lid, ...lessonRest } = l as AcademyLessonRow & Record<string, unknown>;
      await (supabase.from("academy_lessons") as any).insert({
        ...lessonRest,
        module_id: newModule.id,
        course_id: newCourse.id,
      });
    }
  }

  return newCourse;
}

export async function setCourseStatus(courseId: string, status: AcademyCourseRow["status"]): Promise<boolean> {
  return updateCourse(courseId, { status, published: status === "published" });
}

// ── Modules & Lessons (builder) ───────────────────────────────────────────────
// Diff-based upsert: preserves existing row ids (so lesson progress/notes/
// bookmarks tied to them survive edits) and only deletes rows the instructor
// actually removed in the builder UI. New rows must arrive with a real UUID
// (crypto.randomUUID()) already assigned client-side.

export async function saveCourseModules(courseId: string, modulesList: AcademyCourseModuleRow[]): Promise<boolean> {
  const keepIds = modulesList.map((m) => m.id);
  let del = (supabase.from("academy_course_modules") as any).delete().eq("course_id", courseId);
  if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);

  if (modulesList.length === 0) return true;
  const { error } = await (supabase.from("academy_course_modules") as any)
    .upsert(modulesList.map((m) => ({ ...m, course_id: courseId })), { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

export async function saveCourseLessons(courseId: string, lessonsList: AcademyLessonRow[]): Promise<boolean> {
  const keepIds = lessonsList.map((l) => l.id);
  let del = (supabase.from("academy_lessons") as any).delete().eq("course_id", courseId);
  if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);

  if (lessonsList.length === 0) return true;
  const { error } = await (supabase.from("academy_lessons") as any)
    .upsert(lessonsList.map((l) => ({ ...l, course_id: courseId })), { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

// ── Communication (out of Phase 1 scope — stub, see instructorLocalStore.ts) ─

export async function fetchAnnouncements(instructorId: string): Promise<AcademyAnnouncementRow[]> {
  void instructorId;
  return [];
}

export async function postAnnouncement(
  announcement: Omit<AcademyAnnouncementRow, "id" | "created_at">
): Promise<AcademyAnnouncementRow | null> {
  void announcement;
  return null;
}

export async function fetchLessonQuestions(lessonId: string): Promise<AcademyLessonQuestionRow[]> {
  void lessonId;
  return [];
}

export async function postLessonAnswer(
  answer: Omit<AcademyLessonAnswerRow, "id" | "created_at">
): Promise<AcademyLessonAnswerRow | null> {
  void answer;
  return null;
}

export async function pinLessonAnswer(answerId: string, pinned: boolean): Promise<boolean> {
  void answerId;
  void pinned;
  return false;
}

// ── Reviews & Moderation (out of Phase 1 scope — stub) ───────────────────────

export async function postReviewReply(
  reply: Omit<AcademyCourseReviewReplyRow, "id" | "created_at">
): Promise<AcademyCourseReviewReplyRow | null> {
  void reply;
  return null;
}

export async function reportReview(
  report: Omit<AcademyReviewReportRow, "id" | "status" | "created_at">
): Promise<boolean> {
  void report;
  return false;
}

export async function fetchReviewReports(): Promise<AcademyReviewReportRow[]> {
  return [];
}

// ── Analytics (out of Phase 1 scope — stub) ──────────────────────────────────

export async function fetchInstructorAnalytics(instructorId: string): Promise<AcademyInstructorAnalyticsSnapshot | null> {
  void instructorId;
  return null;
}

// ── Admin actions ──────────────────────────────────────────────────────────────

export async function suspendInstructor(instructorId: string, adminUserId: string, note: string): Promise<boolean> {
  void adminUserId;
  const { error } = await (supabase.from("academy_instructors") as any)
    .update({ verified: false, level: "new" })
    .eq("id", instructorId);
  if (error) throw new Error(error.message);
  void note;
  return true;
}

export async function verifyInstructor(instructorId: string, adminUserId: string): Promise<boolean> {
  void adminUserId;
  const { error } = await (supabase.from("academy_instructors") as any).update({ verified: true }).eq("id", instructorId);
  if (error) throw new Error(error.message);
  return true;
}
