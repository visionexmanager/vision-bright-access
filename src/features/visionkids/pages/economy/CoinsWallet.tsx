import { Coins, Star, Award, Gift } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEconomySummary, usePointsHistory } from "@/features/visionkids/hooks/economy/useEconomy";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function CoinsWallet() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: s } = useEconomySummary();
  const { data: history = [] } = usePointsHistory();

  useDocumentHead({ title: `${t("kids.economy.nav.wallet")} — VisionKids`, description: t("kids.economy.wallet.subtitle"), canonicalPath: "/kids/economy/wallet" });

  const tiles = s ? [
    { icon: Coins, label: t("kids.economy.coins"), value: s.coins.toLocaleString(), color: "text-kids-accent" },
    { icon: Award, label: t("kids.economy.badges"), value: s.badges, color: "text-kids-primary" },
    { icon: Star, label: t("kids.economy.wallet.redemptions"), value: s.redemptions, color: "text-kids-purple" },
    { icon: Gift, label: t("kids.economy.pendingGifts"), value: s.pending_gifts, color: "text-kids-pink" },
  ] : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🪙" title={t("kids.economy.nav.wallet")} subtitle={t("kids.economy.wallet.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <tile.icon className={`h-6 w-6 ${tile.color}`} aria-hidden="true" />
                <span className="font-heading text-xl font-extrabold">{tile.value}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">{tile.label}</span>
              </div>
            ))}
          </div>

          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.economy.wallet.history")}</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("kids.economy.wallet.noHistory")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{h.reason}</span>
                    <span className={`font-bold ${h.points >= 0 ? "text-kids-green" : "text-kids-pink"}`}>{h.points >= 0 ? "+" : ""}{h.points}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
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
