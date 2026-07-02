/**
 * Academy — Instructor Platform Types (Phase 4 architecture prep)
 *
 * Extends the instructor/course scaffolding from Phase 1 & 3 (academy-modules.ts
 * owns AcademyInstructorRow / AcademyCourseRow; academy-lms.ts owns
 * AcademyLessonRow / AcademyInstructorApplicationRow) with the organization,
 * communication, and analytics types needed for a full instructor platform.
 *
 * None of these tables exist yet. Payment processing, revenue distribution,
 * live streaming, and video hosting are explicitly NOT modeled here — those
 * remain out of scope until a dedicated phase authorizes them.
 */

// ── Organizations (training centers, universities, companies) ───────────────
// Planned table: academy_organizations
// AcademyInstructorRow.organization_id (academy-modules.ts) → AcademyOrganizationRow.id

export type AcademyOrganizationType = "training_center" | "university" | "company" | "other";

export interface AcademyOrganizationRow {
  id: string;
  name: string;
  type: AcademyOrganizationType;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  /** The user who administers this organization's instructor roster. */
  owner_user_id: string;     // FK → academy_profiles.user_id
  instructor_ids: string[];  // FK list → AcademyInstructorRow.id
  verified: boolean;
  created_at: string;
}

// ── Announcements ─────────────────────────────────────────────────────────────
// Planned table: academy_course_announcements
// instructor_id → AcademyInstructorRow.id, course_id null = broadcast to all of the instructor's students

export interface AcademyAnnouncementRow {
  id: string;
  instructor_id: string;
  course_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
}

// ── Discussions / Q&A ─────────────────────────────────────────────────────────
// Planned tables: academy_lesson_questions, academy_lesson_answers
// user_id → academy_profiles.user_id, lesson_id → AcademyLessonRow.id (academy-lms.ts)

export interface AcademyLessonQuestionRow {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  body: string;
  created_at: string;
}

export interface AcademyLessonAnswerRow {
  id: string;
  question_id: string;       // FK → AcademyLessonQuestionRow.id
  /** null when a fellow student answers; set to the instructor's user_id for official answers. */
  instructor_id: string | null;
  user_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
}

// ── Review moderation ──────────────────────────────────────────────────────────
// Planned tables: academy_course_review_replies, academy_review_reports
// review_id → AcademyCourseReviewRow.id (academy-lms.ts)

export interface AcademyCourseReviewReplyRow {
  id: string;
  review_id: string;
  instructor_id: string;
  body: string;
  created_at: string;
}

export interface AcademyReviewHelpfulVoteRow {
  review_id: string;
  user_id: string;
  created_at: string;
}

export type AcademyReviewReportReason = "spam" | "abusive" | "off_topic" | "other";
export type AcademyReviewReportStatus = "pending" | "reviewed" | "dismissed";

export interface AcademyReviewReportRow {
  id: string;
  review_id: string;
  reporter_user_id: string;
  reason: AcademyReviewReportReason;
  note: string | null;
  status: AcademyReviewReportStatus;
  created_at: string;
}

// ── Instructor Analytics ──────────────────────────────────────────────────────
// Planned table: academy_instructor_analytics_snapshots (materialized, refreshed
// periodically). Watch-time/drop-off/traffic-source require real playback
// telemetry that doesn't exist yet — those fields are modeled but intentionally
// left null/empty until a telemetry pipeline lands.

export interface AcademyInstructorAnalyticsSnapshot {
  instructor_id: string;
  students_enrolled: number;
  courses_published: number;
  rating_avg: number | null;
  rating_count: number;
  /** completed_lessons / total_lessons across all the instructor's courses, 0–100. */
  avg_completion_percent: number;
  /** lesson_id -> view count. Populated once real telemetry exists; empty for now. */
  popular_lesson_ids: string[];
  /** Requires playback telemetry — intentionally unimplemented (Phase 4 scope). */
  avg_watch_time_minutes: number | null;
  drop_off_lesson_ids: string[];
  traffic_sources: Record<string, number>;
  generated_at: string;
}
