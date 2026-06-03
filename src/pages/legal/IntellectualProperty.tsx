import { Layout } from "@/components/Layout";
import { Copyright, FileText, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NOTICE_ITEMS = [1, 2, 3, 4, 5];
const COUNTER_ITEMS = [1, 2, 3, 4];
const TIMELINE_STEPS = [
  { key: "receive", days: "1" },
  { key: "review", days: "3" },
  { key: "notify", days: "2" },
  { key: "decision", days: "5" },
];

export default function IntellectualProperty() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Copyright className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.ip.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Platform Ownership */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.ip.platformTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.ip.platformBody")}</p>
        </div>

        {/* User Content License */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.ip.licenseTitle")}</h2>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{t("legal.ip.licenseBody")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.ip.licenseRetain")}</p>
        </div>

        {/* Report Infringement */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{t("legal.ip.reportTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.ip.reportIntro")}</p>
          <ol className="space-y-3">
            {NOTICE_ITEMS.map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {i}
                </span>
                {t(`legal.ip.notice.${i}`)}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 font-medium">{t("legal.ip.noticeWarning")}</p>
        </div>

        {/* Processing Timeline */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.ip.timelineTitle")}</h2>
          <div className="space-y-3">
            {TIMELINE_STEPS.map(({ key, days }) => (
              <div key={key} className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-xs font-bold text-primary">{days}d</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{t(`legal.ip.timeline.${key}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`legal.ip.timeline.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Counter-Notice */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.ip.counterTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.ip.counterIntro")}</p>
          <ul className="space-y-2.5">
            {COUNTER_ITEMS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(`legal.ip.counter.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Repeat Infringers */}
        <div className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p className="font-semibold text-sm text-destructive">{t("legal.ip.repeatTitle")}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t("legal.ip.repeatBody")}</p>
        </div>

        {/* Bad Faith */}
        <div className="mb-8 rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>{t("legal.ip.badFaithLabel")}</strong> {t("legal.ip.badFaithBody")}
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.ip.contact")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>{" "}
            — {t("legal.ip.contactSubject")}
          </p>
        </div>
      </section>
    </Layout>
  );
}
