import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number | null;
  count?: number;
  size?: "sm" | "md";
}

export function StarRating({ rating, count, size = "sm" }: StarRatingProps) {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";

  if (rating == null) {
    return <span className="text-xs text-muted-foreground">لا توجد تقييمات بعد</span>;
  }

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`التقييم: ${rating.toFixed(1)} من 5${count != null ? ` (${count} تقييم)` : ""}`}
    >
      <div className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`${iconSize} ${i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-foreground">{rating.toFixed(1)}</span>
      {count != null && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
  );
}
