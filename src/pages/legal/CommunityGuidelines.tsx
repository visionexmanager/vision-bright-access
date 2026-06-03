import { Layout } from "@/components/Layout";
import { Users, Heart, ShieldAlert, Mic, ShoppingBag, Coins, Gavel, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PolicyCrossLinks } from "@/components/PolicyCrossLinks";

const CROSS_LINKS = [
  { to: "/enforcement-appeals", labelKey: "footer.link.enforcementAppeals" },
  { to: "/terms-of-use",        labelKey: "footer.link.termsOfUse" },
  { to: "/marketplace-policy",  labelKey: "footer.link.marketplacePolicy" },
];

const PRINCIPLES = [
  {
    icon: Heart,
    key: "respect",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    count: 4,
  },
  {
    icon: ShieldAlert,
    key: "prohibited",
    color: "text-destructive",
    bg: "bg-destructive/10",
    count: 6,
  },
  {
    icon: Mic,
    key: "voice",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    count: 5,
  },
  {
    icon: ShoppingBag,
    key: "marketplace",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    count: 5,
  },
  {
    icon: Coins,
    key: "rewards",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    count: 4,
  },
  {
    icon: CheckCircle2,
    key: "content",
    color: "text-green-500",
    bg: "bg-green-500/10",
    count: 5,
  },
];

const ENFORCEMENT = [
  { key: "warning", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" },
  { key: "restriction", color: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400" },
  { key: "suspension", color: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400" },
  { key: "ban", color: "border-destructive/30 bg-destructive/5 text-destructive" },
  { key: "legal", color: "border-primary/30 bg-primary/5 text-primary" },
];

export default function CommunityGuidelines() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.community.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="leading-relaxed text-muted-foreground">
            {t("legal.community.intro1")}
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {t("legal.community.intro2")}
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {PRINCIPLES.map(({ icon: Icon, key, color, bg, count }) => (
            <div key={key} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h2 className="text-lg font-bold">{t(`legal.community.principle.${key}.title`)}</h2>
              </div>
              <ul className="space-y-2.5">
                {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${color.replace("text-", "bg-")}`} />
                    {t(`legal.community.principle.${key}.rule.${i}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Reporting */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.community.reportingTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("legal.community.reportingBody")}
          </p>
        </div>

        {/* Enforcement */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.community.enforcementTitle")}</h2>
          </div>
          <div className="space-y-3">
            {ENFORCEMENT.map((e) => (
              <div key={e.key} className={`rounded-xl border p-4 ${e.color}`}>
                <p className="font-semibold text-sm">{t(`legal.community.enforcement.${e.key}.level`)}</p>
                <p className="mt-0.5 text-xs opacity-90">{t(`legal.community.enforcement.${e.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Appeals */}
        <div className="rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>{t("legal.community.appealsLabel")}</strong> {t("legal.community.appealsBody1")}{" "}
          <a href="mailto:hello@visionex.app" className="text-primary underline">hello@visionex.app</a>{" "}
          {t("legal.community.appealsBody2")}
        </div>

        <PolicyCrossLinks links={CROSS_LINKS} />
      </section>
    </Layout>
  );
}
