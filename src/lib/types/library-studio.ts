/**
 * Library — Author Publishing Studio types (Phase 9)
 *
 * Shapes mirror the real Supabase rows added/extended in
 * supabase/migrations/20260728000000_library_publishing_studio.sql. Distinct
 * from library-book.ts's reader-facing LibraryBookRow — these are the
 * author-side/write-side shapes (collaboration, workflow, pricing,
 * versioning, comments/suggestions).
 */

/** Matches library_books.publish_status's widened CHECK constraint exactly. */
export type LibraryPublishStatus = "draft" | "review" | "approved" | "published" | "scheduled" | "archived" | "rejected";

/** The spec's "Book Types" — matches library_books.content_format's CHECK. */
export type LibraryContentFormat =
  | "novel" | "educational" | "scientific" | "research" | "magazine" | "comic"
  | "children" | "cookbook" | "documentation" | "manual" | "interactive" | "audiobook";

export type LibraryLicenseType = "creative_commons" | "copyright" | "public_domain" | "custom";
export type LibraryAgeRating = "all" | "7+" | "12+" | "16+" | "18+";
export type LibraryPricingModel = "free" | "paid" | "subscription" | "rental" | "donation" | "bundle";

/** Studio-only extension fields on library_books — combine with
 *  LibraryBookRow (library-book.ts) for the full author-facing row. */
export interface LibraryStudioBookFields {
  edition: string | null;
  license_type: LibraryLicenseType;
  license_details: string | null;
  age_rating: LibraryAgeRating;
  content_format: LibraryContentFormat | null;
  trailer_video_url: string | null;
  pricing_model: LibraryPricingModel;
  rental_price_usd: number | null;
  rental_price_vx: number | null;
  rental_period_days: number | null;
  suggested_donation_usd: number | null;
  scheduled_publish_at: string | null;
  review_note: string | null;
  publish_status: LibraryPublishStatus;
}

export interface LibraryBookGalleryRow {
  id: string;
  book_id: string;
  media_type: "image" | "video";
  url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

/** Mirrors library_book_collaborators exactly. */
export type LibraryCollaboratorRole = "owner" | "editor" | "proofreader" | "translator" | "designer" | "reviewer";
export type LibraryCollaboratorStatus = "invited" | "active" | "revoked";

export interface LibraryBookCollaboratorRow {
  id: string;
  book_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: LibraryCollaboratorRole;
  status: LibraryCollaboratorStatus;
  invited_by: string;
  created_at: string;
  updated_at: string;
  /** Resolved separately from profiles for display — same pattern as
   *  LibraryReviewRow.reviewerName in library-review.ts. */
  displayName?: string;
  avatarUrl?: string | null;
}

/** Mirrors library_book_comments exactly. */
export interface LibraryBookCommentRow {
  id: string;
  book_id: string;
  chapter_id: string | null;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  anchor: { from: number; to: number } | null;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
}

/** Mirrors library_book_versions exactly. */
export interface LibraryBookVersionRow {
  id: string;
  book_id: string;
  chapter_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
  is_autosave: boolean;
  version_note: string | null;
  created_by: string;
  created_at: string;
}

/** Mirrors library_book_suggestions exactly. */
export interface LibraryBookSuggestionRow {
  id: string;
  book_id: string;
  chapter_id: string;
  suggested_by: string;
  base_version_id: string | null;
  suggested_content: Record<string, unknown>;
  note: string | null;
  status: "pending" | "accepted" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  suggesterName?: string;
}

/** Mirrors library_coupons — never fetched directly client-side except by
 *  the owning author managing their own coupons (see services/library/
 *  pricing.ts); shoppers redeem by code through the checkout edge function. */
export interface LibraryCouponRow {
  id: string;
  code: string;
  book_id: string | null;
  discount_type: "percent" | "fixed_usd" | "fixed_vx";
  discount_value: number;
  max_redemptions: number | null;
  redemptions_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LibraryRegionalPriceRow {
  book_id: string;
  country_code: string;
  price_usd: number;
  price_vx: number | null;
}

export interface LibraryBundleRow {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  price_usd: number | null;
  price_vx: number | null;
  is_active: boolean;
  created_at: string;
  bookIds?: string[];
}

export interface LibrarySubscriptionRow {
  id: string;
  user_id: string;
  plan: "monthly" | "yearly";
  status: "active" | "cancelled" | "expired";
  current_period_end: string;
  stripe_subscription_id: string | null;
}

export interface LibraryDonationRow {
  id: string;
  book_id: string;
  donor_id: string | null;
  amount_usd: number | null;
  amount_vx: number | null;
  message: string | null;
  created_at: string;
}

/** The signed-in user's own library_authors row — richer than the public-
 *  facing LibraryAuthorRow (library-author.ts), which omits user_id/slug/
 *  contact fields nobody but the owner needs. */
export interface LibraryOwnAuthorProfile {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
}

/** Author Dashboard's top-line stat tiles. */
export interface AuthorDashboardStats {
  totalBooks: number;
  publishedBooks: number;
  drafts: number;
  pendingReview: number;
  totalReads: number;
  totalDownloads: number;
  followers: number;
  revenueUsd: number;
  revenueVx: number;
  ratingAvg: number | null;
  totalReviews: number;
}

/** One point in the dashboard's monthly-trend chart (recharts input). */
export interface AuthorMonthlyStatPoint {
  month: string; // "2026-01"
  reads: number;
  downloads: number;
  revenueUsd: number;
}

/** One row of the extended per-book analytics — used by the Studio
 *  Analytics page's charts. Mirrors library_book_daily_stats' extended
 *  columns + library_book_daily_dimension_stats aggregated client-side. */
export interface StudioBookAnalyticsSummary {
  readers: number;
  downloads: number;
  readingMinutes: number;
  completionRate: number; // reading_sessions_completed / reading_sessions_started, 0-100
  revenueUsd: number;
  revenueVx: number;
  countries: Array<{ value: string; count: number }>;
  devices: Array<{ value: string; count: number }>;
  trafficSources: Array<{ value: string; count: number }>;
  dailySeries: Array<{ date: string; readers: number; downloads: number; revenueUsd: number }>;
}
