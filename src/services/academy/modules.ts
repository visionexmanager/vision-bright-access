// ─── Academy — Future Module Service Stubs (Phase 1 architecture prep) ───────
// These are placeholder implementations, following the same pattern used for
// Visionex Finance (see src/services/finance/index.ts). Real Supabase-backed
// implementations will be wired in a future phase, once each module's tables
// (see src/lib/types/academy-modules.ts) are actually migrated.
//
// All functions follow the signature contract that the real implementations
// will use, so hooks/components written against this file today don't need
// to change shape later — only the function bodies do.

import type {
  AcademyCourseRow,
  AcademyEnrollmentRow,
  AcademyInstructorRow,
  AcademyStudentServiceRequestRow,
  AcademyStudentServiceType,
  AcademyLearningPathRow,
  AcademyLibraryResourceRow,
  AcademyScholarshipRow,
  AcademyUniversityRow,
  AcademyCommunityPostRow,
  AcademyCertificateRow,
  AcademyAnalyticsEventRow,
  AcademyAnalyticsEventType,
  AcademyNotificationRow,
  AcademyAccessibilityPreferenceRow,
} from "@/lib/types/academy-modules";

// ── Courses ────────────────────────────────────────────────────────────────────

export async function fetchCourses(level?: string): Promise<AcademyCourseRow[]> {
  void level;
  return [];
}

export async function fetchCourse(id: string): Promise<AcademyCourseRow | null> {
  void id;
  return null;
}

export async function fetchEnrollments(userId: string): Promise<AcademyEnrollmentRow[]> {
  void userId;
  return [];
}

// ── Instructors ───────────────────────────────────────────────────────────────

export async function fetchInstructors(): Promise<AcademyInstructorRow[]> {
  return [];
}

export async function fetchInstructor(id: string): Promise<AcademyInstructorRow | null> {
  void id;
  return null;
}

// ── Student Services ─────────────────────────────────────────────────────────

export async function fetchStudentServiceRequests(
  userId: string
): Promise<AcademyStudentServiceRequestRow[]> {
  void userId;
  return [];
}

export async function createStudentServiceRequest(
  userId: string,
  serviceType: AcademyStudentServiceType,
  message: string
): Promise<AcademyStudentServiceRequestRow | null> {
  void userId;
  void serviceType;
  void message;
  return null;
}

// ── AI Learning ───────────────────────────────────────────────────────────────

export async function fetchLearningPaths(userId: string): Promise<AcademyLearningPathRow[]> {
  void userId;
  return [];
}

export async function generateLearningPath(
  userId: string,
  goal: string
): Promise<AcademyLearningPathRow | null> {
  void userId;
  void goal;
  return null;
}

// ── Library ───────────────────────────────────────────────────────────────────

export async function fetchLibraryResources(
  subject?: string,
  level?: string
): Promise<AcademyLibraryResourceRow[]> {
  void subject;
  void level;
  return [];
}

export async function fetchBookmarkedResources(
  userId: string
): Promise<AcademyLibraryResourceRow[]> {
  void userId;
  return [];
}

// ── Scholarships ──────────────────────────────────────────────────────────────

export async function fetchScholarships(country?: string): Promise<AcademyScholarshipRow[]> {
  void country;
  return [];
}

export async function fetchScholarship(id: string): Promise<AcademyScholarshipRow | null> {
  void id;
  return null;
}

// ── Universities ──────────────────────────────────────────────────────────────

export async function fetchUniversities(country?: string): Promise<AcademyUniversityRow[]> {
  void country;
  return [];
}

// ── Community Integration ────────────────────────────────────────────────────

export async function fetchAcademyCommunityPosts(
  roomId: string
): Promise<AcademyCommunityPostRow[]> {
  void roomId;
  return [];
}

// ── Certificates ──────────────────────────────────────────────────────────────

export async function fetchCertificates(userId: string): Promise<AcademyCertificateRow[]> {
  void userId;
  return [];
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function logAnalyticsEvent(
  userId: string,
  eventType: AcademyAnalyticsEventType,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  void userId;
  void eventType;
  void metadata;
  return false;
}

export async function fetchAnalyticsSummary(
  userId: string
): Promise<AcademyAnalyticsEventRow[]> {
  void userId;
  return [];
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function fetchAcademyNotifications(
  userId: string
): Promise<AcademyNotificationRow[]> {
  void userId;
  return [];
}

export async function markAcademyNotificationRead(id: string): Promise<boolean> {
  void id;
  return false;
}

// ── Accessibility ─────────────────────────────────────────────────────────────

export async function fetchAccessibilityPreferences(
  userId: string
): Promise<AcademyAccessibilityPreferenceRow | null> {
  void userId;
  return null;
}

export async function saveAccessibilityPreferences(
  userId: string,
  prefs: Partial<Omit<AcademyAccessibilityPreferenceRow, "user_id" | "updated_at">>
): Promise<boolean> {
  void userId;
  void prefs;
  return false;
}
