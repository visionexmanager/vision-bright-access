import { useState } from "react";
import { Coins, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useRedeemables, useRedemptionSlugs, useCoinBalance, useRedeemReward } from "@/features/visionkids/hooks/economy/useEconomy";
import { REDEEM_CATEGORIES, ECON_COLOR_CLASSES } from "@/features/visionkids/data/economyConfig";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";
import type { RedeemableCategory } from "@/features/visionkids/types/economy.types";

export default function RedeemCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [category, setCategory] = useState<RedeemableCategory | "all">("all");
  const { data: items = [], isLoading } = useRedeemables(category);
  const { data: owned = [] } = useRedemptionSlugs();
  const { data: balance = 0 } = useCoinBalance();
  const redeem = useRedeemReward();
  const [error, setError] = useState<string | null>(null);

  useDocumentHead({ title: `${t("kids.economy.nav.redeem")} — VisionKids`, description: t("kids.economy.redeem.subtitle"), canonicalPath: "/kids/economy/redeem" });

  const ownedSet = new Set(owned);

  async function doRedeem(slug: string) {
    setError(null);
    try { await redeem.mutateAsync(slug); } catch (e) { setError(e instanceof Error ? e.message : t("kids.economy.redeem.failed")); setTimeout(() => setError(null), 3500); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🎟️" title={t("kids.economy.nav.redeem")} subtitle={t("kids.economy.redeem.subtitle")} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
        <span className="flex items-center gap-2 font-heading text-lg font-bold"><Coins className="h-6 w-6 text-kids-accent" aria-hidden="true" /> {balance.toLocaleString()} {t("kids.economy.coins")}</span>
      </div>
      {error && <p className="mt-2 rounded-xl border-2 border-kids-pink/40 bg-kids-pink/10 p-3 text-sm font-semibold text-kids-pink" role="alert">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {REDEEM_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-current={category === c ? "true" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${category === c ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            {t(`kids.economy.redeemCategory.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const isOwned = ownedSet.has(item.slug);
            const affordable = balance >= item.cost_coins;
            return (
              <div key={item.slug} className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center ${ECON_COLOR_CLASSES[item.color]}`}>
                <span className="text-4xl" aria-hidden="true">{item.emoji}</span>
                <p className="font-heading text-sm font-bold leading-tight">{item.name}</p>
                <span className="flex items-center gap-1 text-sm font-bold"><Coins className="h-3.5 w-3.5" aria-hidden="true" /> {item.cost_coins.toLocaleString()}</span>
                {isOwned ? (
                  <span className="mt-auto inline-flex items-center gap-1 rounded-full bg-kids-green/20 px-3 py-1.5 text-xs font-bold text-kids-green"><Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.economy.redeem.owned")}</span>
                ) : (
                  <button type="button" onClick={() => doRedeem(item.slug)} disabled={!user || !affordable || redeem.isPending}
                    className="mt-auto rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.economy.redeem.get")}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.economy.signInHint")}</p>}
    </div>
  );
}
