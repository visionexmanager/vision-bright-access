/**
 * Academy — LMS Types (Phase 3 architecture prep)
 *
 * Extends the module scaffolding from Phase 1 (see academy-modules.ts, which
 * still owns AcademyCourseRow / AcademyInstructorRow / AcademyEnrollmentRow /
 * AcademyCertificateRow) with the deeper course-structure types needed for a
 * full LMS: modules → lessons → quiz/assignment/project → certificate.
 *
 * None of these tables exist yet. No migrations have been written. The UI
 * built against these types (Phase 3) renders sample/local data — see
 * src/lib/academy/mockCourses.ts — until the real backend lands.
 *
 * FK convention unchanged from Phase 1: every row carries user_id →
 * academy_profiles.user_id where ownership applies.
 */

// ── Lessons ──────────────────────────────────────────────────────────────────
// Planned table: academy_lessons
// academy_lessons.module_id → AcademyCourseModuleRow.id (academy-modules.ts)

export type AcademyLessonKind =
  | "video"
  | "youtube"
  | "text"
  | "quiz"
  | "assignment"
  | "project"
  // ── Phase 4 (Lesson Builder) additions ─────────────────────────────────────
  | "pdf"
  | "presentation"
  | "audio"
  | "external_link"     // primary content is external_links[0]
  | "downloads"          // primary content is the attachments[] list
  | "live_session"       // preparation only — no real streaming/video hosting
  | "code_example"       // primary content is code_snippets[0]
  | "exercise";          // instructions in body_markdown, no grading logic yet

export interface AcademyLessonRow {
  id: string;
  module_id: string;       // FK → AcademyCourseModuleRow.id
  course_id: string;       // FK → AcademyCourseRow.id (denormalized for fast lookups)
  title: string;
  kind: AcademyLessonKind;
  order_index: number;
  duration_seconds: number;
  /** Set when kind === "video": VisionEx-hosted file URL, playable via native <video>. */
  video_url: string | null;
  /** Set when kind === "youtube": embed-only, per YouTube ToS — never downloaded/copied. */
  youtube_video_id: string | null;
  /** Set when kind === "text": rendered as markdown, same renderer as the Munir chat. */
  body_markdown: string | null;
  /** Set when kind is pdf/presentation/audio: hosted file URL (no video hosting — file delivery only). */
  file_url: string | null;
  /** Set when kind === "live_session": scheduled time. Preparation only — no real streaming. */
  live_session_scheduled_at: string | null;
  attachments: AcademyLessonAttachment[];
  external_links: Array<{ label: string; url: string }>;
  code_snippets: Array<{ language: string; code: string }>;
  is_preview: boolean;     // viewable without enrollment
}

export interface AcademyLessonAttachment {
  id: string;
  label: string;
  file_url: string;
  file_size_bytes: number | null;
}

// ── Lesson Progress / Notes / Bookmarks ──────────────────────────────────────
// Planned tables: academy_lesson_progress, academy_lesson_notes, academy_lesson_bookmarks
// All FK user_id → academy_profiles.user_id, lesson_id → AcademyLessonRow.id
//
// Phase 3 UI persists these client-side (localStorage, see lessonLocalStore.ts)
// as an honest stand-in until the tables above are migrated — the shape below
// is what the eventual Supabase sync will use, so the client store mirrors it.

export interface AcademyLessonProgressRow {
  user_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
  last_position_seconds: number;
  updated_at: string;
}

export interface AcademyLessonNoteRow {
  id: string;
  user_id: string;
  lesson_id: string;
  /** Video timestamp the note was taken at, if applicable. */
  timestamp_seconds: number | null;
  content: string;
  created_at: string;
}

export interface AcademyLessonBookmarkRow {
  id: string;
  user_id: string;
  lesson_id: string;
  timestamp_seconds: number | null;
  label: string | null;
  created_at: string;
}

// ── Quizzes ──────────────────────────────────────────────────────────────────
// Planned tables: academy_quizzes, academy_quiz_questions, academy_quiz_attempts
// Phase 6 implements real quiz-taking + auto-grading (MCQ/true-false/exact-
// match short answer) client-side against these shapes — see
// lib/academy/assessmentLocalStore.ts. Essay/code answers still require
// manual instructor grading (no AI grading per Phase 6 scope).
//
// Architecture note: a quiz still belongs to exactly one AcademyLessonRow
// (kind === "quiz"), same as Phase 3 — "module quiz" and "final course exam"
// are expressed via `scope` below + where the instructor places that lesson
// in the course (e.g. a dedicated last lesson in a module, or a dedicated
// "Final Exam" module), NOT a change to the Course→Module→Lesson structure.

