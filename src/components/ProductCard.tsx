import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart, Product } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { WishlistButton } from "@/components/WishlistButton";
import { ShoppingCart, Star, Check } from "lucide-react";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
}

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const { t } = useLanguage();
  const inCart = items.some((i) => i.product.id === product.id);

  const handleAdd = () => {
    addToCart(product);
    toast.success(t("cart.added").replace("{name}", product.name));
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lg">
      <CardContent className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl" aria-hidden="true">
            {product.image}
          </div>
          <div className="flex items-center gap-1">
            <WishlistButton productId={product.id} productName={product.name} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
              <span className="font-medium">{product.rating}</span>
            </div>
          </div>
        </div>

        <Link to={`/product/${product.id}`} className="text-xl font-bold leading-tight hover:text-primary transition-colors underline-offset-4 hover:underline">
          {product.name}
        </Link>
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
            <p className="text-sm font-medium text-primary">{t("market.pts").replace("{points}", String(product.points))}</p>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!product.inStock}
            size="lg"
            className="text-base"
            aria-label={
              !product.inStock
                ? `${product.name} ${t("market.outOfStock")}`
                : inCart
                ? `${t("market.addMore")} ${product.name}`
                : `${t("market.addToCart")} ${product.name}`
            }
          >
            {!product.inStock ? (
              t("market.outOfStock")
            ) : inCart ? (
              <>
                <Check className="me-1 h-4 w-4" /> {t("market.addMore")}
              </>
            ) : (
              <>
                <ShoppingCart className="me-1 h-4 w-4" /> {t("market.addToCart")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
