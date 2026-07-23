/**
 * Library — Book Marketplace types (Phase 10)
 *
 * Shapes mirror the real Supabase rows added in
 * supabase/migrations/20260729000000_library_marketplace.sql.
 */

export type LibraryCollectionType = "editors_choice" | "staff_pick" | "award_winner" | "seasonal" | "curated";

export interface LibraryCollectionRow {
  id: string;
  collection_type: LibraryCollectionType;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  display_order: number;
}

export interface LibrarySeriesRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  author_id: string | null;
}

export interface LibraryBookAwardRow {
  id: string;
  book_id: string;
  name: string;
  awarding_body: string | null;
  year: number | null;
  rank: string | null;
  icon_url: string | null;
}

export interface LibraryWishlistItem {
  user_id: string;
  book_id: string;
  note: string | null;
  created_at: string;
}

export type LibraryLicenseType = "individual" | "corporate" | "educational" | "family";

export interface LibraryLicenseRow {
  id: string;
  book_id: string;
  purchaser_id: string;
  license_type: LibraryLicenseType;
  seat_count: number;
  created_at: string;
}

export interface LibraryLicenseSeatRow {
  license_id: string;
  user_id: string | null;
  invited_email: string | null;
  status: "invited" | "active" | "revoked";
}

export interface LibraryPublisherProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  bio: string | null;
  banner_url: string | null;
  social_links: Record<string, string>;
  follower_count: number;
}

export interface LibraryReviewMediaRow {
  id: string;
  review_id: string;
  media_type: "image" | "video";
  url: string;
  display_order: number;
}

export interface LibraryAchievementRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  reward_vx: number;
}

export interface LibraryDailyRewardClaimResult {
  streak_day: number;
  vx_awarded: number;
}

export interface LibraryReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_granted: boolean;
  created_at: string;
}
