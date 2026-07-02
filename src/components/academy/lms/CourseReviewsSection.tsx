import { User } from "lucide-react";
import { StarRating } from "./StarRating";
import type { AcademyCourseReviewRow } from "@/lib/types/academy-lms";

interface CourseReviewsSectionProps {
  reviews: AcademyCourseReviewRow[];
  ratingAvg: number | null;
  ratingCount: number;
}

export function CourseReviewsSection({ reviews, ratingAvg, ratingCount }: CourseReviewsSectionProps) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-border rounded-2xl">
        لا توجد تقييمات بعد — كن أول من يقيّم هذه الدورة بعد إتمامها.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <StarRating rating={ratingAvg} count={ratingCount} size="md" />
      </div>
      <ul className="space-y-4">
        {reviews.map((review) => (
          <li key={review.id} className="p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
                <User className="w-4 h-4" />
              </div>
              <StarRating rating={review.rating} />
            </div>
            {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
