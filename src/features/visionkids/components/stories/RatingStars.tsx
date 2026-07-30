import { Star } from "lucide-react";

interface RatingStarsProps {
  value: number;
  count?: number;
  size?: number;
  onChange?: (value: number) => void;
}

/** Read-only by default; pass onChange to make it an interactive picker (StoryDetails' "rate this story"). */
export function RatingStars({ value, count, size = 16, onChange }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined} aria-label={onChange ? "Rate this story" : `Rated ${value.toFixed(1)} out of 5`}>
      {stars.map((star) => {
        const filled = star <= Math.round(value);
        const Wrapper = onChange ? "button" : "span";
        return (
          <Wrapper
            key={star}
            type={onChange ? "button" : undefined}
            role={onChange ? "radio" : undefined}
            aria-checked={onChange ? star === Math.round(value) : undefined}
            aria-label={onChange ? `${star} star${star > 1 ? "s" : ""}` : undefined}
            onClick={onChange ? () => onChange(star) : undefined}
            className={onChange ? "rounded focus-visible:ring-2 focus-visible:ring-ring" : undefined}
          >
            <Star
              width={size}
              height={size}
              className={filled ? "fill-kids-accent text-kids-accent" : "text-muted-foreground"}
              aria-hidden="true"
            />
          </Wrapper>
        );
      })}
      {typeof count === "number" && <span className="ms-1 text-xs text-muted-foreground">({count})</span>}
    </div>
  );
}
