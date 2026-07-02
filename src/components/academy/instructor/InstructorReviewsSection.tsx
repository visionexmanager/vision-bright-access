import { useState } from "react";
import { MessageSquare, User, CornerDownLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/academy/lms/StarRating";
import { getReviewReply, saveReviewReply } from "@/lib/academy/instructorLocalStore";
import { getReviewsForCourse } from "@/lib/academy/mockCourses";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorReviewsSectionProps {
  courses: AcademyCourseRow[];
  instructorId: string;
}

export function InstructorReviewsSection({ courses, instructorId }: InstructorReviewsSectionProps) {
  const reviews = courses.flatMap((c) => getReviewsForCourse(c.id).map((r) => ({ ...r, courseTitle: c.title })));
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [, forceRender] = useState(0);

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">لا توجد تقييمات على دوراتك بعد.</p>
      </div>
    );
  }

  const handleReply = (reviewId: string) => {
    const body = replyDrafts[reviewId]?.trim();
    if (!body) return;
    saveReviewReply(reviewId, instructorId, body);
    setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
    forceRender((n) => n + 1);
  };

  return (
    <ul className="space-y-4">
      {reviews.map((review) => {
        const existingReply = getReviewReply(review.id);
        return (
          <li key={review.id} className="p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <User className="w-4 h-4" />
                </div>
                <StarRating rating={review.rating} />
              </div>
              <span className="text-xs text-muted-foreground">{review.courseTitle}</span>
            </div>
            {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}

            {existingReply ? (
              <div className="flex items-start gap-2 ps-4 border-s-2 border-primary/30">
                <CornerDownLeft className="w-3.5 h-3.5 text-primary shrink-0 mt-1" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{existingReply.body}</p>
              </div>
            ) : (
              <div className="flex gap-2 items-start">
                <Textarea
                  value={replyDrafts[review.id] ?? ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  placeholder="اكتب ردّك على هذا التقييم..."
                  className="rounded-xl min-h-16 text-sm"
                />
                <Button size="sm" onClick={() => handleReply(review.id)} disabled={!replyDrafts[review.id]?.trim()} className="rounded-xl shrink-0">
                  رد
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