export type AcademyQuizQuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay" | "code";
export type AcademyQuizScope = "lesson" | "module" | "final_exam";
export type AcademyQuestionDifficulty = "easy" | "medium" | "hard";

export interface AcademyQuizQuestionRow {
  id: string;
  quiz_id: string;          // FK → AcademyQuizRow.id
  order_index: number;
  type: AcademyQuizQuestionType;
  prompt: string;
  choices: string[];        // empty for short_answer/essay/code
  correct_choice_indexes: number[];
  /** Accepted answers for short_answer (case-insensitive match against any entry). */
  accepted_answers: string[];
  /** Starter code shown for `code` questions; not auto-graded — reviewed manually. */
  code_starter: string | null;
  code_language: string | null;
  points: number;
  difficulty: AcademyQuestionDifficulty;
  /** Shown after answering when the quiz's instant_feedback is on, or always in results. */
  explanation: string | null;
}

export interface AcademyQuizRow {
  id: string;
  lesson_id: string;        // FK → AcademyLessonRow.id (kind === "quiz")
  title: string;
  passing_score_percent: number;
  time_limit_minutes: number | null;

  // ── Phase 6 (Quiz Engine) additions ──────────────────────────────────────
  scope: AcademyQuizScope;
  attempts_limit: number | null;   // null = unlimited
  randomize_questions: boolean;
  instant_feedback: boolean;       // show correct/incorrect right after each question
}

export interface AcademyQuizAttemptRow {
  id: string;
  user_id: string;
  quiz_id: string;
  attempt_number: number;
  score_percent: number;
  passed: boolean;
  /** question_id -> student's answer (choice indexes for MCQ/TF, free text for short_answer/essay/code). */
  answers: Record<string, { choiceIndexes?: number[]; text?: string }>;
  /** question_id -> grading outcome. auto_graded=false means it's pending manual review (essay/code). */
  question_results: Record<string, { correct: boolean | null; points_earned: number; auto_graded: boolean }>;
  /** question_id -> seconds spent — feeds quiz analytics (avg time per question). */
  question_time_seconds: Record<string, number>;
  time_spent_seconds: number;
  /** True while any essay/code question awaits manual grading. */
  pending_manual_grading: boolean;
  submitted_at: string;
}

// ── Quiz Analytics ─────────────────────────────────────────────────────────────
// Computed on-demand from AcademyQuizAttemptRow (see assessmentLocalStore.ts'
// computeQuizAnalytics) — not a stored table, but the shape data layer for
// future AI-assisted analysis mentioned in the Phase 6 brief.

export interface AcademyQuizQuestionStat {
  question_id: string;
  correct_rate_percent: number;
  avg_time_seconds: number;
  /** Attempts that stopped (didn't answer past) this question — drop-off signal. */
  drop_off_count: number;
}

export interface AcademyQuizAnalyticsSnapshot {
  quiz_id: string;
  attempts_count: number;
  average_score_percent: number;
  pass_rate_percent: number;
  /** 10-wide buckets: [0-10%, 10-20%, ... 90-100%]. */
  score_distribution: number[];
  question_stats: AcademyQuizQuestionStat[];
  generated_at: string;
}

// ── Assignments ──────────────────────────────────────────────────────────────
// Planned tables: academy_assignments, academy_assignment_submissions
// Phase 6 implements real submission + manual grading. AI feedback is
// explicitly prepared (field present) but never populated — no AI grading yet.

export type AcademyAssignmentType = "written" | "file_upload" | "coding" | "research" | "problem_solving";

export interface AcademyAssignmentRow {
  id: string;
  lesson_id: string;        // FK → AcademyLessonRow.id (kind === "assignment")
  title: string;
  instructions_markdown: string;
  max_score: number;
  due_offset_days: number | null; // days after enrollment, if time-boxed

  // ── Phase 6 (Assignments System) additions ───────────────────────────────
  type: AcademyAssignmentType;
  rubric: Array<{ criterion: string; max_points: number }>;
  allow_resubmission: boolean;
  /** Preparation only — no AI grading pipeline is wired up (Phase 6 scope). */
  ai_feedback_enabled: boolean;
}

export interface AcademyAssignmentSubmissionRow {
  id: string;
  user_id: string;
  assignment_id: string;
  content_url: string | null;
  notes: string | null;
  score: number | null;
  status: "submitted" | "graded" | "returned";
  submitted_at: string;

