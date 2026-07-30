import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { EARN_WAYS } from "@/features/visionkids/data/economyConfig";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function RewardsCenter() {
  const { t } = useLanguage();
  useDocumentHead({ title: `${t("kids.economy.nav.rewards")} — VisionKids`, description: t("kids.economy.rewards.subtitle"), canonicalPath: "/kids/economy/rewards" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🎁" title={t("kids.economy.nav.rewards")} subtitle={t("kids.economy.rewards.subtitle")} />
      <p className="mt-4 text-muted-foreground">{t("kids.economy.rewards.intro")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {EARN_WAYS.map((w) => (
          <Link key={w.key} to={w.to} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-transform hover:scale-[1.02] hover:border-kids-primary/50">
            <span className="text-3xl" aria-hidden="true">{w.emoji}</span>
            <div>
              <p className="font-heading font-bold leading-tight">{t(`kids.economy.earn.${w.key}.title`)}</p>
              <p className="text-sm text-muted-foreground">{t(`kids.economy.earn.${w.key}.desc`)}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t("kids.economy.rewards.redeemHint")} <Link to="/kids/economy/redeem" className="font-semibold text-kids-primary hover:underline">{t("kids.economy.nav.redeem")}</Link>
      </p>
    </div>
  );
}
