/**
 * Academy — Future Module Types (Phase 1 architecture prep)
 *
 * These types describe the PLANNED data shape for each independent Academy
 * module. None of these tables exist yet — no migrations have been written
 * against them. They exist so that Phase 2+ implementation work has a single,
 * reviewed source of truth for shape + relationships instead of inventing
 * schema ad hoc per module.
 *
 * Convention: every row type carries `user_id` (FK → academy_profiles.user_id,
 * which itself FKs → auth.users) so ownership/RLS mirrors the existing
 * academy_profiles / academy_chat_sessions / academy_xp_events tables.
 *
 * Do not import these into running code yet — they are unused until a module
 * is actually implemented.
 */

// ── Courses ──────────────────────────────────────────────────────────────────
// Planned tables: academy_courses, academy_course_modules, academy_enrollments
// academy_enrollments.user_id → academy_profiles.user_id
// academy_course_modules.course_id → academy_courses.id

export type AcademyCourseSource = "visionex" | "marketplace" | "youtube" | "ai";
export type AcademyCourseDifficulty = "beginner" | "intermediate" | "advanced";
/** Richer lifecycle than the legacy `published` boolean below (kept for backward compat — published === status === "published"). */
export type AcademyCourseStatus = "draft" | "published" | "unpublished" | "archived";

export interface AcademyCourseRow {
  id: string;
  title: string;
  description: string;
  /** Target student grade level (ابتدائي/متوسط/...) — distinct from course difficulty below. */
  level: string;           // aligns with AcademyLevel
  subject: string;
  instructor_id: string;   // FK → AcademyInstructorRow.id
  cover_image_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;

  // ── Phase 4 (Course Management) additions ────────────────────────────────
  status: AcademyCourseStatus;
  gallery_urls: string[];

  // ── Phase 3 (LMS) additions ──────────────────────────────────────────────
  source: AcademyCourseSource;
  difficulty: AcademyCourseDifficulty;
  language: string;
  trailer_video_url: string | null;
  /** Only set when source === "youtube": the underlying playlist/video id. */
  youtube_video_id: string | null;
  category: string;
  tags: string[];
  duration_minutes: number;
  is_free: boolean;
  price_vx: number | null;
  rating_avg: number | null;
  rating_count: number;
  students_count: number;
  learning_outcomes: string[];
  requirements: string[];
}

export interface AcademyCourseModuleRow {
  id: string;
  course_id: string;       // FK → AcademyCourseRow.id
  title: string;
  order_index: number;
  content_url: string | null;
}

export interface AcademyEnrollmentRow {
  id: string;
  user_id: string;         // FK → academy_profiles.user_id
  course_id: string;       // FK → AcademyCourseRow.id
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;

  // ── Phase 3 (LMS) additions — resume playback ────────────────────────────
  current_lesson_id: string | null;   // FK → AcademyLessonRow.id (see academy-lms.ts)
  last_position_seconds: number;
}

// ── Instructors ──────────────────────────────────────────────────────────────
// Planned table: academy_instructors

export type AcademyInstructorLevel = "new" | "rising" | "expert" | "master";

export interface AcademyInstructorRow {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  subjects: string[];
  rating: number | null;
  created_at: string;

  // ── Phase 3 (Instructor Marketplace) additions ───────────────────────────
  /** null for VisionEx-staff instructors; set once a marketplace applicant is approved. */
  user_id: string | null;  // FK → academy_profiles.user_id
  headline: string | null;
  social_links: Partial<Record<"website" | "linkedin" | "youtube" | "twitter" | "instagram", string>>;
  skills: string[];
  verified: boolean;
  courses_count: number;
  students_count: number;

  // ── Phase 4 (Instructor Platform) additions ──────────────────────────────
  cover_image_url: string | null;
  expertise: string[];
  languages: string[];
  country: string | null;
  certifications: string[];
  portfolio_url: string | null;
  level: AcademyInstructorLevel;
  /** FK → AcademyOrganizationRow.id (academy-instructor.ts), null for independent instructors. */
  organization_id: string | null;
}

