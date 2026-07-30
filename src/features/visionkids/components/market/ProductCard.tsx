import { Link } from "react-router-dom";
import { Coins, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRODUCT_TYPE_META } from "@/features/visionkids/data/marketConfig";
import { StarRating } from "@/features/visionkids/components/market/StarRating";
import type { Product } from "@/features/visionkids/types/market.types";

export function ProductCard({ product }: { product: Product }) {
  const { t } = useLanguage();
  const meta = PRODUCT_TYPE_META[product.type];

  return (
    <Link
      to={`/kids/market/product/${product.slug}`}
      className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4 transition-transform hover:scale-[1.02] hover:border-kids-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-4xl" aria-hidden="true">{product.thumbnail_url ? "🖼️" : product.emoji}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {meta ? t(meta.labelKey) : product.type}
        </span>
      </div>
      <p className="font-heading text-sm font-bold leading-tight">{product.title}</p>
      {product.description && <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>}

      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        <StarRating value={product.rating_avg} size={12} />
        <span>({product.rating_count})</span>
        <span className="flex items-center gap-0.5"><Download className="h-3 w-3" aria-hidden="true" /> {product.downloads}</span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[10px] font-medium text-muted-foreground">{t("kids.market.ages")} {product.age_min}–{product.age_max}</span>
        {product.is_free ? (
          <span className="rounded-full bg-kids-green/15 px-2.5 py-1 text-xs font-bold text-kids-green">{t("kids.market.free")}</span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-bold text-kids-accent">
            <Coins className="h-3.5 w-3.5" aria-hidden="true" /> {product.price_coins.toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  );
}
