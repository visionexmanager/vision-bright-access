// ─── Academy — Universities Directory Service Stubs (Phase 5 architecture) ───
// Placeholder implementations — see lib/academy/universityLocalStore.ts for
// the localStorage-backed implementation the UI actually runs against today.

import type { AcademyUniversityRow } from "@/lib/types/academy-modules";
import type {
  AcademyUniversityReviewRow,
  AcademyFavoriteUniversityRow,
  AcademyUniversityViewRow,
} from "@/lib/types/academy-university";

export interface UniversityFilters {
  query?: string;
  country?: string;
  program?: string;
  sort?: "ranking" | "name" | "new";
}

// ── Discovery ──────────────────────────────────────────────────────────────────

export async function fetchUniversities(filters: UniversityFilters = {}): Promise<AcademyUniversityRow[]> {
  void filters;
  return [];
}

export async function fetchUniversityById(id: string): Promise<AcademyUniversityRow | null> {
  void id;
  return null;
}

export async function fetchRecommendedUniversities(userId: string, limit = 4): Promise<AcademyUniversityRow[]> {
  void userId;
  void limit;
  return [];
}

// ── Personalization ───────────────────────────────────────────────────────────

export async function fetchFavoriteUniversities(userId: string): Promise<AcademyFavoriteUniversityRow[]> {
  void userId;
  return [];
}

export async function toggleFavoriteUniversity(userId: string, universityId: string): Promise<boolean> {
  void userId;
  void universityId;
  return false;
}

export async function recordUniversityView(userId: string, universityId: string): Promise<boolean> {
  void userId;
  void universityId;
  return false;
}

export async function fetchRecentlyViewedUniversities(userId: string, limit = 10): Promise<AcademyUniversityViewRow[]> {
  void userId;
  void limit;
  return [];
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export async function fetchUniversityReviews(universityId: string): Promise<AcademyUniversityReviewRow[]> {
  void universityId;
  return [];
}

export async function submitUniversityReview(
  review: Omit<AcademyUniversityReviewRow, "id" | "created_at">
): Promise<AcademyUniversityReviewRow | null> {
  void review;
  return null;
}

// ── Admin ──────────────────────────────────────────────────────────────────────

export async function createUniversity(university: Partial<AcademyUniversityRow>): Promise<AcademyUniversityRow | null> {
  void university;
  return null;
}

export async function updateUniversity(id: string, updates: Partial<AcademyUniversityRow>): Promise<boolean> {
  void id;
  void updates;
  return false;
}

export async function deleteUniversity(id: string): Promise<boolean> {
  void id;
  return false;
}
