import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyHelpfulVotes, toggleReviewHelpful, fetchReviewMedia, uploadReviewMedia } from "@/services/library/reviewMedia";

export function useReviewHelpful(bookId: string, reviewIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: helpfulVotes = new Set<string>() } = useQuery({
    queryKey: queryKeys.library.myHelpfulVotes(uid ?? "", bookId),
    queryFn: () => fetchMyHelpfulVotes(uid!, reviewIds),
    enabled: !!uid && reviewIds.length > 0,
  });

  const toggleHelpful = async (reviewId: string) => {
    if (!uid) return;
    try {
      await toggleReviewHelpful(reviewId, uid, helpfulVotes.has(reviewId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.myHelpfulVotes(uid, bookId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.bookReviews(bookId) });
    } catch (err) {
      toast({ title: "Couldn't update vote", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { helpfulVotes, isMarkedHelpful: (reviewId: string) => helpfulVotes.has(reviewId), toggleHelpful };
}

export function useReviewMedia(reviewId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: media = [], isLoading } = useQuery({
    queryKey: queryKeys.library.reviewMedia(reviewId ?? ""),
    queryFn: () => fetchReviewMedia(reviewId!),
    enabled: !!reviewId,
  });

  const upload = async (file: File) => {
    if (!reviewId) return;
    try {
      await uploadReviewMedia(reviewId, file, media.length);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.reviewMedia(reviewId) });
    } catch (err) {
      toast({ title: "Couldn't upload media", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { media, isLoading, upload };
}
