/**
 * Academy — Universities Directory Types (Phase 5 architecture prep)
 * Extends AcademyUniversityRow (academy-modules.ts). No hardcoded university
 * data ships with this phase — see lib/academy/universityLocalStore.ts.
 */

// ── Reviews / Favorites / Recently Viewed ─────────────────────────────────────
// Planned tables: academy_university_reviews, academy_favorite_universities,
// academy_university_views. FK user_id → academy_profiles.user_id,
// university_id → AcademyUniversityRow.id (academy-modules.ts)

export interface AcademyUniversityReviewRow {
  id: string;
  user_id: string;
  university_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  created_at: string;
}

export interface AcademyFavoriteUniversityRow {
  user_id: string;
  university_id: string;
  created_at: string;
}

export interface AcademyUniversityViewRow {
  user_id: string;
  university_id: string;
  viewed_at: string;
}

// ── Compare ────────────────────────────────────────────────────────────────────
// Comparison is a client-side/session concern (pick N universities, view a
// side-by-side table) — no dedicated table needed; this type documents the
// shape the compare UI works with.

export interface AcademyUniversityComparisonSelection {
  university_ids: string[]; // max 4, enforced client-side
}
