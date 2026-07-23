import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibraryWishlist } from "@/hooks/library/useLibraryWishlist";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  bookId: string;
  className?: string;
}

/** Distinct from FavoriteButton: Favorites is "I liked this", Wishlist is
 *  "I intend to buy this" — separate concepts, separate tables. */
export function WishlistButton({ bookId, className }: WishlistButtonProps) {
  const { t } = useLanguage();
  const { isInWishlist, toggleWishlist } = useLibraryWishlist();
  const active = isInWishlist(bookId);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => void toggleWishlist(bookId)}
      aria-pressed={active}
      aria-label={active ? t("library.actions.removeFromWishlist") : t("library.actions.addToWishlist")}
      className={cn("shrink-0", className)}
    >
      <Heart className={cn("h-4 w-4", active && "fill-primary text-primary")} aria-hidden="true" />
    </Button>
  );
}
