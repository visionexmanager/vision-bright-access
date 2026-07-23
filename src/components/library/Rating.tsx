import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

export function Rating({ value, count, size = "sm", className }: RatingProps) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const rounded = Math.round(value);

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars${count != null ? `, ${count} ratings` : ""}`}
    >
      <div className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(starSize, i < rounded ? "fill-primary text-primary" : "fill-none text-muted-foreground/40")}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {value.toFixed(1)}
        {count != null && <span className="ms-1">({count.toLocaleString()})</span>}
      </span>
    </div>
  );
}
