import { Link } from "react-router-dom";
import { Check, Clock, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMySubscriptions, useApproveSubscription, useCancelSubscription, usePlans } from "@/features/visionkids/hooks/economy/useEconomy";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function SubscriptionManagement() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: subs = [], isLoading } = useMySubscriptions();
  const { data: plans = [] } = usePlans();
  const approve = useApproveSubscription();
  const cancel = useCancelSubscription();

  useDocumentHead({ title: `${t("kids.economy.nav.subscriptions")} — VisionKids`, description: t("kids.economy.subscriptions.subtitle"), canonicalPath: "/kids/economy/subscriptions" });

  const planName = new Map(plans.map((p) => [p.slug, p.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🔄" title={t("kids.economy.nav.subscriptions")} subtitle={t("kids.economy.subscriptions.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : subs.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center">
          <p className="text-muted-foreground">{t("kids.economy.subscriptions.none")}</p>
          <Link to="/kids/economy/plans" className="mt-3 inline-block rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90">{t("kids.economy.subscriptions.browse")}</Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-heading font-bold leading-tight">{planName.get(s.plan_slug) ?? s.plan_slug}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {s.status === "active" && <Check className="h-3.5 w-3.5 text-kids-green" aria-hidden="true" />}
                  {s.status === "pending_parent" && <Clock className="h-3.5 w-3.5 text-kids-accent" aria-hidden="true" />}
                  {t(`kids.economy.subStatus.${s.status}`)}
                </p>
              </div>
              {s.status === "pending_parent" && (
                <button type="button" onClick={() => approve.mutate(s.id)} disabled={approve.isPending}
                  className="rounded-full bg-kids-green px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.economy.subscriptions.approve")}</button>
              )}
              {(s.status === "active" || s.status === "pending_parent") && (
                <button type="button" onClick={() => cancel.mutate(s.id)} disabled={cancel.isPending}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-border px-3 py-1.5 text-xs font-bold hover:border-kids-pink/50 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.economy.subscriptions.cancel")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/kids/economy/invoices" className="font-semibold text-kids-primary hover:underline">{t("kids.economy.nav.invoices")}</Link>
      </p>
    </div>
  );
}
