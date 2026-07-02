// ─── Academy — LMS Service Stubs (Phase 3 architecture prep) ─────────────────
// Placeholder implementations, same pattern as src/services/finance/index.ts
// and src/services/academy/modules.ts. Real Supabase-backed implementations
// land once the tables in src/lib/types/academy-lms.ts are migrated.
//
// Quiz/assignment/project *grading* logic, certificate issuance, and AI
// generation are explicitly out of scope for Phase 3 — these stubs only
// establish the call contract the real implementations will fill in.

import type {
  AcademyLessonRow,
  AcademyLessonProgressRow,
  AcademyLessonNoteRow,
  AcademyLessonBookmarkRow,
  AcademyQuizRow,
  AcademyQuizAttemptRow,
  AcademyAssignmentRow,
  AcademyAssignmentSubmissionRow,
  AcademyProjectRow,
  AcademyCourseReviewRow,
  AcademyLearningTrackRow,
  AcademyLearningTrackProgressRow,
  AcademyAICourseRequestRow,
  AcademyInstructorApplicationRow,
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
  void filters;
  return [];
}

export async function fetchCourseById(courseId: string): Promise<AcademyCourseRow | null> {
  void courseId;
  return null;
}

export async function fetchSimilarCourses(courseId: string, limit = 4): Promise<AcademyCourseRow[]> {
  void courseId;
  void limit;
  return [];
}

// ── Modules & Lessons ─────────────────────────────────────────────────────────

export async function fetchCourseModules(courseId: string): Promise<AcademyCourseModuleRow[]> {
  void courseId;
  return [];
}

export async function fetchModuleLessons(moduleId: string): Promise<AcademyLessonRow[]> {
  void moduleId;
  return [];
}

export async function fetchLessonById(lessonId: string): Promise<AcademyLessonRow | null> {
  void lessonId;
  return null;
}

// ── Enrollment & Progress ─────────────────────────────────────────────────────

export async function fetchEnrollment(userId: string, courseId: string): Promise<AcademyEnrollmentRow | null> {
  void userId;
  void courseId;
  return null;
}

export async function enrollInCourse(userId: string, courseId: string): Promise<AcademyEnrollmentRow | null> {
  void userId;
  void courseId;
  return null;
}

export async function updateLessonProgress(
  userId: string,
  lessonId: string,
  update: Partial<Pick<AcademyLessonProgressRow, "completed" | "last_position_seconds">>
): Promise<boolean> {
  void userId;
  void lessonId;
  void update;
  return false;
}

// ── Notes & Bookmarks ─────────────────────────────────────────────────────────
// Phase 3 UI persists these via localStorage (see lessonLocalStore.ts) — these
// stubs are the future Supabase sync target, not called by the UI yet.

export async function fetchLessonNotes(userId: string, lessonId: string): Promise<AcademyLessonNoteRow[]> {
  void userId;
  void lessonId;
  return [];
}

export async function saveLessonNote(note: Omit<AcademyLessonNoteRow, "id" | "created_at">): Promise<boolean> {
  void note;
  return false;
}

export async function fetchLessonBookmarks(userId: string, lessonId: string): Promise<AcademyLessonBookmarkRow[]> {
  void userId;
  void lessonId;
  return [];
}

export async function toggleLessonBookmark(
  userId: string,
  lessonId: string,
  timestampSeconds: number | null
): Promise<boolean> {
  void userId;
  void lessonId;
  void timestampSeconds;
  return false;
}

// ── Quizzes / Assignments / Projects (structure only, no grading) ───────────

export async function fetchQuizForLesson(lessonId: string): Promise<AcademyQuizRow | null> {
  void lessonId;
  return null;
}

export async function submitQuizAttempt(
  attempt: Omit<AcademyQuizAttemptRow, "id" | "submitted_at">
): Promise<AcademyQuizAttemptRow | null> {
  void attempt;
  return null;
}

export async function fetchAssignmentForLesson(lessonId: string): Promise<AcademyAssignmentRow | null> {
  void lessonId;
  return null;
}

export async function submitAssignment(
  submission: Omit<AcademyAssignmentSubmissionRow, "id" | "submitted_at" | "status" | "score">
): Promise<AcademyAssignmentSubmissionRow | null> {
  void submission;
  return null;
}

export async function fetchProjectForLesson(lessonId: string): Promise<AcademyProjectRow | null> {
  void lessonId;
  return null;
}

// ── Reviews & Ratings ─────────────────────────────────────────────────────────

export async function fetchCourseReviews(courseId: string): Promise<AcademyCourseReviewRow[]> {
  void courseId;
  return [];
}

export async function submitCourseReview(
  review: Omit<AcademyCourseReviewRow, "id" | "created_at">
): Promise<AcademyCourseReviewRow | null> {
  void review;
  return null;
}

// ── Learning Tracks ────────────────────────────────────────────────────────────

export async function fetchLearningTracks(): Promise<AcademyLearningTrackRow[]> {
  return [];
}

export async function fetchLearningTrackById(trackId: string): Promise<AcademyLearningTrackRow | null> {
  void trackId;
  return null;
}

export async function fetchLearningTrackProgress(
  userId: string,
  trackId: string
): Promise<AcademyLearningTrackProgressRow | null> {
  void userId;
  void trackId;
  return null;
}

// ── AI Courses ────────────────────────────────────────────────────────────────
// Generation is explicitly out of scope for Phase 3. This only records intent
// so the UI can show an honest "queued" state instead of a dead button.

export async function requestAICourse(userId: string, topic: string): Promise<AcademyAICourseRequestRow | null> {
  void userId;
  void topic;
  return null;
}

// ── Instructors & Marketplace ─────────────────────────────────────────────────

export async function fetchInstructorById(instructorId: string): Promise<AcademyInstructorRow | null> {
  void instructorId;
  return null;
}

export async function fetchInstructorCourses(instructorId: string): Promise<AcademyCourseRow[]> {
  void instructorId;
  return [];
}

export async function submitInstructorApplication(
  application: Omit<AcademyInstructorApplicationRow, "id" | "status" | "submitted_at">
): Promise<AcademyInstructorApplicationRow | null> {
  void application;
  return null;
}
