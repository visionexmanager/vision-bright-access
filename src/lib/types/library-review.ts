/**
 * Library — Reviews & Quotes types (Phase 1 architecture prep)
 * Planned tables: library_reviews, library_quotes.
 */

export interface LibraryReviewRow {
  id: string;
  user_id: string;
  book_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
  /** Resolved separately from `profiles` (no direct FK between
   *  library_reviews and profiles for PostgREST to embed) — falls back to
   *  a generic label if the reviewer has no profile row. */
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  /** Whether the *current viewer* has liked this review — always false for
   *  a signed-out viewer or when not resolved (e.g. fetchMyReviews). */
  likedByMe: boolean;
  /** Phase 10 — set by a BEFORE INSERT trigger (trg_set_library_review_
   *  verified_purchase) at review-creation time, never editable afterward. */
  verifiedPurchase: boolean;
  /** Phase 10 — kept distinct from likes_count/the heart button; bumped by
   *  a trigger on library_review_helpful_votes. */
  helpfulCount: number;
  /** Phase 12 — structured pros/cons lists, kept separate from the free-text
   *  `comment` rather than parsed out of it. */
  pros: string[];
  cons: string[];
  /** Phase 12 — the comment is blurred behind a reveal control until the
   *  viewer opts in, distinct from is_spoiler on discussion posts. */
  hasSpoilers: boolean;
}

export interface LibraryQuoteRow {
  id: string;
  book_id: string;
  book_title: string;
  author_name: string;
  text: string;
  like_count: number;
}
