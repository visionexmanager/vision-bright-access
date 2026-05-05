import { Layout } from "@/components/Layout";
import { Accessibility, Keyboard, MonitorSmartphone, Volume2, Eye, Contrast, Globe, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const FEATURES = [
  { icon: Eye, key: "screenReader" },
  { icon: Keyboard, key: "keyboard" },
  { icon: Volume2, key: "voice" },
  { icon: Contrast, key: "contrast" },
  { icon: MonitorSmartphone, key: "responsive" },
  { icon: Globe, key: "multilingual" },
  { icon: Eye, key: "focus" },
  { icon: Volume2, key: "motion" },
];

const WCAG_PRINCIPLES = [
  "perceivable",
  "operable",
  "understandable",
  "robust",
];

export default function AccessibilityStatement() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Accessibility className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.access.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Commitment */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.access.commitmentTitle")}</h2>
          <p className="leading-relaxed text-muted-foreground">
            {t("legal.access.commitment1")}
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {t("legal.access.commitment2")}
          </p>
        </div>

        {/* WCAG Principles */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.access.wcagTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {WCAG_PRINCIPLES.map((p) => (
              <div key={p} className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold text-sm text-primary">{t(`legal.access.wcag.${p}.label`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`legal.access.wcag.${p}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold">{t("legal.access.featuresTitle")}</h2>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t(`legal.access.feature.${key}.title`)}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t(`legal.access.feature.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Known Limitations */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.access.limitationsTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("legal.access.limitationsIntro")}
          </p>
          <ul className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {t(`legal.access.limitation.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Assistive Technology Compatibility */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.access.testedTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-3">{t("legal.access.testedIntro")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {["NVDA (Windows)", "VoiceOver (macOS/iOS)", "JAWS (Windows)", "TalkBack (Android)", t("legal.access.keyboardOnly"), t("legal.access.zoom")].map((tool) => (
              <div key={tool} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium text-center">
                {tool}
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.access.feedbackTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("legal.access.feedbackBody")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">hello@visionex.app</a>{" "}
            {t("legal.access.feedbackResponse")}
          </p>
        </div>

        {/* Ongoing Commitment */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.access.reviewed")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
