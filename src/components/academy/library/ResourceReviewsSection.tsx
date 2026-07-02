import { useState } from "react";
import { User } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/academy/lms/StarRating";
import type { AcademyResourceReviewRow } from "@/lib/types/academy-library";

interface ResourceReviewsSectionProps {
  reviews: AcademyResourceReviewRow[];
  ratingAvg: number | null;
  ratingCount: number;
  onSubmitReview: (rating: 1 | 2 | 3 | 4 | 5, comment: string) => void;
}

export function ResourceReviewsSection({ reviews, ratingAvg, ratingCount, onSubmitReview }: ResourceReviewsSectionProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment, setComment] = useState("");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <StarRating rating={ratingAvg} count={ratingCount} size="md" />
      </div>

      <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="التقييم">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              onClick={() => setRating(n)}
              className={`text-lg ${n <= rating ? "text-yellow-400" : "text-muted-foreground/30"}`}
              aria-label={`${n} من 5`}
            >
              ★
            </button>
          ))}
        </div>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="شارك رأيك في هذا المورد..." className="rounded-xl text-sm" />
        <Button size="sm" onClick={() => { onSubmitReview(rating, comment); setComment(""); }} className="rounded-xl">إرسال التقييم</Button>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد تقييمات بعد.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true"><User className="w-4 h-4" /></div>
                <StarRating rating={review.rating} />
              </div>
              {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
