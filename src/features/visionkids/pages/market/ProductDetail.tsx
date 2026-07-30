import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Coins, Heart, Download, Check, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProduct, useCreator, useProductReviews } from "@/features/visionkids/hooks/market/useMarketCatalog";
import { usePurchaseProduct, useLicensedProductIds, useToggleWishlist, useWishlistIds, useAddReview } from "@/features/visionkids/hooks/market/useMarketCommerce";
import { recordView } from "@/features/visionkids/services/market/commerce";
import { PRODUCT_TYPE_META } from "@/features/visionkids/data/marketConfig";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";
import { StarRating } from "@/features/visionkids/components/market/StarRating";
import { ReviewList } from "@/features/visionkids/components/market/ReviewList";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: product, isLoading } = useProduct(slug);
  const { data: creator } = useCreator(product?.creator_id);
  const { data: reviews = [] } = useProductReviews(product?.id);
  const { data: licensed = [] } = useLicensedProductIds();
  const { data: wishlistIds = [] } = useWishlistIds();
  const purchase = usePurchaseProduct();
  const toggleWishlist = useToggleWishlist();
  const addReview = useAddReview();

  const [error, setError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const viewed = useRef(false);

  useDocumentHead({
    title: product ? `${product.title} — VisionKids` : t("kids.market.heroTitle"),
    description: product?.description ?? t("kids.market.meta.description"),
    canonicalPath: `/kids/market/product/${slug}`,
  });

  useEffect(() => {
    if (user && product && !viewed.current) {
      viewed.current = true;
      recordView(product.id).catch(() => {});
    }
  }, [user, product]);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!product) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <MarketHeader emoji="🛍️" title={t("kids.market.notFound")} backTo="/kids/market/discover" />
    </div>
  );

  const owned = licensed.includes(product.id);
  const wished = wishlistIds.includes(product.id);
  const meta = PRODUCT_TYPE_META[product.type];

  async function onGet() {
    if (!product) return;
    setError(null);
    try {
      await purchase.mutateAsync(product.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("kids.market.buyFailed"));
      setTimeout(() => setError(null), 3500);
    }
  }

  async function onReview() {
    if (!product || myRating === 0) return;
    try {
      await addReview.mutateAsync({ productId: product.id, rating: myRating, comment: myComment.trim() || undefined });
      setReviewed(true);
      setMyComment("");
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <MarketHeader emoji={product.emoji} title={product.title} backTo="/kids/market/discover" backLabelKey="kids.market.nav.discover" />

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{meta ? t(meta.labelKey) : product.type}</span>
        <StarRating value={product.rating_avg} size={16} />
        <span className="text-muted-foreground">({product.rating_count})</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Download className="h-3.5 w-3.5" aria-hidden="true" /> {product.downloads}</span>
        <span className="text-muted-foreground">· {t("kids.market.ages")} {product.age_min}–{product.age_max}</span>
      </div>

      {creator && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden="true">{creator.avatar}</span> {creator.display_name}
          {creator.verified && <ShieldCheck className="h-4 w-4 text-kids-primary" aria-label={t("kids.market.verified")} />}
        </p>
      )}

      {product.description && <p className="mt-4 leading-relaxed">{product.description}</p>}

      {/* Get / buy */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
        {product.is_free ? (
          <span className="font-heading text-xl font-bold text-kids-green">{t("kids.market.free")}</span>
        ) : (
          <span className="flex items-center gap-1 font-heading text-xl font-bold text-kids-accent">
            <Coins className="h-5 w-5" aria-hidden="true" /> {product.price_coins.toLocaleString()}
          </span>
        )}
        {owned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kids-green/15 px-5 py-2.5 font-bold text-kids-green">
            <Check className="h-4 w-4" aria-hidden="true" /> {t("kids.market.owned")}
          </span>
        ) : (
          <button type="button" onClick={onGet} disabled={!user || purchase.isPending}
            className="rounded-full bg-kids-primary px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {product.is_free ? t("kids.market.get") : t("kids.market.buy")}
          </button>
        )}
        <button type="button" onClick={() => product && toggleWishlist.mutate(product.id)} disabled={!user}
          aria-pressed={wished} title={t("kids.market.wishlistToggle")}
          className={`rounded-full border-2 p-2.5 transition-colors disabled:opacity-50 ${wished ? "border-kids-pink text-kids-pink" : "border-border text-muted-foreground hover:text-kids-pink"}`}>
          <Heart className="h-5 w-5" fill={wished ? "currentColor" : "none"} aria-label={t("kids.market.wishlistToggle")} />
        </button>
      </div>
      {error && <p className="mt-2 rounded-xl border-2 border-kids-pink/40 bg-kids-pink/10 p-3 text-sm font-semibold text-kids-pink" role="alert">{error}</p>}
      {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.market.signInHint")}</p>}

      {/* Reviews */}
      <section className="mt-8">
        <h2 className="font-heading text-xl font-bold">{t("kids.market.reviews.title")}</h2>

        {owned && !reviewed && (
          <div className="mt-3 rounded-2xl border-2 border-border bg-card p-4">
            <p className="text-sm font-semibold">{t("kids.market.reviews.leave")}</p>
            <div className="mt-2"><StarRating value={myRating} onChange={setMyRating} size={22} label={t("kids.market.reviews.yourRating")} /></div>
            <textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} rows={2} maxLength={400}
              placeholder={t("kids.market.reviews.commentPlaceholder")}
              className="mt-2 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            <button type="button" onClick={onReview} disabled={myRating === 0 || addReview.isPending}
              className="mt-2 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
              {t("kids.market.reviews.submit")}
            </button>
          </div>
        )}
        {reviewed && <p className="mt-2 text-sm font-semibold text-kids-green">✅ {t("kids.market.reviews.thanks")}</p>}

        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}
