import { useMemo, useState } from "react";
import { Coins, Check, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMarketItems } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useInventory } from "@/features/visionkids/hooks/world/useWorldProgress";
import { useCoinBalance, useBuyItem } from "@/features/visionkids/hooks/world/useWorldEconomy";
import { MARKET_CATEGORIES, RARITY_RING } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import { WorldRewardBanner } from "@/features/visionkids/components/world/WorldRewardBanner";
import type { ItemCategory } from "@/features/visionkids/types/world.types";

export default function Marketplace() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const { data: items = [], isLoading } = useMarketItems(category);
  const { data: inventory = [] } = useInventory();
  const { data: balance = 0 } = useCoinBalance();
  const buy = useBuyItem();

  const [bought, setBought] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentHead({
    title: `${t("kids.world.nav.marketplace")} — VisionKids`,
    description: t("kids.world.marketplace.subtitle"),
    canonicalPath: "/kids/world/marketplace",
  });

  const ownedSet = useMemo(() => new Set(inventory.map((i) => i.item_slug)), [inventory]);

  async function purchase(slug: string) {
    setError(null);
    try {
      await buy.mutateAsync(slug);
      setBought(true);
      setTimeout(() => setBought(false), 2800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("kids.world.marketplace.buyFailed"));
      setTimeout(() => setError(null), 3500);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🛒" title={t("kids.world.nav.marketplace")} subtitle={t("kids.world.marketplace.subtitle")} />

      {/* Balance + no-real-money note */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
        <span className="flex items-center gap-2 font-heading text-lg font-bold">
          <Coins className="h-6 w-6 text-kids-accent" aria-hidden="true" /> {balance.toLocaleString()} {t("kids.world.coins")}
        </span>
        <span className="text-xs font-medium text-muted-foreground">🔒 {t("kids.world.marketplace.noRealMoney")}</span>
      </div>

      <WorldRewardBanner show={bought} message={t("kids.world.marketplace.boughtMsg")} />
      {error && <p className="mb-2 rounded-xl border-2 border-kids-pink/40 bg-kids-pink/10 p-3 text-sm font-semibold text-kids-pink" role="alert">{error}</p>}

      {/* Category filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {MARKET_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-current={category === c ? "true" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${category === c ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            {t(`kids.world.category.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const owned = ownedSet.has(item.slug);
            const affordable = balance >= item.price_coins;
            return (
              <div key={item.slug} className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center ring-2 ${RARITY_RING[item.rarity]}`}>
                <span className="text-4xl" aria-hidden="true">{item.emoji}</span>
                <p className="font-heading text-sm font-bold leading-tight">{item.title}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`kids.world.rarity.${item.rarity}`)}</span>
                <span className="flex items-center gap-1 text-sm font-bold text-kids-accent">
                  <Coins className="h-3.5 w-3.5" aria-hidden="true" /> {item.price_coins.toLocaleString()}
                </span>
                {owned ? (
                  <span className="mt-auto inline-flex items-center gap-1 rounded-full bg-kids-green/15 px-3 py-1.5 text-xs font-bold text-kids-green">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.world.marketplace.owned")}
                  </span>
                ) : (
                  <button type="button" onClick={() => purchase(item.slug)} disabled={!user || !affordable || buy.isPending}
                    className="mt-auto inline-flex items-center gap-1 rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                    {!affordable && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("kids.world.marketplace.buy")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.world.marketplace.signInHint")}</p>}
    </div>
  );
}
