/**
 * FavoriteButton
 *
 * Toggle-favorite button for TV channels.
 * Calls useFavorites().toggle() with optimistic UI update.
 */

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";

interface Props {
  channelId: string;
  size?:     "sm" | "md";
  className?: string;
}

export function FavoriteButton({ channelId, size = "sm", className }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const faved = isFavorite(channelId);

  return (
    <button
      onClick={e => { e.stopPropagation(); e.preventDefault(); toggle(channelId); }}
      aria-label={faved ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={faved}
      className={cn(
        "rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
        size === "sm" ? "p-1.5" : "p-2",
        faved
          ? "text-red-500 hover:text-red-400"
          : "text-muted-foreground/60 hover:text-red-400",
        className
      )}
    >
      <Heart
        className={cn(
          size === "sm" ? "w-4 h-4" : "w-5 h-5",
          faved && "fill-current"
        )}
      />
    </button>
  );
}
