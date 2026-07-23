/**
 * Library — Home page types (Phase 3)
 * Shapes for the new Phase 2 tables/RPCs the home page surfaces that had no
 * frontend type yet: home stats, reading challenges, recommendations.
 */

export interface LibraryHomeStats {
  total_books: number;
  total_authors: number;
  total_readers: number;
  total_reviews: number;
  total_categories: number;
  total_audiobooks: number;
  total_pages: number;
}

export type LibraryChallengeGoalType = "books_count" | "pages_count" | "minutes_read" | "listening_minutes";
/** Phase 12 — who created/owns the challenge. */
export type LibraryChallengeScope = "admin" | "community" | "custom";
export type LibraryChallengeCadence = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export interface LibraryChallengeRow {
  id: string;
  title: string;
  description: string | null;
  goal_type: LibraryChallengeGoalType;
  goal_target: number;
  starts_at: string | null;
  ends_at: string | null;
  reward_vx: number;
  is_active: boolean;
  /** Phase 12 additions — default to "admin"/"custom" for pre-Phase-12 rows
   *  read through this same type. */
  scope: LibraryChallengeScope;
  cadence: LibraryChallengeCadence;
  created_by: string | null;
  category_id: string | null;
  author_id: string | null;
  participant_count: number;
}

export interface LibraryChallengeProgressRow {
  challenge_id: string;
  current_value: number;
  completed_at: string | null;
}

export interface LibraryChallengeWithProgress extends LibraryChallengeRow {
  progress: LibraryChallengeProgressRow | null;
}
