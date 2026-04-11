import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { generalProducts, accessibilityProducts } from "@/data/products";
import { CartDrawer } from "@/components/CartDrawer";
import { VXPrice } from "@/components/VXPrice";
import { ShoppingCart, Star, Check, ArrowLeft, Truck, Shield, Award } from "lucide-react";
import { WishlistButton } from "@/components/WishlistButton";
import { toast } from "sonner";

const allProducts = [...generalProducts, ...accessibilityProducts];

const reviewPool = [
  { author: "Alex M.", rating: 5, text: "Absolutely love this product. It exceeded all my expectations and the quality is outstanding." },
  { author: "Jordan K.", rating: 4, text: "Great value for money. Works exactly as described. Would recommend to others." },
  { author: "Sam R.", rating: 5, text: "This has made such a difference in my daily workflow. Couldn't be happier with my purchase." },
  { author: "Casey T.", rating: 4, text: "Solid build quality and easy to set up. Minor learning curve but well worth it." },
  { author: "Riley P.", rating: 5, text: "Exceptional product! The attention to detail and accessibility features are truly impressive." },
  { author: "Morgan L.", rating: 3, text: "Good product overall. Does what it says, though I wish it had a few more customization options." },
  { author: "Taylor W.", rating: 5, text: "Best purchase I've made this year. The customer support was also incredibly helpful." },
  { author: "Drew H.", rating: 4, text: "Very intuitive to use. My whole family benefits from this product daily." },
];

function getProductReviews(productId: string) {
  const hash = productId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = 3 + (hash % 3);
  const reviews = [];
  for (let i = 0; i < count; i++) {
    reviews.push(reviewPool[(hash + i) % reviewPool.length]);
  }
  return reviews;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-5 w-5 ${s <= rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, items } = useCart();
  const { t } = useLanguage();

  const product = allProducts.find((p) => p.id === id);
  const inCart = product ? items.some((i) => i.product.id === product.id) : false;

  const reviews = useMemo(() => (product ? getProductReviews(product.id) : []), [product]);
  const avgReview = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0";

  const related = useMemo(() => {
    if (!product) return [];
    return allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3);
  }, [product]);

  if (!product) {
    return (
      <Layout>
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="mb-4 text-3xl font-bold">{t("product.notFound")}</h1>
          <p className="mb-8 text-lg text-muted-foreground">{t("product.notFoundDesc")}</p>
          <Button asChild size="lg" className="text-base">
            <Link to="/marketplace">
              <ArrowLeft className="me-2 h-5 w-5" /> {t("product.backToMarketplace")}
            </Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const handleAdd = () => {
    addToCart(product);
    toast.success(t("cart.added").replace("{name}", product.name));
  };

  const trustBadges = [
    { icon: Truck, label: t("product.freeShipping") },
    { icon: Shield, label: t("product.securePurchase") },
    { icon: Award, label: t("product.qualityGuaranteed") },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-8" aria-labelledby="product-heading">
        <nav className="mb-6 flex items-center gap-2 text-base" aria-label="Breadcrumb">
          <Link to="/marketplace" className="text-primary underline-offset-4 hover:underline font-medium">
            {t("market.title")}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-primary/10 text-8xl">
                {product.image}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h1 id="product-heading" className="text-3xl font-bold leading-tight">{product.name}</h1>
              <div className="flex items-center gap-1">
                <WishlistButton productId={product.id} productName={product.name} />
                <CartDrawer />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">{t(`cat.${product.category}`)}</Badge>
              <div className="flex items-center gap-1 text-base">
                <Star className="h-5 w-5 fill-accent text-accent" aria-hidden="true" />
                <span className="font-semibold">{product.rating}</span>
                <span className="text-muted-foreground">({reviews.length} {t("product.reviews")})</span>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground">{product.description}</p>

            <Separator />

            <div className="flex items-end justify-between">
              <VXPrice amount={product.price} size="xl" />
              <Badge variant={product.inStock ? "default" : "destructive"} className="text-sm px-3 py-1">
                {product.inStock ? t("product.inStock") : t("product.outOfStock")}
              </Badge>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!product.inStock}
              size="lg"
              className="mt-2 text-lg h-14"
              aria-label={!product.inStock ? `${product.name} ${t("product.outOfStock")}` : inCart ? `${t("product.addAnother")} ${product.name}` : `${t("product.addToCart")} ${product.name}`}
            >
              {!product.inStock ? (
                t("product.outOfStock")
              ) : inCart ? (
                <><Check className="me-2 h-5 w-5" /> {t("product.addAnother")}</>
              ) : (
                <><ShoppingCart className="me-2 h-5 w-5" /> {t("product.addToCart")}</>
              )}
            </Button>

            <div className="mt-2 grid grid-cols-3 gap-3">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="mb-6 text-2xl font-bold">
            {t("product.customerReviews")}
            <span className="ms-3 text-lg font-normal text-muted-foreground">
              {avgReview} {t("product.avg")} · {reviews.length} {t("product.reviews")}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review, idx) => (
              <Card key={idx}>
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-base font-bold">{review.author}</span>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-base leading-relaxed text-muted-foreground">{review.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-2xl font-bold">{t("product.relatedProducts")}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rp) => (
                <Link key={rp.id} to={`/product/${rp.id}`} className="group">
                  <Card className="transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl">{rp.image}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-bold group-hover:text-primary transition-colors">{rp.name}</h3>
                        <VXPrice amount={rp.price} size="sm" />
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                          {rp.rating}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
