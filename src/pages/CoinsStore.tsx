import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Clock, Play, BookOpen, Gamepad2, Briefcase, Trophy } from "lucide-react";
import { COIN_PACKAGES, calculatePackageTotal } from "@/systems/coinsSystem";
import { WatchAdButton } from "@/components/WatchAdButton";
import { Link } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem } from "@/components/AnimatedSection";

const EARN_METHODS = [
  { icon: Play,      labelKey: "dash.watchAd",       descKey: "dash.watchAdDesc",       reward: "+5 VX",      to: "/dashboard" },
  { icon: BookOpen,  labelKey: "dash.engageContent",  descKey: "dash.engageContentDesc", reward: "+10–50 VX",  to: "/content" },
  { icon: Briefcase, labelKey: "dash.useServices",    descKey: "dash.useServicesDesc",   reward: "+60–120 VX", to: "/services" },
  { icon: Gamepad2,  labelKey: "dash.playGamesLink",  descKey: "dash.playGamesLinkDesc", reward: "+VX",        to: "/games" },
];

export default function CoinsStore() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { totalPoints } = usePoints();

  return (
    <Layout>
      <section className="section-container py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <Coins className="mx-auto mb-3 h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">{t("coins.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("coins.subtitle")}</p>
          {user && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-lg font-bold text-primary">
              <Coins className="h-5 w-5" />
              {totalPoints.toLocaleString()} VX
            </div>
          )}
        </div>

        <WatchAdButton variant="card" className="mb-8" />

        {/* Earn for free section — featured */}
        <AnimatedSection>
          <div className="mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="mb-1 text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {t("coins.earningTitle")}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">{t("coins.earningDesc")}</p>
            <StaggerGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EARN_METHODS.map((m) => (
                <StaggerItem key={m.to}>
                  <Link to={m.to} className="group block">
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <m.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t(m.labelKey)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t(m.descKey)}</p>
                        <Badge className="mt-1.5 text-xs">{m.reward}</Badge>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGrid>
          </div>
        </AnimatedSection>

        {!user && (
          <div className="mb-8 rounded-lg border bg-muted/50 p-6 text-center">
            <p className="mb-3 text-muted-foreground">{t("coins.loginPrompt")}</p>
            <Button asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        )}

        {/* Purchase packages — visually de-emphasised with Coming Soon */}
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-muted-foreground">{t("coins.purchaseTitle")}</h2>
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-muted-foreground/30">
            <Clock className="h-3 w-3" /> {t("coins.comingSoonDesc")}
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-50 pointer-events-none select-none">
          {COIN_PACKAGES.map((pkg) => {
            const { fee, total } = calculatePackageTotal(pkg.price);
            return (
              <Card key={pkg.coins} className="relative">
                <CardHeader className="text-center">
                  <CardTitle className="text-3xl font-extrabold text-primary">
                    {pkg.coins.toLocaleString()} VX
                  </CardTitle>
                  <CardDescription className="text-base">${pkg.price}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t("coins.fee")}</span>
                    <span>${fee}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>{t("coins.total")}</span>
                    <span>${total}</span>
                  </div>
                  <Button className="w-full" disabled>
                    <Clock className="mr-2 h-4 w-4" />
                    {t("coins.purchaseTitle")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
