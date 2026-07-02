// ─── Academy — Instructor Platform Service Stubs (Phase 4 architecture prep) ─
// Placeholder implementations, same pattern as services/academy/{modules,lms}.ts.
// The actual Phase 4 UI runs against src/lib/academy/instructorLocalStore.ts
// (localStorage) so the dashboard is genuinely usable today; these stubs are
// the contract the real Supabase-backed implementations will fill in later —
// swapping the local store calls for these should not require UI changes.
//
// Payment processing, revenue distribution, live streaming, and video hosting
// are explicitly NOT implemented here (Phase 4 scope).

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
  void userId;
  return null;
}

export async function saveApplication(
  application: Partial<AcademyInstructorApplicationRow> & { user_id: string }
): Promise<AcademyInstructorApplicationRow | null> {
  void application;
  return null;
}

export async function submitInstructorApplication(userId: string): Promise<AcademyInstructorApplicationRow | null> {
  void userId;
  return null;
}

export async function fetchAllApplications(): Promise<AcademyInstructorApplicationRow[]> {
  return [];
}

export async function reviewApplication(
  applicationId: string,
  status: AcademyInstructorApplicationRow["status"],
  reviewNote: string | null,
  adminUserId: string
): Promise<boolean> {
  void applicationId;
  void status;
  void reviewNote;
  void adminUserId;
  return false;
}

// ── Instructor Profiles ───────────────────────────────────────────────────────

export async function fetchInstructorById(instructorId: string): Promise<AcademyInstructorRow | null> {
  void instructorId;
  return null;
}

export async function updateInstructorProfile(
  instructorId: string,
  updates: Partial<AcademyInstructorRow>
): Promise<boolean> {
  void instructorId;
  void updates;
  return false;
}

// ── Organizations ──────────────────────────────────────────────────────────────

export async function fetchOrganizationById(orgId: string): Promise<AcademyOrganizationRow | null> {
  void orgId;
  return null;
}

export async function fetchOrganizationInstructors(orgId: string): Promise<AcademyInstructorRow[]> {
  void orgId;
  return [];
}

// ── Course Management ─────────────────────────────────────────────────────────

export async function fetchInstructorCourses(instructorId: string): Promise<AcademyCourseRow[]> {
  void instructorId;
  return [];
}

export async function createCourse(course: Partial<AcademyCourseRow> & { instructor_id: string }): Promise<AcademyCourseRow | null> {
  void course;
  return null;
}

export async function updateCourse(courseId: string, updates: Partial<AcademyCourseRow>): Promise<boolean> {
  void courseId;
  void updates;
  return false;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  void courseId;
  return false;
}

export async function duplicateCourse(courseId: string): Promise<AcademyCourseRow | null> {
  void courseId;
  return null;
}

export async function setCourseStatus(courseId: string, status: AcademyCourseRow["status"]): Promise<boolean> {
  void courseId;
  void status;
  return false;
}

// ── Modules & Lessons (builder) ───────────────────────────────────────────────

export async function saveCourseModules(courseId: string, modules: AcademyCourseModuleRow[]): Promise<boolean> {
  void courseId;
  void modules;
  return false;
}

export async function saveCourseLessons(courseId: string, lessons: AcademyLessonRow[]): Promise<boolean> {
  void courseId;
  void lessons;
  return false;
}

// ── Communication ──────────────────────────────────────────────────────────────

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

// ── Reviews & Moderation ─────────────────────────────────────────────────────

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

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function fetchInstructorAnalytics(instructorId: string): Promise<AcademyInstructorAnalyticsSnapshot | null> {
  void instructorId;
  return null;
}

// ── Admin actions ──────────────────────────────────────────────────────────────

export async function suspendInstructor(instructorId: string, adminUserId: string, note: string): Promise<boolean> {
  void instructorId;
  void adminUserId;
  void note;
  return false;
}

export async function verifyInstructor(instructorId: string, adminUserId: string): Promise<boolean> {
  void instructorId;
  void adminUserId;
  return false;
}
