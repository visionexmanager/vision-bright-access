/**
 * Academy — Assessment Local Store (Phase 6, temporary)
 *
 * Client-only (localStorage) persistence, same honesty contract as every
 * other *LocalStore.ts file in this codebase. Quiz/assignment/project detail
 * records are keyed by the EXISTING AcademyLessonRow.id (see
 * instructorLocalStore.ts / mockCourses.ts) — this phase does not add a new
 * content hierarchy, only detail records under the current Course→Module→
 * Lesson structure, per the Phase 6 brief.
 *
 * Grading: MCQ/true-false/short-answer are auto-graded here. Essay/code
 * answers and all assignment/project submissions require manual instructor
 * grading — no AI grading is wired up anywhere in this file.
 */

import type {
  AcademyQuizRow, AcademyQuizQuestionRow, AcademyQuizAttemptRow,
  AcademyQuizAnalyticsSnapshot, AcademyQuizQuestionStat,
  AcademyAssignmentRow, AcademyAssignmentSubmissionRow,
  AcademyProjectRow, AcademyProjectSubmissionRow,
} from "@/lib/types/academy-lms";
import { MOCK_QUIZZES, MOCK_ASSIGNMENTS, MOCK_PROJECTS } from "./mockAssessments";
import { readJSON, writeJSON } from "./localStorageUtils";

const QUIZZES_KEY = "academy:quizzes";
const QUIZ_QUESTIONS_KEY = "academy:quiz-questions";
const QUIZ_ATTEMPTS_KEY = "academy:quiz-attempts";
const ASSIGNMENTS_KEY = "academy:assignments";
const ASSIGNMENT_SUBMISSIONS_KEY = "academy:assignment-submissions";
const PROJECTS_KEY = "academy:projects";
const PROJECT_SUBMISSIONS_KEY = "academy:project-submissions";

// ── Quizzes ────────────────────────────────────────────────────────────────────

export function getQuizForLessonAny(lessonId: string): { quiz: AcademyQuizRow; questions: AcademyQuizQuestionRow[] } | null {
  const quizzes = readJSON<Record<string, AcademyQuizRow>>(QUIZZES_KEY, {});
  const localQuiz = Object.values(quizzes).find((q) => q.lesson_id === lessonId);
  if (localQuiz) {
    const allQuestions = readJSON<Record<string, AcademyQuizQuestionRow[]>>(QUIZ_QUESTIONS_KEY, {});
    return { quiz: localQuiz, questions: (allQuestions[localQuiz.id] ?? []).sort((a, b) => a.order_index - b.order_index) };
  }
  return MOCK_QUIZZES[lessonId] ?? null;
}

export function saveQuizForLesson(lessonId: string, quizData: Partial<AcademyQuizRow>, questions: AcademyQuizQuestionRow[]): AcademyQuizRow {
  const quizzes = readJSON<Record<string, AcademyQuizRow>>(QUIZZES_KEY, {});
  const existing = Object.values(quizzes).find((q) => q.lesson_id === lessonId);
  const id = existing?.id ?? `local-quiz-${crypto.randomUUID()}`;
  const quiz: AcademyQuizRow = {
    id, lesson_id: lessonId,
    title: quizData.title ?? "اختبار بدون عنوان",
    passing_score_percent: quizData.passing_score_percent ?? 70,
    time_limit_minutes: quizData.time_limit_minutes ?? null,
    scope: quizData.scope ?? "lesson",
    attempts_limit: quizData.attempts_limit ?? null,
    randomize_questions: quizData.randomize_questions ?? false,
    instant_feedback: quizData.instant_feedback ?? true,
  };
  quizzes[id] = quiz;
  writeJSON(QUIZZES_KEY, quizzes);

  const allQuestions = readJSON<Record<string, AcademyQuizQuestionRow[]>>(QUIZ_QUESTIONS_KEY, {});
  allQuestions[id] = questions.map((q, i) => ({ ...q, quiz_id: id, order_index: i + 1 }));
  writeJSON(QUIZ_QUESTIONS_KEY, allQuestions);

  return quiz;
}

function readAllAttempts(): AcademyQuizAttemptRow[] {
  return readJSON<AcademyQuizAttemptRow[]>(QUIZ_ATTEMPTS_KEY, []);
}

export function getQuizAttempts(userId: string, quizId: string): AcademyQuizAttemptRow[] {
  return readAllAttempts()
    .filter((a) => a.user_id === userId && a.quiz_id === quizId)
    .sort((a, b) => b.attempt_number - a.attempt_number);
}

export function getQuizAttemptCount(userId: string, quizId: string): number {
  return getQuizAttempts(userId, quizId).length;
}

/** Every quiz attempt this user has ever submitted, across all quizzes — feeds gamification statistics. */
export function getAllQuizAttemptsForUser(userId: string): AcademyQuizAttemptRow[] {
  return readAllAttempts().filter((a) => a.user_id === userId);
}

