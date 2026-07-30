import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Check, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePlans, useSubscribe } from "@/features/visionkids/hooks/economy/useEconomy";
import { ECON_COLOR_CLASSES } from "@/features/visionkids/data/economyConfig";

export function EconomyHeader({
  emoji, title, subtitle, backTo = "/kids/economy", backLabelKey = "kids.economy.heroTitle",
}: { emoji: string; title: string; subtitle?: string; backTo?: string; backLabelKey?: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(backLabelKey)}
      </Link>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl"><span aria-hidden="true">{emoji}</span> {title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Generic plans page shared by Membership / Family / School / NGO — filters the
 *  one plan catalog by audience. Subscribing routes children through parent
 *  approval automatically (server-side). */
export function PlansView({
  audience, emoji, title, subtitle, canonicalPath,
}: { audience?: string; emoji: string; title: string; subtitle: string; canonicalPath: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: plans = [], isLoading } = usePlans(audience);
  const subscribe = useSubscribe();
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({ title: `${title} — VisionKids`, description: subtitle, canonicalPath });

  async function choose(slug: string) {
    setMsg(null);
    try {
      const res = await subscribe.mutateAsync({ planSlug: slug });
      setMsg(res.status === "pending_parent" ? t("kids.economy.plans.pendingParent") : t("kids.economy.plans.subscribed"));
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("kids.economy.plans.failed"));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji={emoji} title={title} subtitle={subtitle} />
      <p className="mt-3 rounded-xl border-2 border-dashed border-border bg-card p-3 text-xs text-muted-foreground">🔒 {t("kids.economy.plans.parentNote")}</p>
      {msg && <p className="mt-3 rounded-xl border-2 border-border bg-card p-3 text-sm font-semibold" role="status">{msg}</p>}

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.slug} className={`flex flex-col gap-3 rounded-2xl border-2 p-5 ${ECON_COLOR_CLASSES[p.color]}`}>
              <div className="flex items-center gap-2">
                <span className="text-3xl" aria-hidden="true">{p.emoji}</span>
                <div>
                  <p className="font-heading text-lg font-bold leading-tight">{p.name}</p>
                  <p className="text-sm font-semibold">{p.price_usd > 0 ? `$${p.price_usd}/${t(`kids.economy.period.${p.period}`)}` : t("kids.economy.plans.freeOrContact")}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {f}</li>
                ))}
              </ul>
              <button type="button" onClick={() => choose(p.slug)} disabled={!user || subscribe.isPending}
                className="mt-auto rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                {p.price_usd > 0 ? t("kids.economy.plans.choose") : t("kids.economy.plans.getStarted")}
              </button>
            </div>
          ))}
        </div>
      )}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.economy.signInHint")}</p>}
    </div>
  );
}

export { Clock };
