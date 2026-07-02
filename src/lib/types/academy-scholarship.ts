/**
 * Academy — Scholarships Center Types (Phase 5 architecture prep)
 * Extends AcademyScholarshipRow (academy-modules.ts). No hardcoded scholarship
 * data ships with this phase — see lib/academy/scholarshipLocalStore.ts.
 */

// ── Saved / Favorites / Recently Viewed / Reminders ──────────────────────────
// Planned tables: academy_saved_scholarships, academy_scholarship_views,
// academy_scholarship_reminders. FK user_id → academy_profiles.user_id,
// scholarship_id → AcademyScholarshipRow.id (academy-modules.ts)

export interface AcademySavedScholarshipRow {
  user_id: string;
  scholarship_id: string;
  created_at: string;
}

export interface AcademyScholarshipViewRow {
  user_id: string;
  scholarship_id: string;
  viewed_at: string;
}

export interface AcademyScholarshipReminderRow {
  id: string;
  user_id: string;
  scholarship_id: string;
  /** Days before the deadline to remind — actual delivery (email/push) is a future phase. */
  remind_days_before: number;
  created_at: string;
}

// ── AI Suggestions ─────────────────────────────────────────────────────────────
// Generation out of scope for Phase 5 — mirrors the AcademyAICourseRequestRow
// lifecycle pattern (academy-lms.ts) so the UI can show an honest queued state.

export type AcademyScholarshipSuggestionStatus = "requested" | "generating" | "ready";

export interface AcademyScholarshipSuggestionRequestRow {
  id: string;
  user_id: string;
  /** Free-text profile summary used to derive suggestions (field of study, country, etc). */
  profile_summary: string;
  status: AcademyScholarshipSuggestionStatus;
  suggested_scholarship_ids: string[];
  requested_at: string;
}
