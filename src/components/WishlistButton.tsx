import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface WishlistButtonProps {
  productId: string;
  productName: string;
  size?: "icon" | "default";
}

export function WishlistButton({ productId, productName, size = "icon" }: WishlistButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { t } = useLanguage();
  const wishlisted = isWishlisted(productId);

  const handleClick = () => {
    if (!user) {
      toast.error(t("wishlist.loginRequired"));
      return;
    }
    toggleWishlist(productId);
    if (wishlisted) {
      toast.success(t("wishlist.removed").replace("{name}", productName));
    } else {
      toast.success(t("wishlist.added").replace("{name}", productName));
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleClick}
      aria-label={wishlisted ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      className={wishlisted ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-destructive"}
    >
      <Heart className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`} />
    </Button>
  );
}
