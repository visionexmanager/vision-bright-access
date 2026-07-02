// ─── Academy — Scholarships Center Service Stubs (Phase 5 architecture prep) ─
// Placeholder implementations — see lib/academy/scholarshipLocalStore.ts for
// the localStorage-backed implementation the UI actually runs against today.

import type { AcademyScholarshipRow } from "@/lib/types/academy-modules";
import type {
  AcademySavedScholarshipRow,
  AcademyScholarshipViewRow,
  AcademyScholarshipReminderRow,
  AcademyScholarshipSuggestionRequestRow,
} from "@/lib/types/academy-scholarship";

export interface ScholarshipFilters {
  query?: string;
  country?: string;
  degree?: string;
  fundingLevel?: string;
  studyField?: string;
  language?: string;
  category?: string;
  sort?: "deadline" | "new" | "funding";
}

// ── Discovery ──────────────────────────────────────────────────────────────────

export async function fetchScholarships(filters: ScholarshipFilters = {}): Promise<AcademyScholarshipRow[]> {
  void filters;
  return [];
}

export async function fetchScholarshipById(id: string): Promise<AcademyScholarshipRow | null> {
  void id;
  return null;
}

// ── Personalization ───────────────────────────────────────────────────────────

export async function fetchSavedScholarships(userId: string): Promise<AcademySavedScholarshipRow[]> {
  void userId;
  return [];
}

export async function toggleSavedScholarship(userId: string, scholarshipId: string): Promise<boolean> {
  void userId;
  void scholarshipId;
  return false;
}

export async function recordScholarshipView(userId: string, scholarshipId: string): Promise<boolean> {
  void userId;
  void scholarshipId;
  return false;
}

export async function fetchRecentlyViewedScholarships(userId: string, limit = 10): Promise<AcademyScholarshipViewRow[]> {
  void userId;
  void limit;
  return [];
}

export async function createDeadlineReminder(
  reminder: Omit<AcademyScholarshipReminderRow, "id" | "created_at">
): Promise<boolean> {
  void reminder;
  return false;
}

export async function fetchDeadlineReminders(userId: string): Promise<AcademyScholarshipReminderRow[]> {
  void userId;
  return [];
}

// ── AI Suggestions (generation out of scope) ──────────────────────────────────

export async function requestScholarshipSuggestions(
  userId: string,
  profileSummary: string
): Promise<AcademyScholarshipSuggestionRequestRow | null> {
  void userId;
  void profileSummary;
  return null;
}

// ── Admin ──────────────────────────────────────────────────────────────────────

export async function createScholarship(scholarship: Partial<AcademyScholarshipRow>): Promise<AcademyScholarshipRow | null> {
  void scholarship;
  return null;
}

export async function updateScholarship(id: string, updates: Partial<AcademyScholarshipRow>): Promise<boolean> {
  void id;
  void updates;
  return false;
}

export async function deleteScholarship(id: string): Promise<boolean> {
  void id;
  return false;
}
