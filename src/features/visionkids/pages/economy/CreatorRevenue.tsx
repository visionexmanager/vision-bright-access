import { Coins, Download, Package, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreatorStats, useMyProducts } from "@/features/visionkids/hooks/market/useMarketCreator";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

/** Reuses the Phase 13 marketplace creator earnings — one revenue view. */
export default function CreatorRevenue() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = useCreatorStats();
  const { data: products = [] } = useMyProducts();

  useDocumentHead({ title: `${t("kids.economy.nav.creatorRevenue")} — VisionKids`, description: t("kids.economy.creatorRevenue.subtitle"), canonicalPath: "/kids/economy/creator-revenue" });

  const tiles = stats ? [
    { icon: Coins, label: t("kids.economy.creatorRevenue.earnings"), value: stats.earnings.toLocaleString() },
    { icon: Download, label: t("kids.economy.creatorRevenue.downloads"), value: stats.downloads },
    { icon: Package, label: t("kids.economy.creatorRevenue.published"), value: stats.published },
    { icon: Star, label: t("kids.economy.creatorRevenue.avgRating"), value: stats.avg_rating },
  ] : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="💰" title={t("kids.economy.nav.creatorRevenue")} subtitle={t("kids.economy.creatorRevenue.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <tile.icon className="h-6 w-6 text-kids-primary" aria-hidden="true" />
                <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">{tile.label}</span>
              </div>
            ))}
          </div>
          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.economy.creatorRevenue.byProduct")}</h2>
            {products.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("kids.economy.creatorRevenue.noProducts")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {products.filter((p) => p.status === "published").map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 text-sm">
                    <span aria-hidden="true">{p.emoji}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Download className="h-3.5 w-3.5" aria-hidden="true" /> {p.downloads}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-kids-accent"><Coins className="h-3.5 w-3.5" aria-hidden="true" /> {p.price_coins}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
