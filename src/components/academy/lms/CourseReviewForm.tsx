import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitCourseReview } from "@/hooks/academy/useCourseDetail";
import { toast } from "@/hooks/use-toast";

interface CourseReviewFormProps {
  courseId: string;
}

export function CourseReviewForm({ courseId }: CourseReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const { submitReview, isSubmitting } = useSubmitCourseReview(courseId);

  const handleSubmit = async () => {
    if (rating < 1) {
      toast({ title: "الرجاء اختيار عدد النجوم أولاً", variant: "destructive" });
      return;
    }
    try {
      await submitReview({ rating: rating as 1 | 2 | 3 | 4 | 5, comment: comment.trim() || null });
      toast({ title: "تم نشر تقييمك، شكراً لك!" });
      setComment("");
    } catch (err) {
      toast({ title: "تعذّر إرسال التقييم", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
      <p className="text-sm font-bold text-foreground">قيّم هذه الدورة</p>
      <div className="flex gap-1" role="radiogroup" aria-label="عدد النجوم">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} من 5 نجوم`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <Star
                className={`w-6 h-6 ${value <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
              />
            </button>
          );
        })}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="شارك رأيك في هذه الدورة (اختياري)"
        className="rounded-xl"
        rows={3}
      />
      <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl">
        {isSubmitting ? "جارِ الإرسال..." : "نشر التقييم"}
      </Button>
    </div>
  );
}