/** Reverse lookup by the quiz's own id (attempts store quiz_id, not lesson_id) — checks both local and mock quizzes. */
export function getQuizByIdAny(quizId: string): AcademyQuizRow | null {
  const local = readJSON<Record<string, AcademyQuizRow>>(QUIZZES_KEY, {});
  const localMatch = Object.values(local).find((q) => q.id === quizId);
  if (localMatch) return localMatch;
  const mockMatch = Object.values(MOCK_QUIZZES).find((m) => m.quiz.id === quizId);
  return mockMatch?.quiz ?? null;
}

function gradeChoiceQuestion(question: AcademyQuizQuestionRow, selected: number[]): { correct: boolean; points: number } {
  const correctSet = new Set(question.correct_choice_indexes);
  const selectedSet = new Set(selected);
  if (question.type === "single_choice" || question.type === "true_false") {
    const correct = selected.length === 1 && correctSet.has(selected[0]);
    return { correct, points: correct ? question.points : 0 };
  }
  // multiple_choice: partial credit — reward correct picks, penalize wrong picks, floor at 0.
  const correctPicked = [...selectedSet].filter((i) => correctSet.has(i)).length;
  const wrongPicked = [...selectedSet].filter((i) => !correctSet.has(i)).length;
  const ratio = correctSet.size > 0 ? Math.max(0, (correctPicked - wrongPicked) / correctSet.size) : 0;
  const points = Math.round(question.points * ratio);
  return { correct: ratio === 1, points };
}

export function submitQuizAttemptLocal(
  userId: string,
  quiz: AcademyQuizRow,
  questions: AcademyQuizQuestionRow[],
  answers: Record<string, { choiceIndexes?: number[]; text?: string }>,
  questionTimeSeconds: Record<string, number>
): AcademyQuizAttemptRow {
  const questionResults: AcademyQuizAttemptRow["question_results"] = {};
  let totalPoints = 0;
  let earnedPoints = 0;
  let pendingManualGrading = false;

  for (const q of questions) {
    totalPoints += q.points;
    const answer = answers[q.id];

    if (q.type === "single_choice" || q.type === "multiple_choice" || q.type === "true_false") {
      const { correct, points } = gradeChoiceQuestion(q, answer?.choiceIndexes ?? []);
      questionResults[q.id] = { correct, points_earned: points, auto_graded: true };
      earnedPoints += points;
    } else if (q.type === "short_answer") {
      const text = (answer?.text ?? "").trim().toLowerCase();
      const correct = q.accepted_answers.some((a) => a.trim().toLowerCase() === text);
      const points = correct ? q.points : 0;
      questionResults[q.id] = { correct, points_earned: points, auto_graded: true };
      earnedPoints += points;
    } else {
      // essay / code — requires manual grading
      questionResults[q.id] = { correct: null, points_earned: 0, auto_graded: false };
      pendingManualGrading = true;
    }
  }

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const attemptNumber = getQuizAttemptCount(userId, quiz.id) + 1;

  const attempt: AcademyQuizAttemptRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    quiz_id: quiz.id,
    attempt_number: attemptNumber,
    score_percent: scorePercent,
    passed: !pendingManualGrading && scorePercent >= quiz.passing_score_percent,
    answers,
    question_results: questionResults,
    question_time_seconds: questionTimeSeconds,
    time_spent_seconds: Object.values(questionTimeSeconds).reduce((s, t) => s + t, 0),
    pending_manual_grading: pendingManualGrading,
    submitted_at: new Date().toISOString(),
  };

  const all = readAllAttempts();
  all.push(attempt);
  writeJSON(QUIZ_ATTEMPTS_KEY, all);
  return attempt;
}

export function computeQuizAnalytics(quizId: string): AcademyQuizAnalyticsSnapshot {
  const attempts = readAllAttempts().filter((a) => a.quiz_id === quizId);
  const attemptsCount = attempts.length;
  const averageScore = attemptsCount > 0 ? Math.round(attempts.reduce((s, a) => s + a.score_percent, 0) / attemptsCount) : 0;
  const passRate = attemptsCount > 0 ? Math.round((attempts.filter((a) => a.passed).length / attemptsCount) * 100) : 0;

  const distribution = new Array(10).fill(0);
  attempts.forEach((a) => {
    const bucket = Math.min(9, Math.floor(a.score_percent / 10));
    distribution[bucket]++;
  });

  const questionIds = new Set<string>();
  attempts.forEach((a) => Object.keys(a.question_results).forEach((id) => questionIds.add(id)));

  const questionStats: AcademyQuizQuestionStat[] = [...questionIds].map((questionId) => {
    const relevant = attempts.filter((a) => a.question_results[questionId]);
    const correctCount = relevant.filter((a) => a.question_results[questionId]?.correct === true).length;
    const times = relevant.map((a) => a.question_time_seconds[questionId] ?? 0).filter((t) => t > 0);
    const avgTime = times.length > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    const dropOff = attempts.length - relevant.length;
    return {
      question_id: questionId,
      correct_rate_percent: relevant.length > 0 ? Math.round((correctCount / relevant.length) * 100) : 0,
      avg_time_seconds: avgTime,
      drop_off_count: Math.max(0, dropOff),
    };
  });

  return {
    quiz_id: quizId,
    attempts_count: attemptsCount,
    average_score_percent: averageScore,
    pass_rate_percent: passRate,
    score_distribution: distribution,
    question_stats: questionStats,
    generated_at: new Date().toISOString(),
  };
}

