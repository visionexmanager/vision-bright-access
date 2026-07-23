import { useRef, useState } from "react";
import { Heart, Pencil, Trash2, BadgeCheck, ThumbsUp, ImagePlus, Eye, Plus, Minus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/library/Rating";
import { ReportContentDialog } from "@/components/library/ReportContentDialog";
import { useReviewMedia } from "@/hooks/library/useReviewHelpful";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { LibraryReviewRow } from "@/lib/types/library-review";

interface ReviewCardProps {
  review: LibraryReviewRow;
  isOwn?: boolean;
  onToggleLike?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isMarkedHelpful?: boolean;
  onToggleHelpful?: () => void;
}

export function ReviewCard({ review, isOwn, onToggleLike, onEdit, onDelete, isMarkedHelpful, onToggleHelpful }: ReviewCardProps) {
  const { t } = useLanguage();
  const { media, upload } = useReviewMedia(review.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  return (
    <div className="flex gap-3 border-b py-4 last:border-b-0">
      <Avatar>
        <AvatarImage src={review.reviewerAvatarUrl ?? undefined} alt="" />
        <AvatarFallback>{review.reviewerName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{review.reviewerName}</span>
            {isOwn && <span className="text-xs text-muted-foreground">({t("library.reviews.you")})</span>}
            {review.verifiedPurchase && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.verifiedPurchase")}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
        </div>
        <Rating value={review.rating} size="sm" />

        {review.hasSpoilers && !spoilerRevealed ? (
          <button
            type="button"
            onClick={() => setSpoilerRevealed(true)}
            className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.reviews.showSpoiler")}
          </button>
        ) : (
          <>
            {review.hasSpoilers && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Eye className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.spoilerWarning")}
              </Badge>
            )}
            {review.comment && <p className="text-sm leading-relaxed">{review.comment}</p>}
          </>
        )}

        {(review.pros.length > 0 || review.cons.length > 0) && (!review.hasSpoilers || spoilerRevealed) && (
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            {review.pros.length > 0 && (
              <ul className="space-y-1">
                {review.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <Plus className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {pro}
                  </li>
                ))}
              </ul>
            )}
            {review.cons.length > 0 && (
              <ul className="space-y-1">
                {review.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                    <Minus className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {con}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {media.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" role="list">
            {media.map((item) => (
              item.media_type === "video" ? (
                <video key={item.id} src={item.url} controls className="h-20 w-28 rounded-md object-cover" />
              ) : (
                <img key={item.id} src={item.url} alt="" loading="lazy" className="h-20 w-20 rounded-md object-cover" />
              )
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1">
          {isOwn ? (
            <>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}>
                <Pencil className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.edit")}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.delete")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.addPhoto")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onToggleLike}
                aria-pressed={review.likedByMe}
              >
                <Heart className={review.likedByMe ? "h-3.5 w-3.5 fill-current text-primary" : "h-3.5 w-3.5"} aria-hidden="true" />
                {review.likes_count}
              </Button>
              {onToggleHelpful && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 gap-1 px-2 text-xs", isMarkedHelpful && "text-primary")}
                  onClick={onToggleHelpful}
                  aria-pressed={isMarkedHelpful}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", isMarkedHelpful && "fill-current")} aria-hidden="true" />
                  {t("library.reviews.helpful")} ({review.helpfulCount})
                </Button>
              )}
              <ReportContentDialog contentType="library_review" contentId={review.id} iconOnly />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
