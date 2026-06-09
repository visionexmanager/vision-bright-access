import { Layout } from "@/components/Layout";
import { Gavel, ShieldAlert, Bell, RefreshCw, XCircle, Scale } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const LEVELS = [
  { key: "warning",     color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" },
  { key: "restriction", color: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400" },
  { key: "suspension",  color: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400" },
  { key: "permanent",   color: "border-destructive/30 bg-destructive/5 text-destructive" },
  { key: "legal",       color: "border-primary/30 bg-primary/5 text-primary" },
];

const IMMEDIATE_BAN = [1, 2, 3, 4, 5];
const FACTORS = [1, 2, 3, 4];
const APPEAL_STEPS = [1, 2, 3];
const APPEAL_TIMELINE = [
  { key: "submit", period: "14d" },
  { key: "confirm", period: "2d" },
  { key: "review", period: "14d" },
];
const NON_APPEALABLE = [1, 2, 3];

export default function EnforcementAppeals() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Scale className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.enforce.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Principle */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.enforce.principleTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.enforce.principleBody")}</p>
        </div>

        {/* Enforcement Levels */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.enforce.levelsTitle")}</h2>
          </div>
          <div className="space-y-3">
            {LEVELS.map(({ key, color }) => (
              <div key={key} className={`rounded-xl border p-4 ${color}`}>
                <p className="font-semibold text-sm">{t(`legal.enforce.level.${key}.label`)}</p>
                <p className="mt-1 text-xs opacity-90">{t(`legal.enforce.level.${key}.desc`)}</p>
                <p className="mt-1.5 text-xs opacity-70 italic">{t(`legal.enforce.level.${key}.trigger`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Immediate Ban Cases */}
        <div className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold text-destructive">{t("legal.enforce.immTitle")}</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t("legal.enforce.immIntro")}</p>
          <ul className="space-y-2.5">
            {IMMEDIATE_BAN.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {t(`legal.enforce.imm.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Factors */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.enforce.factorsTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FACTORS.map((i) => (
              <div key={i} className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                {t(`legal.enforce.factor.${i}`)}
              </div>
            ))}
          </div>
        </div>

        {/* Notification */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.enforce.notifTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.enforce.notifBody")}</p>
        </div>

        {/* Appeals */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.enforce.appealTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.enforce.appealIntro")}</p>

          {/* Steps */}
          <ol className="mb-6 space-y-3">
            {APPEAL_STEPS.map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i}
                </span>
                {t(`legal.enforce.appealStep.${i}`)}
              </li>
            ))}
          </ol>

          {/* Timeline */}
          <h3 className="mb-3 font-semibold text-sm">{t("legal.enforce.timelineTitle")}</h3>
          <div className="space-y-2">
            {APPEAL_TIMELINE.map(({ key, period }) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{period}</span>
                <p className="text-xs text-muted-foreground">{t(`legal.enforce.appealTime.${key}`)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground italic">{t("legal.enforce.timelineNote")}</p>
        </div>

        {/* Non-appealable */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">{t("legal.enforce.nonAppealTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {NON_APPEALABLE.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {t(`legal.enforce.nonAppeal.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Content Removal */}
        <div className="mb-8 rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>{t("legal.enforce.removalLabel")}</strong> {t("legal.enforce.removalBody")}
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.enforce.contact")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>{" "}
            — {t("legal.enforce.contactSubject")}
          </p>
        </div>
      </section>
    </Layout>
  );
}
