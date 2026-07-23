// ─── Library — Review Media Service (Phase 10) ────────────────────────────
// Images/videos attached to a review, uploaded to the library-review-media
// bucket under {review_id}/{filename} (the review row must already exist —
// WriteReviewForm submits the review text first, then uploads media
// against the returned id).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryReviewMediaRow } from "@/lib/types/library-marketplace";

export async function fetchReviewMedia(reviewId: string): Promise<LibraryReviewMediaRow[]> {
  const { data, error } = await supabase.from("library_review_media").select("id, review_id, media_type, url, display_order").eq("review_id", reviewId).order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryReviewMediaRow[];
}

export async function uploadReviewMedia(reviewId: string, file: File, displayOrder: number): Promise<LibraryReviewMediaRow> {
  const mediaType = file.type.startsWith("video/") ? "video" : "image";
  const path = `${reviewId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("library-review-media").upload(path, file);
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: publicUrl } = supabase.storage.from("library-review-media").getPublicUrl(path);
  const { data, error } = await supabase
    .from("library_review_media")
    .insert({ review_id: reviewId, media_type: mediaType, url: publicUrl.publicUrl, display_order: displayOrder })
    .select("id, review_id, media_type, url, display_order")
    .single();
  if (error) throw new Error(error.message);
  return data as LibraryReviewMediaRow;
}

export async function toggleReviewHelpful(reviewId: string, userId: string, currentlyMarked: boolean): Promise<void> {
  if (currentlyMarked) {
    const { error } = await supabase.from("library_review_helpful_votes").delete().eq("review_id", reviewId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("library_review_helpful_votes").insert({ review_id: reviewId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

export async function fetchMyHelpfulVotes(userId: string, reviewIds: string[]): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();
  const { data, error } = await supabase.from("library_review_helpful_votes").select("review_id").eq("user_id", userId).in("review_id", reviewIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.review_id));
}
