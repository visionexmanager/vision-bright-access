import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Gamepad2, GraduationCap, FlaskConical, Wrench, UserCog, TrendingUp, Coins } from "lucide-react";
import {
  GAMING_PRICES, ACADEMY_PRICES, SIMULATION_PRICES,
  TECH_SERVICE_PRICES, ACCOUNT_PRICES, EARNING_RATES,
  formatVX, vxToUsd,
} from "@/systems/pricingSystem";

interface PriceRow { label: string; vx: number; earning?: boolean }

function PriceTable({ rows }: { rows: PriceRow[] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">{r.label}</span>
          <div className="flex items-center gap-2">
            <Badge variant={r.earning ? "default" : "secondary"} className="font-mono text-sm">
              {r.earning ? "+" : ""}{formatVX(r.vx)}
            </Badge>
            <span className="text-xs text-muted-foreground">({vxToUsd(r.vx)})</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Pricing() {
  const { t } = useLanguage();

  const sections = [
    {
      icon: Gamepad2, title: t("pricing.gaming"),
      color: "text-violet-500", bg: "bg-violet-500/10",
      rows: [
        { label: t("pricing.gamingSingle"), vx: GAMING_PRICES.singlePlay },
        { label: t("pricing.gamingFull"), vx: GAMING_PRICES.fullGameUnlock },
        { label: t("pricing.gamingWeekly"), vx: GAMING_PRICES.weeklyPass },
      ],
    },
    {
      icon: GraduationCap, title: t("pricing.academy"),
      color: "text-blue-500", bg: "bg-blue-500/10",
      rows: [
        { label: t("pricing.academyMini"), vx: ACADEMY_PRICES.miniCourse },
        { label: t("pricing.academyIntermediate"), vx: ACADEMY_PRICES.intermediateCourse },
        { label: t("pricing.academyPro"), vx: ACADEMY_PRICES.professionalMasterclass },
        { label: t("pricing.academyCert"), vx: ACADEMY_PRICES.digitalCertificate },
      ],
    },
    {
      icon: FlaskConical, title: t("pricing.simulations"),
      color: "text-amber-500", bg: "bg-amber-500/10",
      rows: [
        { label: t("pricing.simSingle"), vx: SIMULATION_PRICES.singleSession },
        { label: t("pricing.simMonthly"), vx: SIMULATION_PRICES.monthlyPass },
        { label: t("pricing.simLifetime"), vx: SIMULATION_PRICES.lifetimeAccess },
      ],
    },
    {
      icon: Wrench, title: t("pricing.techServices"),
      color: "text-emerald-500", bg: "bg-emerald-500/10",
      rows: [
        { label: t("pricing.techFile"), vx: TECH_SERVICE_PRICES.fileDownload },
        { label: t("pricing.techChat"), vx: TECH_SERVICE_PRICES.techConsultation },
        { label: t("pricing.techRemote"), vx: TECH_SERVICE_PRICES.remoteSupport },
      ],
    },
    {
      icon: UserCog, title: t("pricing.account"),
      color: "text-pink-500", bg: "bg-pink-500/10",
      rows: [
        { label: t("pricing.accountUsername"), vx: ACCOUNT_PRICES.changeUsername },
        { label: t("pricing.accountVip"), vx: ACCOUNT_PRICES.monthlyVip },
        { label: t("pricing.accountAds"), vx: ACCOUNT_PRICES.removeAds },
      ],
    },
    {
      icon: TrendingUp, title: t("pricing.earning"),
      color: "text-green-500", bg: "bg-green-500/10",
      rows: [
        { label: t("pricing.earnAd"), vx: EARNING_RATES.watchAd, earning: true },
        { label: t("pricing.earnRefer"), vx: EARNING_RATES.referFriend, earning: true },
        { label: t("pricing.earnLogin"), vx: EARNING_RATES.dailyLogin, earning: true },
      ],
    },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="mb-10 text-center">
            <Coins className="mx-auto mb-3 h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <StaggerItem key={s.title}>
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`rounded-xl p-3 ${s.bg}`}>
                    <s.icon className={`h-7 w-7 ${s.color}`} />
                  </div>
                  <CardTitle className="text-xl">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PriceTable rows={s.rows} />
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </Layout>
  );
}
