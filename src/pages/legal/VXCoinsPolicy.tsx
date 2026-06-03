import { Layout } from "@/components/Layout";
import { Coins, TrendingUp, ShoppingBag, ShieldAlert, RefreshCw, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const EARN_WAYS = [1, 2, 3, 4, 5];
const SPEND_WAYS = [1, 2, 3, 4, 5];
const RESTRICTIONS = [1, 2, 3, 4];
const PROHIBITED = [1, 2, 3, 4];
const TERMINATION_CASES = [
  { key: "violation", color: "border-destructive/30 bg-destructive/5 text-destructive" },
  { key: "suspension", color: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400" },
  { key: "voluntary", color: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400" },
];

export default function VXCoinsPolicy() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Coins className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.vxcoins.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        {/* What Are VX Coins */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.vxcoins.whatTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.vxcoins.whatBody")}</p>
        </div>

        {/* How to Earn */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-bold">{t("legal.vxcoins.earnTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {EARN_WAYS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                {t(`legal.vxcoins.earn.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* How to Spend */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.vxcoins.spendTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {SPEND_WAYS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(`legal.vxcoins.spend.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Core Restrictions */}
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{t("legal.vxcoins.restrictTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {RESTRICTIONS.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {t(`legal.vxcoins.restrict.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Real-Money Purchases */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">{t("legal.vxcoins.purchaseTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.vxcoins.purchaseBody")}</p>
        </div>

        {/* Account Status & Coins */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold">{t("legal.vxcoins.accountTitle")}</h2>
          <div className="space-y-3">
            {TERMINATION_CASES.map(({ key, color }) => (
              <div key={key} className={`rounded-xl border p-4 ${color}`}>
                <p className="font-semibold text-sm">{t(`legal.vxcoins.account.${key}.label`)}</p>
                <p className="mt-0.5 text-xs opacity-90">{t(`legal.vxcoins.account.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Modifications */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t("legal.vxcoins.modifyTitle")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.vxcoins.modifyBody")}</p>
        </div>

        {/* Prohibited */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">{t("legal.vxcoins.prohibTitle")}</h2>
          </div>
          <ul className="space-y-2.5">
            {PROHIBITED.map((i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {t(`legal.vxcoins.prohib.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.vxcoins.contact")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>{" "}
            {t("legal.vxcoins.contactSubject")}
          </p>
        </div>
      </section>
    </Layout>
  );
}