// ── Assignments ──────────────────────────────────────────────────────────────

export function getAssignmentForLessonAny(lessonId: string): AcademyAssignmentRow | null {
  const all = readJSON<Record<string, AcademyAssignmentRow>>(ASSIGNMENTS_KEY, {});
  const local = Object.values(all).find((a) => a.lesson_id === lessonId);
  return local ?? MOCK_ASSIGNMENTS[lessonId] ?? null;
}

export function saveAssignmentForLesson(lessonId: string, data: Partial<AcademyAssignmentRow>): AcademyAssignmentRow {
  const all = readJSON<Record<string, AcademyAssignmentRow>>(ASSIGNMENTS_KEY, {});
  const existing = Object.values(all).find((a) => a.lesson_id === lessonId);
  const id = existing?.id ?? `local-assignment-${crypto.randomUUID()}`;
  const assignment: AcademyAssignmentRow = {
    id, lesson_id: lessonId,
    title: data.title ?? "واجب بدون عنوان",
    instructions_markdown: data.instructions_markdown ?? "",
    max_score: data.max_score ?? 100,
    due_offset_days: data.due_offset_days ?? null,
    type: data.type ?? "written",
    rubric: data.rubric ?? [],
    allow_resubmission: data.allow_resubmission ?? true,
    ai_feedback_enabled: false,
  };
  all[id] = assignment;
  writeJSON(ASSIGNMENTS_KEY, all);
  return assignment;
}

function readAllAssignmentSubmissions(): AcademyAssignmentSubmissionRow[] {
  return readJSON<AcademyAssignmentSubmissionRow[]>(ASSIGNMENT_SUBMISSIONS_KEY, []);
}

export function getAssignmentSubmissions(userId: string, assignmentId: string): AcademyAssignmentSubmissionRow[] {
  return readAllAssignmentSubmissions()
    .filter((s) => s.user_id === userId && s.assignment_id === assignmentId)
    .sort((a, b) => b.attempt_number - a.attempt_number);
}

export function getAllAssignmentSubmissionsForUser(userId: string): AcademyAssignmentSubmissionRow[] {
  return readAllAssignmentSubmissions().filter((s) => s.user_id === userId);
}

/** Reverse lookup by the assignment's own id — checks both local and mock assignments. */
export function getAssignmentByIdAny(assignmentId: string): AcademyAssignmentRow | null {
  const local = readJSON<Record<string, AcademyAssignmentRow>>(ASSIGNMENTS_KEY, {});
  const localMatch = Object.values(local).find((a) => a.id === assignmentId);
  if (localMatch) return localMatch;
  return Object.values(MOCK_ASSIGNMENTS).find((a) => a.id === assignmentId) ?? null;
}

export function submitAssignmentLocal(
  userId: string,
  assignmentId: string,
  contentUrl: string | null,
  notes: string | null,
  fileName: string | null
): AcademyAssignmentSubmissionRow {
  const attemptNumber = getAssignmentSubmissions(userId, assignmentId).length + 1;
  const submission: AcademyAssignmentSubmissionRow = {
    id: crypto.randomUUID(), user_id: userId, assignment_id: assignmentId,
    content_url: contentUrl, notes, score: null, status: "submitted", submitted_at: new Date().toISOString(),
    attempt_number: attemptNumber, file_name: fileName, rubric_scores: {},
    instructor_feedback: null, ai_feedback: null, graded_at: null, graded_by_user_id: null,
  };
  const all = readAllAssignmentSubmissions();
  all.push(submission);
  writeJSON(ASSIGNMENT_SUBMISSIONS_KEY, all);
  return submission;
}

