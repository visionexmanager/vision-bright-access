import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useWishlistProducts } from "@/features/visionkids/hooks/market/useMarketCommerce";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";
import { ProductCard } from "@/features/visionkids/components/market/ProductCard";

export default function Wishlist() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: products = [], isLoading } = useWishlistProducts();

  useDocumentHead({
    title: `${t("kids.market.nav.wishlist")} — VisionKids`,
    description: t("kids.market.wishlist.subtitle"),
    canonicalPath: "/kids/market/wishlist",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="💖" title={t("kids.market.nav.wishlist")} subtitle={t("kids.market.wishlist.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.wishlist.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
