import { CheckCircle2, Clock, XCircle, DollarSign, Heart, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useFinancialReports } from "@/features/visionkids/hooks/economy/useEconomy";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function FinancialReports() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, error } = useFinancialReports();

  useDocumentHead({ title: `${t("kids.economy.nav.reports")} — VisionKids`, description: t("kids.economy.reports.subtitle"), canonicalPath: "/kids/economy/reports" });

  const tiles = data ? [
    { icon: CheckCircle2, label: t("kids.economy.reports.active"), value: data.active_subscriptions, color: "text-kids-green" },
    { icon: Clock, label: t("kids.economy.reports.pending"), value: data.pending_subscriptions, color: "text-kids-accent" },
    { icon: XCircle, label: t("kids.economy.reports.cancelled"), value: data.cancelled_subscriptions, color: "text-kids-pink" },
    { icon: DollarSign, label: t("kids.economy.reports.revenue"), value: `$${data.revenue_usd}`, color: "text-kids-primary" },
    { icon: Heart, label: t("kids.economy.reports.donations"), value: data.donations_coins.toLocaleString(), color: "text-kids-pink" },
    { icon: Coins, label: t("kids.economy.reports.creatorPayouts"), value: data.creator_payouts_coins.toLocaleString(), color: "text-kids-accent" },
  ] : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="📊" title={t("kids.economy.nav.reports")} subtitle={t("kids.economy.reports.subtitle")} />
      {!user || error ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.reports.adminOnly")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-5 text-center">
              <tile.icon className={`h-7 w-7 ${tile.color}`} aria-hidden="true" />
              <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
              <span className="text-xs font-semibold text-muted-foreground">{tile.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
