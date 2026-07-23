// Learning Hub types — mirrors supabase/migrations/20260802000000_library_learning_hub.sql

export type LibraryLearningPathLevel = "beginner" | "intermediate" | "advanced" | "professional" | "certification" | "custom";

export interface LibraryLearningPathRow {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  level: LibraryLearningPathLevel;
  is_adaptive: boolean;
  is_certification_track: boolean;
  estimated_minutes: number | null;
  is_published: boolean;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LibraryLearningPathItemType = "book" | "academy_course" | "quiz";

export interface LibraryLearningPathItemRow {
  id: string;
  path_id: string;
  item_type: LibraryLearningPathItemType;
  book_id: string | null;
  academy_course_id: string | null;
  quiz_id: string | null;
  title_override: string | null;
  order_index: number;
  is_required: boolean;
  estimated_minutes: number | null;
  is_remedial: boolean;
  remedial_for_item_id: string | null;
  remedial_threshold_percent: number;
  created_at: string;
}

export interface LibraryLearningPathEnrollmentRow {
  id: string;
  user_id: string;
  path_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percent: number;
}

export interface LibraryLearningPathProgressItem {
  item_id: string;
  item_type: LibraryLearningPathItemType;
  title: string;
  order_index: number;
  is_required: boolean;
  is_remedial: boolean;
  is_skipped: boolean;
  is_unlocked: boolean;
  completed: boolean;
  completed_at: string | null;
  score_percent: number | null;
}

// ── Book to Course ─────────────────────────────────────────────────────────

export interface LibraryBookCourseRow {
  id: string;
  book_id: string;
  academy_course_id: string;
  created_by: string;
  created_at: string;
}

export interface LibraryCourseLearningObjectiveRow {
  id: string;
  academy_course_id: string;
  chapter_id: string | null;
  objective_text: string;
  order_index: number;
}

// ── Smart Notes ─────────────────────────────────────────────────────────────

export type LibraryNoteType = "text" | "voice" | "image";

export interface LibraryNotebookRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  order_index: number;
  created_at: string;
}

export interface LibrarySmartNoteRow {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number | null;
  content: string;
  note_type: LibraryNoteType;
  voice_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
  tags: string[];
  notebook_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Flashcards (Learning Hub structured system) ─────────────────────────────

export type LibraryFlashcardDifficulty = "easy" | "medium" | "hard";
export type LibraryFlashcardSource = "manual" | "ai";

export interface LibraryFlashcardDeckRow {
  id: string;
  user_id: string;
  book_id: string | null;
  chapter_id: string | null;
  learning_path_id: string | null;
  title: string;
  description: string | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface LibraryStudyFlashcardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  image_url: string | null;
  audio_url: string | null;
  difficulty: LibraryFlashcardDifficulty;
  source: LibraryFlashcardSource;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  due_at: string;
  last_reviewed_at: string | null;
  order_index: number;
  created_at: string;
}

export interface LibraryFlashcardStudySessionRow {
  id: string;
  user_id: string;
  deck_id: string;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  cards_correct: number;
}

// ── Quizzes (Learning Hub structured system) ────────────────────────────────

export type LibraryQuizScopeType = "book" | "chapter" | "course_lesson" | "learning_path" | "custom";
export type LibraryQuizQuestionType = "multiple_choice" | "true_false" | "short_answer" | "matching" | "fill_blank" | "essay";
export type LibraryQuizDifficulty = "easy" | "medium" | "hard";

export interface LibraryQuizRow {
  id: string;
  scope_type: LibraryQuizScopeType;
  book_id: string | null;
  chapter_id: string | null;
  academy_lesson_id: string | null;
  learning_path_item_id: string | null;
  title: string;
  description: string | null;
  is_timed: boolean;
  time_limit_minutes: number | null;
  passing_score_percent: number;
  is_adaptive_difficulty: boolean;
  created_by: string;
  created_at: string;
}

/** Returned by get_library_quiz_for_attempt() — withholds correct_answer/explanation. */
export interface LibraryQuizAttemptQuestion {
  id: string;
  question_type: LibraryQuizQuestionType;
  question_text: string;
  options: unknown;
  difficulty: LibraryQuizDifficulty;
  topic: string | null;
  points: number;
  order_index: number;
}

export interface LibraryQuizAttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  submitted_at: string | null;
  score_percent: number | null;
  time_spent_seconds: number | null;
  answers: Record<string, unknown>;
  passed: boolean | null;
  needs_manual_grading: boolean;
}

/** One row per question, returned by submit_library_quiz_attempt() —
 *  score_percent/passed are the attempt's overall result, repeated on every
 *  row (there is one submission per attempt, not per question). */
export interface LibraryQuizSubmitResultRow {
  question_id: string;
  is_correct: boolean | null;
  correct_answer: unknown;
  explanation: string | null;
  score_percent: number;
  passed: boolean;
  needs_manual_grading: boolean;
}

export interface LibraryWeakTopic {
  topic: string;
  accuracy_percent: number;
  attempts_count: number;
}

// ── Certificates ─────────────────────────────────────────────────────────────

export type LibraryCertificateType = "learning_path" | "course" | "exam" | "reading_challenge" | "skill_mastery";

export interface LibraryCertificateRow {
  id: string;
  user_id: string;
  certificate_type: LibraryCertificateType;
  reference_id: string;
  title: string;
  recipient_name: string;
  issuer_name: string;
  score_percent: number | null;
  certificate_number: string;
  verification_code: string;
  signature_hash: string | null;
  issued_at: string;
}

export interface LibraryCertificateVerification {
  title: string;
  recipient_name: string;
  issuer_name: string;
  certificate_type: LibraryCertificateType;
  score_percent: number | null;
  issued_at: string;
  verification_code: string;
  signature_hash: string | null;
  is_valid: boolean;
}

// ── Group Learning ────────────────────────────────────────────────────────────

export interface LibraryGroupSharedNoteRow {
  id: string;
  club_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryGroupAssignmentRow {
  id: string;
  club_id: string;
  created_by: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
}

export interface LibraryGroupAssignmentSubmissionRow {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
}

export interface LibraryGroupPeerReviewRow {
  id: string;
  submission_id: string;
  reviewer_id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
}

export interface LibraryGroupTeacherFeedbackRow {
  id: string;
  submission_id: string;
  instructor_id: string;
  feedback: string;
  grade: string | null;
  created_at: string;
}

// ── Academy Integration ────────────────────────────────────────────────────────

export interface LibraryAcademyCourseBookRow {
  id: string;
  academy_course_id: string;
  book_id: string;
  is_required: boolean;
  order_index: number;
}

export interface LibraryInstructorBookRecommendationRow {
  id: string;
  instructor_id: string;
  book_id: string;
  note: string | null;
  created_at: string;
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface LibraryLearningAnalytics {
  reading_speed_wpm: number;
  avg_quiz_score_percent: number | null;
  study_time_minutes: number;
  knowledge_retention_percent: number | null;
  flashcards_due: number;
  quizzes_taken: number;
  current_streak: number;
}
