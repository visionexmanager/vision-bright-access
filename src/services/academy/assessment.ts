// ─── Academy — Assessment System Service Stubs (Phase 6 architecture prep) ───
// Placeholder implementations, same pattern as every other services/academy/*
// file. The real logic the UI runs against today lives in
// src/lib/academy/assessmentLocalStore.ts (localStorage) — quiz/assignment/
// project detail records are keyed by the EXISTING AcademyLessonRow.id, so no
// change to the Course→Module→Lesson structure was needed.
//
// AI grading/review is explicitly NOT wired up here (Phase 6 scope) — the
// `ai_feedback` / `ai_review` fields on submissions exist but are always null.

import type {
  AcademyQuizRow, AcademyQuizQuestionRow, AcademyQuizAttemptRow, AcademyQuizAnalyticsSnapshot,
  AcademyAssignmentRow, AcademyAssignmentSubmissionRow,
  AcademyProjectRow, AcademyProjectSubmissionRow,
} from "@/lib/types/academy-lms";

// ── Quizzes ────────────────────────────────────────────────────────────────────

export async function fetchQuizForLesson(lessonId: string): Promise<{ quiz: AcademyQuizRow; questions: AcademyQuizQuestionRow[] } | null> {
  void lessonId;
  return null;
}

export async function saveQuiz(quiz: AcademyQuizRow, questions: AcademyQuizQuestionRow[]): Promise<boolean> {
  void quiz;
  void questions;
  return false;
}

export async function submitQuizAttempt(
  attempt: Omit<AcademyQuizAttemptRow, "id" | "submitted_at">
): Promise<AcademyQuizAttemptRow | null> {
  void attempt;
  return null;
}

export async function fetchQuizAttempts(userId: string, quizId: string): Promise<AcademyQuizAttemptRow[]> {
  void userId;
  void quizId;
  return [];
}

export async function fetchQuizAnalytics(quizId: string): Promise<AcademyQuizAnalyticsSnapshot | null> {
  void quizId;
  return null;
}

export async function gradeQuizAttemptManually(
  attemptId: string,
  questionId: string,
  pointsAwarded: number
): Promise<boolean> {
  void attemptId;
  void questionId;
  void pointsAwarded;
  return false;
}

// ── Assignments ──────────────────────────────────────────────────────────────

export async function fetchAssignmentForLesson(lessonId: string): Promise<AcademyAssignmentRow | null> {
  void lessonId;
  return null;
}

export async function saveAssignment(assignment: AcademyAssignmentRow): Promise<boolean> {
  void assignment;
  return false;
}

export async function submitAssignment(
  submission: Omit<AcademyAssignmentSubmissionRow, "id" | "submitted_at" | "status" | "score" | "graded_at" | "graded_by_user_id" | "instructor_feedback" | "ai_feedback" | "rubric_scores">
): Promise<AcademyAssignmentSubmissionRow | null> {
  void submission;
  return null;
}

export async function fetchAssignmentSubmissions(userId: string, assignmentId: string): Promise<AcademyAssignmentSubmissionRow[]> {
  void userId;
  void assignmentId;
  return [];
}

export async function gradeAssignmentSubmission(
  submissionId: string,
  rubricScores: Record<string, number>,
  feedback: string,
  graderUserId: string
): Promise<boolean> {
  void submissionId;
  void rubricScores;
  void feedback;
  void graderUserId;
  return false;
}

// ── Projects ───────────────────────────────────────────────────────────────────

export async function fetchProjectForLesson(lessonId: string): Promise<AcademyProjectRow | null> {
  void lessonId;
  return null;
}

export async function saveProject(project: AcademyProjectRow): Promise<boolean> {
  void project;
  return false;
}

export async function submitProject(
  submission: Omit<AcademyProjectSubmissionRow, "id" | "submitted_at" | "status" | "reviewed_at" | "reviewed_by_user_id" | "instructor_review" | "ai_review" | "rubric_scores">
): Promise<AcademyProjectSubmissionRow | null> {
  void submission;
  return null;
}

export async function fetchProjectSubmissions(userId: string, projectId: string): Promise<AcademyProjectSubmissionRow[]> {
  void userId;
  void projectId;
  return [];
}

export async function reviewProjectSubmission(
  submissionId: string,
  rubricScores: Record<string, number>,
  review: string,
  reviewerUserId: string
): Promise<boolean> {
  void submissionId;
  void rubricScores;
  void review;
  void reviewerUserId;
  return false;
}

// ── Cross-cutting ──────────────────────────────────────────────────────────────

/** Course completion check feeds certificate eligibility — see services/academy/certificates.ts */
export async function fetchPendingGradingQueue(instructorId: string): Promise<{
  assignments: AcademyAssignmentSubmissionRow[];
  projects: AcademyProjectSubmissionRow[];
  quizAttempts: AcademyQuizAttemptRow[];
}> {
  void instructorId;
  return { assignments: [], projects: [], quizAttempts: [] };
}
