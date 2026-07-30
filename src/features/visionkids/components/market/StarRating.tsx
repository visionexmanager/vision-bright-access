import { Star } from "lucide-react";
import { RATING_STARS } from "@/features/visionkids/data/marketConfig";

/** Star rating — display-only, or interactive when `onChange` is provided. */
export function StarRating({
  value,
  onChange,
  size = 16,
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  label?: string;
}) {
  const interactive = !!onChange;
  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? "radiogroup" : undefined} aria-label={label}>
      {RATING_STARS.map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            className={filled ? "text-kids-accent" : "text-muted-foreground/40"}
            style={{ width: size, height: size }}
            fill={filled ? "currentColor" : "none"}
            aria-hidden="true"
          />
        );
        return interactive ? (
          <button key={n} type="button" onClick={() => onChange!(n)} aria-label={`${n}`} aria-checked={n === Math.round(value)} role="radio" className="p-0.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
