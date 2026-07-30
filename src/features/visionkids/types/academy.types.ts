// ─── VisionKids Academy — domain types ──────────────────────────────────────
// Hand-typed to match the kids_academy_* migrations (20260810*.sql onward) —
// see services/stories/kidsSupabase.ts for why these aren't generated yet.

export type AcademyAgeRange = "3-5" | "6-8" | "9-12" | "13-15";
export type AcademyDifficulty = "easy" | "medium" | "hard";
export type AcademyStatus = "draft" | "published" | "archived";
export type ActivityType = "multiple_choice" | "drag_drop" | "typing" | "speaking" | "listening" | "matching" | "drawing" | "voice_answer";
export type SubmissionStatus = "submitted" | "graded";
export type LessonProgressStatus = "not_started" | "in_progress" | "completed";

export interface Subject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  applicable_age_ranges: AcademyAgeRange[];
  course_count: number;
}

export interface TeacherProfile {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  is_approved: boolean;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  subject_id: string | null;
  age_range: AcademyAgeRange;
  difficulty: AcademyDifficulty;
  thumbnail_url: string | null;
  xp_reward: number;
  coins_reward: number;
  lesson_count: number;
  teacher_id: string | null;
  status: AcademyStatus;
  published_at: string | null;
}

export interface CourseWithSubject extends Course {
  subject: Subject | null;
}

export interface Unit {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
}

export interface Lesson {
  id: string;
  unit_id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  video_url: string | null;
  audio_url: string | null;
  order_index: number;
  estimated_minutes: number;
  xp_reward: number;
  coins_reward: number;
  status: AcademyStatus;
}

export interface LessonActivity {
  id: string;
  lesson_id: string;
  type: ActivityType;
  prompt: string;
  content: Record<string, unknown>;
  order_index: number;
  points: number;
}

export interface Worksheet {
  id: string;
  lesson_id: string | null;
  course_id: string | null;
  title: string;
  file_url: string;
  created_at: string;
}

export interface ProjectTemplate {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  age_range: AcademyAgeRange;
  xp_reward: number;
  coins_reward: number;
}

export interface StudentProject {
  id: string;
  project_id: string;
  user_id: string;
  text_content: string | null;
  file_urls: string[];
  status: SubmissionStatus;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  project?: ProjectTemplate;
}

export interface Homework {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  due_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HomeworkSubmission {
  id: string;
  homework_id: string;
  user_id: string;
  text_answer: string | null;
  file_urls: string[];
  status: SubmissionStatus;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  homework?: Homework;
}

export interface CourseEnrollment {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  course?: Course;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  score: number | null;
  time_spent_seconds: number;
  completed_at: string | null;
  last_accessed_at: string;
  lesson?: Lesson;
}

export interface KidsCertificate {
  id: string;
  user_id: string;
  certificate_type: "course" | "learning_path";
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

export interface CertificateVerification {
  title: string;
  recipient_name: string;
  issuer_name: string;
  certificate_type: string;
  score_percent: number | null;
  issued_at: string;
  verification_code: string;
  signature_hash: string | null;
  is_valid: boolean;
}

export interface ParentChildLink {
  id: string;
  parent_user_id: string;
  child_user_id: string;
  family_id: string | null;
  linked_at: string;
}

export interface AcademyDownload {
  id: string;
  user_id: string;
  lesson_id: string | null;
  worksheet_id: string | null;
  format: "video" | "audio" | "worksheet" | "lesson_text";
  downloaded_at: string;
}

// ── AI recommendations (client-computed heuristic — see services/academy/recommendations.ts) ──
export interface LearningRecommendation {
  kind: "next_lesson" | "review" | "practice";
  lesson: Lesson;
  reason: string;
}
