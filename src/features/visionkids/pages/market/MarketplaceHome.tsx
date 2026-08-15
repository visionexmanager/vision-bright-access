import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useProductSearch } from "@/features/visionkids/hooks/market/useMarketCatalog";
import { TYPE_PAGES, MARKET_COLOR_CLASSES, PRODUCT_TYPE_META } from "@/features/visionkids/data/marketConfig";
import { ProductCard } from "@/features/visionkids/components/market/ProductCard";

export default function MarketplaceHome() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: popular = [], isLoading } = useProductSearch({ sort: "popular" });

  useDocumentHead({
    title: t("kids.market.meta.title"),
    description: t("kids.market.meta.description"),
    canonicalPath: "/kids/market",
  });

  const typeList = Object.values(TYPE_PAGES);
  // Every type tile is a filter over the same catalog. While it is empty they
  // are ten dead ends dressed as a storefront, so the browse grid and the
  // "see all" link only appear once there is something behind them.
  const hasCatalog = popular.length > 0;

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">🛍️</span> {t("kids.market.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.market.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/market/discover" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-kids-primary to-kids-purple px-5 py-2.5 font-bold text-white hover:opacity-90">
            <Search className="h-5 w-5" aria-hidden="true" /> {t("kids.market.nav.discover")}
          </Link>
          <Link to="/kids/market/creator" className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            <Sparkles className="h-5 w-5" aria-hidden="true" /> {t("kids.market.becomeCreator")}
          </Link>
        </div>
        <p className="mt-3 text-xs font-medium text-muted-foreground">🔒 {t("kids.market.safetyNote")}</p>
      </motion.section>

      {/* Content types */}
      {hasCatalog && (
      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.market.browseByType")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {typeList.map((tp) => {
          const meta = PRODUCT_TYPE_META[tp.type];
          return (
            <Link key={tp.type} to={tp.canonicalPath}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-transform hover:scale-[1.03] ${MARKET_COLOR_CLASSES[meta.color]}`}>
              <span className="text-3xl" aria-hidden="true">{tp.emoji}</span>
              <span className="text-sm font-bold">{t(meta.labelKey)}</span>
            </Link>
          );
        })}
      </motion.nav>
      )}

      {/* Popular */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">{t("kids.market.popular")}</h2>
          {hasCatalog && <Link to="/kids/market/discover" className="text-sm font-semibold text-kids-primary hover:underline">{t("kids.market.seeAll")}</Link>}
        </div>
        {isLoading ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : popular.length === 0 ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.noProducts")}</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {popular.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </motion.div>
  );
}
