import { useState } from "react";
import { Star } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReviewCard } from "@/components/library/ReviewCard";
import { WriteReviewForm } from "@/components/library/WriteReviewForm";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { SectionError } from "@/components/library/SectionError";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBookReviews } from "@/hooks/library/useBookReviews";
import { useReviewHelpful } from "@/hooks/library/useReviewHelpful";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import type { LibraryReviewSort, LibraryReviewInput } from "@/services/library/reviews";

interface ReviewsListProps {
  bookId: string;
}

export function ReviewsList({ bookId }: ReviewsListProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [sort, setSort] = useState<LibraryReviewSort>("newest");
  const { reviews, myReview, isLoading, error, refetch, submitReview, removeMyReview, toggleLike } = useBookReviews(bookId, sort);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const otherReviews = reviews.filter((r) => r.id !== myReview?.id);
  const { isMarkedHelpful, toggleHelpful } = useReviewHelpful(bookId, otherReviews.map((r) => r.id));

  const handleSubmit = async (rating: 1 | 2 | 3 | 4 | 5, comment: string | null, extra: LibraryReviewInput) => {
    setIsSubmitting(true);
    const ok = await submitReview(rating, comment, extra);
    setIsSubmitting(false);
    if (ok) {
      setIsEditing(false);
      if (!myReview) void logLibraryAnalyticsEvent("review_written", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
    }
  };

  if (isLoading) return <SkeletonLoader variant="list" count={3} />;
  if (error) return <SectionError message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {user && (myReview === null || isEditing) && (
        <WriteReviewForm
          existingReview={isEditing ? myReview : null}
          onSubmit={handleSubmit}
          onCancel={isEditing ? () => setIsEditing(false) : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {myReview && !isEditing && (
        <ReviewCard review={myReview} isOwn onEdit={() => setIsEditing(true)} onDelete={() => setDeleteConfirmOpen(true)} />
      )}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("library.reviews.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("library.reviews.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("library.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeMyReview()}>{t("library.reviews.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {otherReviews.length > 0 && (
        <div className="flex justify-end">
          <Select value={sort} onValueChange={(v) => setSort(v as LibraryReviewSort)}>
            <SelectTrigger className="w-48" aria-label={t("library.common.sortBy")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("library.reviews.sort.newest")}</SelectItem>
              <SelectItem value="mostHelpful">{t("library.reviews.sort.mostHelpful")}</SelectItem>
              <SelectItem value="highestRating">{t("library.reviews.sort.highestRating")}</SelectItem>
              <SelectItem value="lowestRating">{t("library.reviews.sort.lowestRating")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {otherReviews.length === 0 && !myReview ? (
        <EmptyState icon={<Star className="h-8 w-8" />} title={t("library.reviews.none")} className="py-8" />
      ) : (
        <div>
          {otherReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onToggleLike={() => void toggleLike(review.id, review.likedByMe)}
              isMarkedHelpful={isMarkedHelpful(review.id)}
              onToggleHelpful={() => void toggleHelpful(review.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
