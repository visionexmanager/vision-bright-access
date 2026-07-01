import { Layout } from "@/components/Layout";
import { ShoppingBag, ShieldX, AlertTriangle, CheckCircle2, Gavel } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const PROHIBITED = [
  { emoji: "🚫", key: "alcohol" },
  { emoji: "🔫", key: "weapons" },
  { emoji: "💊", key: "drugs" },
  { emoji: "🔞", key: "adult" },
  { emoji: "🎰", key: "gambling" },
  { emoji: "🧬", key: "health" },
  { emoji: "📦", key: "counterfeit" },
  { emoji: "☢️", key: "hazardous" },
  { emoji: "🐾", key: "wildlife" },
  { emoji: "📊", key: "pyramid" },
  { emoji: "🔏", key: "data" },
  { emoji: "⚔️", key: "hate" },
];

const ALLOWED = [
  "assistive",
  "education",
  "software",
  "arts",
  "electronics",
  "clothing",
  "home",
  "health",
  "services",
];

const ENFORCEMENT = [
  "listing",
  "shop",
  "account",
  "legal",
];

export default function MarketplacePolicy() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShoppingBag className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.market.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="leading-relaxed text-muted-foreground">
            {t("legal.market.intro1")}
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {t("legal.market.intro2")}
          </p>
        </div>

        {/* Prohibited */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">{t("legal.market.prohibitedTitle")}</h2>
          </div>
          <div className="space-y-3">
            {PROHIBITED.map((item, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border bg-card p-4">
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div>
                  <p className="font-semibold">{t(`legal.market.prohibited.${item.key}.title`)}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t(`legal.market.prohibited.${item.key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Age restriction */}
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{t("legal.market.ageTitle")}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("legal.market.ageBody")}
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
            {t("legal.market.ageNote")}
          </p>
        </div>

        {/* What's allowed */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-bold">{t("legal.market.allowedTitle")}</h2>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <ul className="space-y-2.5">
              {ALLOWED.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {t(`legal.market.allowed.${item}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Seller responsibilities */}
        <div className="mb-8 rounded-2xl border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold">{t("legal.market.sellerTitle")}</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <li key={i} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t(`legal.market.seller.${i}`)}</li>
            ))}
          </ul>
        </div>

        {/* Enforcement */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.market.enforcementTitle")}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENFORCEMENT.map((item) => (
              <div key={item} className="rounded-xl border bg-card p-4">
                <p className="font-semibold text-sm">{t(`legal.market.enforcement.${item}.title`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`legal.market.enforcement.${item}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>{t("legal.market.updatesLabel")}</strong> {t("legal.market.updatesBody")}{" "}
          <a href="mailto:hello@visionex.app" className="text-primary underline">hello@visionex.app</a>.
        </div>
      </section>
    </Layout>
  );
}
