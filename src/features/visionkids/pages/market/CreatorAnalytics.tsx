import { Coins, Download, Star, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyProducts, useCreatorStats } from "@/features/visionkids/hooks/market/useMarketCreator";
import { STATUS_BADGE, MARKET_COLOR_CLASSES } from "@/features/visionkids/data/marketConfig";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";

export default function CreatorAnalytics() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = useCreatorStats();
  const { data: products = [] } = useMyProducts();

  useDocumentHead({
    title: `${t("kids.market.nav.analytics")} — VisionKids`,
    description: t("kids.market.analytics.subtitle"),
    canonicalPath: "/kids/market/analytics",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="📊" title={t("kids.market.nav.analytics")} subtitle={t("kids.market.analytics.subtitle")} backTo="/kids/market/creator" backLabelKey="kids.market.nav.creatorDashboard" />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.signInHint")}</p>
      ) : (
        <>
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("kids.market.dash.published"), value: stats.published, icon: Package },
                { label: t("kids.market.dash.downloads"), value: stats.downloads, icon: Download },
                { label: t("kids.market.dash.earnings"), value: stats.earnings, icon: Coins },
                { label: t("kids.market.dash.avgRating"), value: stats.avg_rating, icon: Star },
              ].map((tile) => (
                <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                  <tile.icon className="h-6 w-6 text-kids-primary" aria-hidden="true" />
                  <span className="font-heading text-2xl font-extrabold">{tile.value.toLocaleString?.() ?? tile.value}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{tile.label}</span>
                </div>
              ))}
            </div>
          )}

          <section className="mt-8">
            <h2 className="font-heading text-xl font-bold">{t("kids.market.analytics.perProduct")}</h2>
            {products.length === 0 ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.dash.noProducts")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 text-start">{t("kids.market.dash.title")}</th>
                      <th className="px-2 py-2">{t("kids.market.dash.status")}</th>
                      <th className="px-2 py-2">{t("kids.market.dash.downloads")}</th>
                      <th className="px-2 py-2">{t("kids.market.dash.rating")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const badge = STATUS_BADGE[p.status];
                      return (
                        <tr key={p.id} className="border-b border-border/60">
                          <td className="px-2 py-2"><span aria-hidden="true">{p.emoji}</span> {p.title}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${MARKET_COLOR_CLASSES[badge.color]}`}>{t(badge.labelKey)}</span>
                          </td>
                          <td className="px-2 py-2 text-center font-semibold">{p.downloads}</td>
                          <td className="px-2 py-2 text-center font-semibold">{p.rating_avg} ({p.rating_count})</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
