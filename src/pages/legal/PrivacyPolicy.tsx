import { Layout } from "@/components/Layout";
import { Shield, Eye, Lock, Share2, UserCheck, Bell, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const DATA_COLLECTED = ["account", "marketplace", "vx", "ai", "voice", "community", "technical", "newsletter", "tools", "radar", "finance", "payments"];
const DATA_USE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const THIRD_PARTIES = ["supabase", "openai", "anthropic", "adsense", "livekit", "resend", "stripe", "coingecko"];
const USER_RIGHTS = [
  { icon: Eye, key: "access" },
  { icon: UserCheck, key: "correction" },
  { icon: Trash2, key: "deletion" },
  { icon: Lock, key: "restriction" },
  { icon: Share2, key: "portability" },
  { icon: Bell, key: "optout" },
];

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.privacy.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">{t("legal.privacy.intro")}</p>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">{t("legal.privacy.collectTitle")}</h2>
          <div className="space-y-5">
            {DATA_COLLECTED.map((item) => (
              <div key={item}>
                <h3 className="mb-1 font-semibold text-foreground">{t(`legal.privacy.collect.${item}.heading`)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(`legal.privacy.collect.${item}.text`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.privacy.useTitle")}</h2>
          <ul className="space-y-2.5">
            {DATA_USE.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(`legal.privacy.use.${item}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.privacy.cookiesTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.privacy.cookiesBody")} <span className="text-primary">g.co/adsettings</span>.</p>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.privacy.thirdTitle")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.privacy.thirdIntro")}</p>
          <div className="space-y-4">
            {THIRD_PARTIES.map((tp) => (
              <div key={tp} className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold text-sm">{t(`legal.privacy.third.${tp}.name`)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(`legal.privacy.third.${tp}.purpose`)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("legal.privacy.noSell")}</p>
        </div>

        {["sharing", "security", "retention", "children"].map((section, index) => (
          <div key={section} className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-xl font-bold">{index + 5}. {t(`legal.privacy.${section}.title`)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(`legal.privacy.${section}.body`)}</p>
          </div>
        ))}

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">9. {t("legal.privacy.rightsTitle")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("legal.privacy.rightsIntro")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {USER_RIGHTS.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{t(`legal.privacy.right.${key}.title`)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`legal.privacy.right.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("legal.privacy.rightsContact")} <span className="font-semibold text-primary">hello@visionex.app</span>.</p>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">10. {t("legal.privacy.international.title")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.privacy.international.body")}</p>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">11. {t("legal.privacy.changes.title")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.privacy.changes.body")}</p>
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.privacy.inquiries")} <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">hello@visionex.app</a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