// ── Student Services ─────────────────────────────────────────────────────────
// Planned table: academy_student_service_requests
// user_id → academy_profiles.user_id

export type AcademyStudentServiceType =
  | "tutoring"
  | "counseling"
  | "technical_support"
  | "academic_advising";

export interface AcademyStudentServiceRequestRow {
  id: string;
  user_id: string;
  service_type: AcademyStudentServiceType;
  message: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  resolved_at: string | null;
}

// ── AI Learning ──────────────────────────────────────────────────────────────
// Planned table: academy_learning_paths (distinct from academy_chat_sessions,
// which stays the Munir conversational assistant; this covers structured,
// AI-generated study plans/paths per student).
// user_id → academy_profiles.user_id

export interface AcademyLearningPathRow {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  steps: Array<{ label: string; done: boolean }>;
  generated_at: string;
}

// ── Library ──────────────────────────────────────────────────────────────────
// Planned tables: academy_library_resources, academy_library_bookmarks
// academy_library_bookmarks.user_id → academy_profiles.user_id
// See academy-library.ts for reading progress / notes / highlights / reviews /
// collections / import-batch types layered on top of this row.

export type AcademyLibraryResourceType =
  | "pdf" | "book" | "ebook" | "audiobook"
  | "research_paper" | "scientific_article"
  | "presentation" | "document"
  | "template" | "worksheet" | "study_guide"
  | "exam_collection" | "practice_material"
  | "cheat_sheet" | "infographic";

export type AcademyResourceDifficulty = "beginner" | "intermediate" | "advanced";

export interface AcademyLibraryResourceRow {
  id: string;
  title: string;
  type: AcademyLibraryResourceType;
  subject: string;
  level: string;
  url: string;
  created_at: string;

  // ── Phase 5 (Digital Library) additions ──────────────────────────────────
  description: string;
  category: string;
  language: string;
  author: string | null;
  publisher: string | null;
  publication_date: string | null;
  edition: string | null;
  version: string | null;
  pages: number | null;
  reading_time_minutes: number | null;
  downloads_count: number;
  views_count: number;
  bookmarks_count: number;
  rating_avg: number | null;
  rating_count: number;
  tags: string[];
  difficulty: AcademyResourceDifficulty;
  /** Free-text accessibility notes (e.g. "screen-reader tagged PDF", "captions included"). */
  accessibility_info: string | null;
  cover_image_url: string | null;
  /** Set when imported from an external catalog/API — see AcademyResourceImportBatchRow. */
  external_source: string | null;
  external_id: string | null;
}

export interface AcademyLibraryBookmarkRow {
  id: string;
  user_id: string;
  resource_id: string;     // FK → AcademyLibraryResourceRow.id
  created_at: string;
}

// ── Scholarships ─────────────────────────────────────────────────────────────
// Planned tables: academy_scholarships, academy_scholarship_applications
// academy_scholarship_applications.user_id → academy_profiles.user_id
// See academy-scholarship.ts for saved/favorite/reminder types.

export type AcademyScholarshipCategory =
  | "government" | "university" | "private" | "research_grant"
  | "exchange_program" | "international" | "local" | "online";

export type AcademyScholarshipFundingLevel = "full" | "partial" | "tuition_only" | "stipend_only";
export type AcademyScholarshipStatus = "open" | "closing_soon" | "closed" | "upcoming";

export interface AcademyScholarshipRow {
  id: string;
  title: string;
  provider: string;
  country: string;
  amount: string | null;
  deadline: string | null;
  url: string | null;