  // ── Phase 6 (Assignments System) additions ───────────────────────────────
  attempt_number: number;
  file_name: string | null;
  /** Per-rubric-criterion points awarded, when the instructor grades with the rubric. */
  rubric_scores: Record<string, number>;
  instructor_feedback: string | null;
  /** Always null until a real AI grading pipeline is authorized — field exists for that future phase. */
  ai_feedback: string | null;
  graded_at: string | null;
  graded_by_user_id: string | null;
}

// ── Projects ─────────────────────────────────────────────────────────────────
// Planned tables: academy_projects, academy_project_submissions

export type AcademyProjectSubmissionMethod = "repo_url" | "file_upload" | "live_url";

export interface AcademyProjectRow {
  id: string;
  lesson_id: string;        // FK → AcademyLessonRow.id (kind === "project")
  title: string;
  brief_markdown: string;
  rubric: Array<{ criterion: string; max_points: number }>;

  // ── Phase 6 (Project System) additions ───────────────────────────────────
  description: string;
  requirements: string[];
  steps: string[];
  resources: Array<{ label: string; url: string }>;
  submission_method: AcademyProjectSubmissionMethod;
  /** Preparation only — no AI review pipeline is wired up (Phase 6 scope). */
  ai_review_enabled: boolean;
}

export interface AcademyProjectSubmissionRow {
  id: string;
  user_id: string;
  project_id: string;
  repo_or_file_url: string | null;

  // ── Phase 6 (Project System) additions ───────────────────────────────────
  attempt_number: number;
  rubric_scores: Record<string, number>;
  instructor_review: string | null;
  /** Always null until a real AI review pipeline is authorized — field exists for that future phase. */
  ai_review: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  status: "submitted" | "reviewed";
  submitted_at: string;
}

// ── Reviews & Ratings ─────────────────────────────────────────────────────────
// Planned table: academy_course_reviews
// user_id → academy_profiles.user_id, course_id → AcademyCourseRow.id

export interface AcademyCourseReviewRow {
  id: string;
  user_id: string;
  course_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  created_at: string;
}

// ── Learning Tracks (curated Beginner/Intermediate/Advanced paths) ──────────
// Planned tables: academy_learning_tracks, academy_learning_track_courses
// Distinct from AcademyLearningPathRow (academy-modules.ts), which is a
// personal AI-generated study plan — a track is a curated, shared, multi-course
// curriculum with a fixed difficulty tier.

export interface AcademyLearningTrackRow {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  course_ids: string[];      // ordered FK list → AcademyCourseRow.id
  estimated_duration_minutes: number;
  skills: string[];
  certificate_id: string | null; // FK → AcademyCertificateRow.id, awarded on track completion
}

export interface AcademyLearningTrackProgressRow {
  user_id: string;
  track_id: string;
  completed_course_ids: string[];
  updated_at: string;
}

// ── AI Courses ────────────────────────────────────────────────────────────────
// Planned table: academy_ai_course_requests
// Generation itself is explicitly out of scope for Phase 3 — this only models
// the request lifecycle so the UI can honestly show "queued/coming soon".

export type AcademyAICourseRequestStatus = "requested" | "generating" | "ready" | "failed";

export interface AcademyAICourseRequestRow {
  id: string;
  user_id: string;
  topic: string;             // e.g. "Flutter", "Cybersecurity"
  status: AcademyAICourseRequestStatus;
  generated_course_id: string | null; // FK → AcademyCourseRow.id once ready
  requested_at: string;
}

// ── Instructor Marketplace applications ──────────────────────────────────────
// Planned table: academy_instructor_applications
// A user_id applies to become an AcademyInstructorRow; revenue/payout schema
// is intentionally not modeled yet (explicitly out of scope for Phase 3 & 4).

export type AcademyInstructorApplicationStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";

export interface AcademyInstructorApplicationRow {
  id: string;
  user_id: string;           // FK → academy_profiles.user_id
  headline: string;
  bio: string;
  skills: string[];
  status: AcademyInstructorApplicationStatus;
  submitted_at: string | null; // null while status === "draft"

  // ── Phase 4 (Become an Instructor) additions ─────────────────────────────
  experience_years: number;
  expertise: string[];
  languages: string[];
  country: string | null;
  portfolio_url: string | null;
  /** Preparation only — no real ID document upload/verification pipeline yet. */
  identity_verification_status: "not_started" | "submitted" | "verified";
  agreement_accepted: boolean;
  terms_accepted: boolean;
  /** Set by an admin on approve/reject/suspend — see AdminInstructorApplications. */
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
}
