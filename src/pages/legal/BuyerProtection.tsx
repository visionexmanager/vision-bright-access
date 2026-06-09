import { Layout } from "@/components/Layout";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, MessageSquare, Gavel } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const COVERED = [1, 2, 3];
const NOT_COVERED = [1, 2, 3, 4];
const DISPUTE_STEPS = [1, 2, 3];
const VISIONEX_ACTIONS = [1, 2, 3, 4, 5];

const TIMELINE = [
  { key: "receive", icon: Clock },
  { key: "seller", icon: MessageSquare },
  { key: "decision", icon: Gavel },
];

export default function BuyerProtection() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.buyer.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Commitment */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.buyer.commitTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.buyer.commitBody")}</p>
        </div>

        {/* What's Covered */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-bold">{t("legal.buyer.coveredTitle")}</h2>
          </div>
          <ul className="space-y-3">
            {COVERED.map((i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border bg-green-500/5 border-green-500/20 p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {t(`legal.buyer.covered.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* What's NOT Covered */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{t("legal.buyer.notCoveredTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {NOT_COVERED.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {t(`legal.buyer.notCovered.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* How to Report */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.buyer.reportTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.buyer.reportIntro")}</p>
          <ol className="space-y-3">
            {DISPUTE_STEPS.map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i}
                </span>
                {t(`legal.buyer.step.${i}`)}
              </li>
            ))}
          </ol>
        </div>

        {/* Review Timeline */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.buyer.timelineTitle")}</h2>
          </div>
          <div className="space-y-3">
            {TIMELINE.map(({ key, icon: Icon }) => (
              <div key={key} className="flex items-start gap-4 rounded-xl border bg-muted/30 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t(`legal.buyer.timeline.${key}.label`)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`legal.buyer.timeline.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground italic">{t("legal.buyer.timelineNote")}</p>
        </div>

        {/* Visionex Actions */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.buyer.actionsTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {VISIONEX_ACTIONS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(`legal.buyer.action.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Refund */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.buyer.refundTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.buyer.refundBody")}</p>
        </div>

        {/* Appeal */}
        <div className="mb-8 rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>{t("legal.buyer.appealLabel")}</strong> {t("legal.buyer.appealBody")}
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.buyer.contact")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>{" "}
            — {t("legal.buyer.contactSubject")}
          </p>
        </div>
      </section>
    </Layout>
  );
}