  // ── Phase 5 (Scholarships Center) additions ──────────────────────────────
  category: AcademyScholarshipCategory;
  university: string | null;
  degree: string | null;
  funding_level: AcademyScholarshipFundingLevel;
  eligibility: string[];
  required_documents: string[];
  application_process: string | null;
  /** Preparation only — no outbound application submission pipeline yet. */
  website_url: string | null;
  contact_email: string | null;
  status: AcademyScholarshipStatus;
  language: string;
  study_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface AcademyScholarshipApplicationRow {
  id: string;
  user_id: string;
  scholarship_id: string;  // FK → AcademyScholarshipRow.id
  status: "draft" | "submitted" | "accepted" | "rejected";
  submitted_at: string | null;
}

// ── Universities ─────────────────────────────────────────────────────────────
// Planned table: academy_universities
// See academy-university.ts for reviews/favorites types.

export interface AcademyUniversityRow {
  id: string;
  name: string;
  country: string;
  city: string | null;
  programs: string[];
  website_url: string | null;

  // ── Phase 5 (Universities Directory) additions ───────────────────────────
  logo_url: string | null;
  image_urls: string[];
  description: string | null;
  /** Preparation only — no live ranking feed integrated yet. */
  ranking_global: number | null;
  ranking_national: number | null;
  degrees_offered: string[];
  faculties: string[];
  admission_requirements: string | null;
  tuition_fee_range: string | null;
  has_scholarships: boolean;
  languages_of_instruction: string[];
  international_students_percent: number | null;
  student_life_description: string | null;
  facilities: string[];
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

// ── Community Integration ────────────────────────────────────────────────────
// Reuses the existing `community` rooms (see queryKeys.community) as the
// transport; this type is the Academy-scoped post shape layered on top.
// user_id → academy_profiles.user_id

export interface AcademyCommunityPostRow {
  id: string;
  user_id: string;
  room_id: string;          // FK → existing community room id
  content: string;
  created_at: string;
}

// ── Certificates ─────────────────────────────────────────────────────────────
// Planned table: academy_certificates
// user_id → academy_profiles.user_id

export type AcademyCertificateStatus = "valid" | "revoked";

export interface AcademyCertificateRow {
  id: string;
  user_id: string;
  course_id: string | null; // FK → AcademyCourseRow.id, nullable for non-course achievements
  title: string;
  issued_at: string;
  certificate_url: string | null;

  // ── Phase 6 (Certificates System) additions ──────────────────────────────
  /** Short, human-shareable identifier (e.g. "VX-2026-A3F9K2") — distinct from the internal `id`. */
  certificate_number: string;
  student_name: string;
  course_name: string;
  instructor_name: string;
  completion_date: string;
  skills: string[];
  /** Public verification page URL — see AcademyCertificateVerify.tsx. */
  verification_url: string;
  /** Preparation only — actual QR image is rendered client-side from verification_url, not stored. */
  qr_code_data: string;
  signature_name: string;
  signature_image_url: string | null;
  template_id: string;
  status: AcademyCertificateStatus;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
// Planned table: academy_analytics_events — append-only, mirrors the shape of
// the existing academy_xp_events table.
// user_id → academy_profiles.user_id

export type AcademyAnalyticsEventType =
  | "course_view"
  | "lesson_complete"
  | "quiz_attempt"
  | "chat_session"
  | "resource_download";

export interface AcademyAnalyticsEventRow {
  id: string;
  user_id: string;
  event_type: AcademyAnalyticsEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────
// Planned table: academy_notifications (Academy-scoped; distinct from the
// app-wide `notifications` table already used elsewhere in the platform).
// user_id → academy_profiles.user_id

export type AcademyNotificationType =
  | "new_course"
  | "assignment_due"
  | "certificate_issued"
  | "xp_milestone"
  | "message";

export interface AcademyNotificationRow {
  id: string;
  user_id: string;
  type: AcademyNotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

// ── Accessibility ─────────────────────────────────────────────────────────────
// Planned table: academy_accessibility_preferences — one row per student,
// separate from academy_profiles so accessibility settings can evolve
// independently of onboarding data.
// user_id → academy_profiles.user_id (1:1)

export interface AcademyAccessibilityPreferenceRow {
  user_id: string;
  reduce_motion: boolean;
  high_contrast: boolean;
  text_to_speech_rate: number;
  preferred_font_scale: number;
  updated_at: string;
}
