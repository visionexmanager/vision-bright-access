import { ThumbsUp, Flag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikeReview, useReportReview } from "@/features/visionkids/hooks/market/useMarketCommerce";
import { StarRating } from "@/features/visionkids/components/market/StarRating";
import type { MarketReview } from "@/features/visionkids/types/market.types";

export function ReviewList({ reviews }: { reviews: MarketReview[] }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const like = useLikeReview();
  const report = useReportReview();

  if (reviews.length === 0) {
    return <p className="mt-3 rounded-2xl border-2 border-dashed border-border p-5 text-center text-sm text-muted-foreground">{t("kids.market.reviews.none")}</p>;
  }

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <StarRating value={r.rating} size={14} />
            <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          <div className="mt-2 flex items-center gap-3">
            <button type="button" disabled={!user || like.isPending} onClick={() => like.mutate(r.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-kids-primary disabled:opacity-50">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> {r.likes}
            </button>
            <button type="button" disabled={!user || report.isPending}
              onClick={() => report.mutate({ reviewId: r.id, reason: "reported by user" })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-kids-pink disabled:opacity-50">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.market.reviews.report")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
