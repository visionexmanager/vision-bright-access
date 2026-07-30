import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMarketCategories, useProductSearch } from "@/features/visionkids/hooks/market/useMarketCatalog";
import { PRODUCT_LEVELS, SORT_OPTIONS } from "@/features/visionkids/data/marketConfig";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";
import { ProductCard } from "@/features/visionkids/components/market/ProductCard";
import type { ProductLevel, ProductSearch, ProductType } from "@/features/visionkids/types/market.types";

/** Generic browse/search page. When `fixedType` is set (type wrapper pages) the
 *  type facet is locked; otherwise (Discover) all facets show. Drives the whole
 *  catalog from one component — a new content type needs no new page code. */
export function ProductListPage({
  fixedType,
  emoji,
  title,
  subtitle,
  canonicalPath,
  showFilters = true,
}: {
  fixedType?: ProductType;
  emoji: string;
  title: string;
  subtitle?: string;
  canonicalPath: string;
  showFilters?: boolean;
}) {
  const { t } = useLanguage();
  const { data: categories = [] } = useMarketCategories();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<ProductLevel | "">("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<ProductSearch["sort"]>("newest");

  const search: ProductSearch = useMemo(() => ({
    type: fixedType,
    q: q.trim() || undefined,
    category: category || undefined,
    level: level || undefined,
    freeOnly: freeOnly || undefined,
    sort,
  }), [fixedType, q, category, level, freeOnly, sort]);

  const { data: products = [], isLoading } = useProductSearch(search);

  useDocumentHead({ title: `${title} — VisionKids`, description: subtitle ?? t("kids.market.meta.description"), canonicalPath });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <MarketHeader emoji={emoji} title={title} subtitle={subtitle} />

      {showFilters && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("kids.market.searchPlaceholder")}
              aria-label={t("kids.market.search")}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 ps-9"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("kids.market.filter.category")}
              className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium">
              <option value="">{t("kids.market.filter.allCategories")}</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value as ProductLevel | "")} aria-label={t("kids.market.filter.level")}
              className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium">
              <option value="">{t("kids.market.filter.allLevels")}</option>
              {PRODUCT_LEVELS.map((l) => <option key={l} value={l}>{t(`kids.market.level.${l}`)}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as ProductSearch["sort"])} aria-label={t("kids.market.filter.sort")}
              className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium">
              {SORT_OPTIONS.map((s) => <option key={s} value={s}>{t(`kids.market.sort.${s}`)}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-2 text-sm font-medium">
              <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-kids-primary" />
              {t("kids.market.filter.freeOnly")}
            </label>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.noProducts")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
