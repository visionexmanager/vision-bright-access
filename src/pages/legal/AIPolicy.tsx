import { Layout } from "@/components/Layout";
import { Brain, AlertTriangle, CheckCircle2, ShieldAlert, Zap, Eye, FileText, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const AI_FEATURES = [
  "assistant", "academy", "nutrition", "radar", "ocr", "enrich", "meal", "realtime",
];

const AI_ALLOWED = [1, 2, 3, 4];
const AI_PROHIBITED = [1, 2, 3, 4, 5, 6, 7, 8];
const LIMITATIONS = [1, 2, 3, 4, 5];
const PROHIBITED_TOPICS = [1, 2, 3, 4];

export default function AIPolicy() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.ai.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="leading-relaxed text-muted-foreground">{t("legal.ai.intro")}</p>
        </div>

        {/* AI Features List */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.ai.featuresTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.ai.featuresIntro")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_FEATURES.map((f) => (
              <div key={f} className="rounded-xl border bg-muted/30 p-3">
                <p className="text-sm font-semibold">{t(`legal.ai.feature.${f}.name`)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(`legal.ai.feature.${f}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.ai.howTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.ai.howBody")}</p>
        </div>

        {/* Limitations & Disclaimer */}
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{t("legal.ai.limitTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.ai.limitIntro")}</p>
          <ul className="space-y-2">
            {LIMITATIONS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {t(`legal.ai.limit.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Do NOT rely on AI for */}
        <div className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="mb-4 text-xl font-bold text-destructive">{t("legal.ai.prohibTopicsTitle")}</h2>
          <ul className="space-y-2">
            {PROHIBITED_TOPICS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {t(`legal.ai.prohibTopic.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Acceptable Use */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-bold">{t("legal.ai.allowedTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {AI_ALLOWED.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {t(`legal.ai.allowed.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Prohibited Use */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">{t("legal.ai.prohibTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {AI_PROHIBITED.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {t(`legal.ai.prohib.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Human Oversight */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.ai.oversightTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.ai.oversightBody")}</p>
        </div>

        {/* Data Usage */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.ai.dataTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.ai.dataBody")}</p>
        </div>

        {/* Report */}
        <div className="rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <strong>{t("legal.ai.reportLabel")}</strong>
          </div>
          {t("legal.ai.reportBody")}{" "}
          <a href="mailto:hello@visionex.app" className="text-primary underline">hello@visionex.app</a>{" "}
          {t("legal.ai.reportSubject")}
        </div>
      </section>
    </Layout>
  );
}