export function gradeAssignmentSubmissionLocal(
  submissionId: string,
  rubricScores: Record<string, number>,
  feedback: string,
  graderUserId: string
): AcademyAssignmentSubmissionRow | null {
  const all = readAllAssignmentSubmissions();
  const idx = all.findIndex((s) => s.id === submissionId);
  if (idx === -1) return null;
  const totalScore = Object.values(rubricScores).reduce((s, v) => s + v, 0);
  const next: AcademyAssignmentSubmissionRow = {
    ...all[idx], score: totalScore, status: "graded", rubric_scores: rubricScores,
    instructor_feedback: feedback, graded_at: new Date().toISOString(), graded_by_user_id: graderUserId,
  };
  all[idx] = next;
  writeJSON(ASSIGNMENT_SUBMISSIONS_KEY, all);
  return next;
}

export function getUngradedAssignmentSubmissions(): AcademyAssignmentSubmissionRow[] {
  return readAllAssignmentSubmissions().filter((s) => s.status === "submitted");
}

// ── Projects ───────────────────────────────────────────────────────────────────

export function getProjectForLessonAny(lessonId: string): AcademyProjectRow | null {
  const all = readJSON<Record<string, AcademyProjectRow>>(PROJECTS_KEY, {});
  const local = Object.values(all).find((p) => p.lesson_id === lessonId);
  return local ?? MOCK_PROJECTS[lessonId] ?? null;
}

export function saveProjectForLesson(lessonId: string, data: Partial<AcademyProjectRow>): AcademyProjectRow {
  const all = readJSON<Record<string, AcademyProjectRow>>(PROJECTS_KEY, {});
  const existing = Object.values(all).find((p) => p.lesson_id === lessonId);
  const id = existing?.id ?? `local-project-${crypto.randomUUID()}`;
  const project: AcademyProjectRow = {
    id, lesson_id: lessonId,
    title: data.title ?? "مشروع بدون عنوان",
    brief_markdown: data.brief_markdown ?? "",
    rubric: data.rubric ?? [],
    description: data.description ?? "",
    requirements: data.requirements ?? [],
    steps: data.steps ?? [],
    resources: data.resources ?? [],
    submission_method: data.submission_method ?? "repo_url",
    ai_review_enabled: false,
  };
  all[id] = project;
  writeJSON(PROJECTS_KEY, all);
  return project;
}

function readAllProjectSubmissions(): AcademyProjectSubmissionRow[] {
  return readJSON<AcademyProjectSubmissionRow[]>(PROJECT_SUBMISSIONS_KEY, []);
}

export function getProjectSubmissions(userId: string, projectId: string): AcademyProjectSubmissionRow[] {
  return readAllProjectSubmissions()
    .filter((s) => s.user_id === userId && s.project_id === projectId)
    .sort((a, b) => b.attempt_number - a.attempt_number);
}

/** Every project this user has ever submitted, across all projects — feeds gamification statistics. */
/** Reverse lookup by the project's own id — checks both local and mock projects. */
export function getProjectByIdAny(projectId: string): AcademyProjectRow | null {
  const local = readJSON<Record<string, AcademyProjectRow>>(PROJECTS_KEY, {});
  const localMatch = Object.values(local).find((p) => p.id === projectId);
  if (localMatch) return localMatch;
  return Object.values(MOCK_PROJECTS).find((p) => p.id === projectId) ?? null;
}

export function getAllProjectSubmissionsForUser(userId: string): AcademyProjectSubmissionRow[] {
  return readAllProjectSubmissions().filter((s) => s.user_id === userId);
}

export function submitProjectLocal(userId: string, projectId: string, repoOrFileUrl: string): AcademyProjectSubmissionRow {
  const attemptNumber = getProjectSubmissions(userId, projectId).length + 1;
  const submission: AcademyProjectSubmissionRow = {
    id: crypto.randomUUID(), user_id: userId, project_id: projectId, repo_or_file_url: repoOrFileUrl,
    attempt_number: attemptNumber, rubric_scores: {}, instructor_review: null, ai_review: null,
    reviewed_at: null, reviewed_by_user_id: null, status: "submitted", submitted_at: new Date().toISOString(),
  };
  const all = readAllProjectSubmissions();
  all.push(submission);
  writeJSON(PROJECT_SUBMISSIONS_KEY, all);
  return submission;
}

export function reviewProjectSubmissionLocal(
  submissionId: string,
  rubricScores: Record<string, number>,
  review: string,
  reviewerUserId: string
): AcademyProjectSubmissionRow | null {
  const all = readAllProjectSubmissions();
  const idx = all.findIndex((s) => s.id === submissionId);
  if (idx === -1) return null;
  const next: AcademyProjectSubmissionRow = {
    ...all[idx], rubric_scores: rubricScores, instructor_review: review,
    reviewed_at: new Date().toISOString(), reviewed_by_user_id: reviewerUserId, status: "reviewed",
  };
  all[idx] = next;
  writeJSON(PROJECT_SUBMISSIONS_KEY, all);
  return next;
}

export function getUnreviewedProjectSubmissions(): AcademyProjectSubmissionRow[] {
  return readAllProjectSubmissions().filter((s) => s.status === "submitted");
}
