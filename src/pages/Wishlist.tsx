import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { generalProducts, accessibilityProducts } from "@/data/products";
import { Navigate, Link } from "react-router-dom";
import { VXPrice } from "@/components/VXPrice";
import { Heart, ShoppingCart, Star, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const allProducts = [...generalProducts, ...accessibilityProducts];

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { wishlistIds, isLoading, toggleWishlist } = useWishlist();
  const { addToCart, items } = useCart();
  const { t } = useLanguage();

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const wishlistProducts = allProducts.filter((p) => wishlistIds.includes(p.id));

  const handleRemove = (productId: string, name: string) => {
    toggleWishlist(productId);
    toast.success(t("wishlist.removed").replace("{name}", name));
  };

  const handleAddToCart = (product: typeof allProducts[0]) => {
    addToCart(product);
    toast.success(t("cart.added").replace("{name}", product.name));
  };

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="wishlist-heading">
        <h1 id="wishlist-heading" className="mb-2 text-3xl font-bold">{t("wishlist.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("wishlist.subtitle")}</p>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : wishlistProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Heart className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-xl text-muted-foreground">{t("wishlist.empty")}</p>
            <p className="text-muted-foreground">{t("wishlist.emptyDesc")}</p>
            <Button asChild size="lg" className="mt-4 text-base">
              <Link to="/marketplace">
                <ShoppingBag className="me-2 h-5 w-5" /> {t("wishlist.browseMarketplace")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {wishlistProducts.map((product) => {
              const inCart = items.some((i) => i.product.id === product.id);
              return (
                <Card key={product.id} className="flex flex-col transition-shadow hover:shadow-lg">
                  <CardContent className="flex flex-1 flex-col gap-3 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl">
                        {product.image}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(product.id, product.name)}
                        aria-label={`Remove ${product.name} from wishlist`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Heart className="h-5 w-5 fill-current" />
                      </Button>
                    </div>

                    <Link to={`/product/${product.id}`} className="text-xl font-bold leading-tight hover:text-primary transition-colors underline-offset-4 hover:underline">
                      {product.name}
                    </Link>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                      <span className="font-medium">{product.rating}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <div>
                        <VXPrice amount={product.price} size="lg" />
                        <p className="text-sm font-medium text-primary">+{product.points} pts</p>
                      </div>
                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={!product.inStock}
                        size="lg"
                        className="text-base"
                      >
                        {!product.inStock ? (
                          t("market.outOfStock")
                        ) : (
                          <>
                            <ShoppingCart className="me-1 h-4 w-4" /> {inCart ? t("market.addMore") : t("market.addToCart")}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
