/**
 * useBookReviews — the Book Details reviews section: the full list, the
 * signed-in viewer's own review (for the write/edit form), and the
 * create/update/delete/like mutations. RLS: reviews are public-read, write
 * ops are owner-only (mirrored here only for UX — see reviews.ts header).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchReviewsForBook,
  fetchMyReviewForBook,
  createReview,
  updateReview,
  deleteReview,
  toggleReviewLike,
  type LibraryReviewSort,
  type LibraryReviewInput,
} from "@/services/library/reviews";

export function useBookReviews(bookId: string | undefined, sort: LibraryReviewSort = "newest") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: reviews = [], isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.library.bookReviews(bookId ?? ""), sort],
    queryFn: () => fetchReviewsForBook(bookId!, uid, sort),
    enabled: !!bookId,
  });

  const { data: myReview = null } = useQuery({
    queryKey: queryKeys.library.myReview(bookId ?? "", uid ?? ""),
    queryFn: () => fetchMyReviewForBook(bookId!, uid!),
    enabled: !!bookId && !!uid,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.bookReviews(bookId ?? "") });
    queryClient.invalidateQueries({ queryKey: queryKeys.library.myReview(bookId ?? "", uid ?? "") });
  }, [queryClient, bookId, uid]);

  const submitReview = useCallback(
    async (rating: 1 | 2 | 3 | 4 | 5, comment: string | null, extra: LibraryReviewInput) => {
      if (!bookId || !uid) return false;
      try {
        if (myReview) {
          await updateReview(myReview.id, rating, comment, extra);
        } else {
          await createReview(uid, bookId, rating, comment, extra);
        }
        invalidate();
        return true;
      } catch (err) {
        toast({ title: "Couldn't save your review", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        return false;
      }
    },
    [bookId, uid, myReview, invalidate]
  );

  const removeMyReview = useCallback(async () => {
    if (!myReview) return;
    try {
      await deleteReview(myReview.id);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete your review", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, [myReview, invalidate]);

  const toggleLike = useCallback(
    async (reviewId: string, currentlyLiked: boolean) => {
      if (!uid) return;
      try {
        await toggleReviewLike(reviewId, uid, currentlyLiked);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update like", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [uid, invalidate]
  );

  return {
    reviews,
    myReview,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    submitReview,
    removeMyReview,
    toggleLike,
  };
}
