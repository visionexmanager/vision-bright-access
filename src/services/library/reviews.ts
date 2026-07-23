// ─── Library — Reviews Service (Phase 3: real Supabase backend; Phase 5:
// write/edit/delete + likes) ───────────────────────────────────────────────
// Real queries against library_reviews (20260720000001_library_core_
// engagement.sql) and library_review_likes (20260723000000_library_book_
// details_support.sql). RLS: reviews are public-read, so fetchReviewsForBook
// works for any caller; write/update/delete are owner-only (enforced by RLS,
// mirrored client-side only for UX).
//
// Reviewer display name/avatar come from `profiles`, resolved as a separate
// query — library_reviews.user_id references auth.users, not profiles
// directly, so PostgREST can't embed it (no FK between the two tables).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryReviewRow } from "@/lib/types/library-review";

const REVIEW_SELECT = "id, user_id, book_id, rating, comment, likes_count, created_at, updated_at, verified_purchase, helpful_count, pros, cons, has_spoilers";

type RawReview = {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  comment: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
  verified_purchase: boolean;
  helpful_count: number;
  pros: string[] | null;
  cons: string[] | null;
  has_spoilers: boolean;
};

export type LibraryReviewSort = "newest" | "highestRating" | "lowestRating" | "mostHelpful";

async function resolveReviewerProfiles(userIds: string[]): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const map = new Map<string, { name: string; avatarUrl: string | null }>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", uniqueIds);
  if (error) {
    console.warn("Failed to resolve reviewer profiles:", error.message);
    return map;
  }
  for (const p of data ?? []) {
    map.set(p.user_id, { name: p.display_name ?? "Reader", avatarUrl: p.avatar_url ?? null });
  }
  return map;
}

async function resolveMyLikedReviewIds(reviewIds: string[], viewerId: string | undefined): Promise<Set<string>> {
  if (!viewerId || reviewIds.length === 0) return new Set();
  const { data, error } = await supabase.from("library_review_likes").select("review_id").eq("user_id", viewerId).in("review_id", reviewIds);
  if (error) {
    console.warn("Failed to resolve my liked reviews:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.review_id));
}

function mapReview(row: RawReview, profiles: Map<string, { name: string; avatarUrl: string | null }>, likedIds: Set<string>): LibraryReviewRow {
  const profile = profiles.get(row.user_id);
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    rating: row.rating as 1 | 2 | 3 | 4 | 5,
    comment: row.comment,
    likes_count: row.likes_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reviewerName: profile?.name ?? "Reader",
    reviewerAvatarUrl: profile?.avatarUrl ?? null,
    likedByMe: likedIds.has(row.id),
    verifiedPurchase: row.verified_purchase,
    helpfulCount: row.helpful_count,
    pros: row.pros ?? [],
    cons: row.cons ?? [],
    hasSpoilers: row.has_spoilers,
  };
}

/** All reviews for a book. `viewerId` (optional) resolves `likedByMe` for
 *  the signed-in viewer; omit for a signed-out read. `sort` defaults to
 *  newest-first (the original, unchanged behavior). */
export async function fetchReviewsForBook(bookId: string, viewerId?: string, sort: LibraryReviewSort = "newest"): Promise<LibraryReviewRow[]> {
  let query = supabase.from("library_reviews").select(REVIEW_SELECT).eq("book_id", bookId);
  switch (sort) {
    case "highestRating":
      query = query.order("rating", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "lowestRating":
      query = query.order("rating", { ascending: true }).order("created_at", { ascending: false });
      break;
    case "mostHelpful":
      query = query.order("helpful_count", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawReview[];
  if (rows.length === 0) return [];

  const [profiles, likedIds] = await Promise.all([
    resolveReviewerProfiles(rows.map((r) => r.user_id)),
    resolveMyLikedReviewIds(rows.map((r) => r.id), viewerId),
  ]);
  return rows.map((row) => mapReview(row, profiles, likedIds));
}

/** The signed-in viewer's own review for a book, if any — powers the
 *  write/edit form defaulting to "edit" mode when one already exists. */
export async function fetchMyReviewForBook(bookId: string, userId: string): Promise<LibraryReviewRow | null> {
  const { data, error } = await supabase.from("library_reviews").select(REVIEW_SELECT).eq("book_id", bookId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const profiles = await resolveReviewerProfiles([userId]);
  return mapReview(data as RawReview, profiles, new Set());
}

export async function fetchMyReviews(userId: string): Promise<LibraryReviewRow[]> {
  const { data, error } = await supabase.from("library_reviews").select(REVIEW_SELECT).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawReview[];
  if (rows.length === 0) return [];
  const profiles = await resolveReviewerProfiles([userId]);
  return rows.map((row) => mapReview(row, profiles, new Set()));
}

export interface LibraryReviewInput {
  pros: string[];
  cons: string[];
  hasSpoilers: boolean;
}

export async function createReview(userId: string, bookId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string | null, extra: LibraryReviewInput): Promise<void> {
  const { error } = await supabase.from("library_reviews").insert({
    user_id: userId, book_id: bookId, rating, comment: comment?.trim() || null,
    pros: extra.pros, cons: extra.cons, has_spoilers: extra.hasSpoilers,
  });
  if (error) throw new Error(error.message);
}

export async function updateReview(reviewId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string | null, extra: LibraryReviewInput): Promise<void> {
  const { error } = await supabase.from("library_reviews").update({
    rating, comment: comment?.trim() || null,
    pros: extra.pros, cons: extra.cons, has_spoilers: extra.hasSpoilers,
  }).eq("id", reviewId);
  if (error) throw new Error(error.message);
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from("library_reviews").delete().eq("id", reviewId);
  if (error) throw new Error(error.message);
}

/** Toggles the *signed-in viewer's* like on a review — the recompute
 *  trigger on library_review_likes keeps library_reviews.likes_count in
 *  sync, so callers don't need to touch that column themselves. */
export async function toggleReviewLike(reviewId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase.from("library_review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("library_review_likes").insert({ review_id: reviewId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}
