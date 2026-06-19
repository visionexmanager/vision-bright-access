import { Layout } from "@/components/Layout";
import { AdBanner } from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Bot, Eye, Radio, ShoppingBag, BookOpen, UserPlus, Users, Zap, Gift, TrendingUp, Gamepad2, CheckCircle, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";

export default function Index() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const { playSound } = useSound();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const features = [
    { icon: ShoppingBag, title: t("home.feature.marketplace"), desc: t("home.feature.marketplaceDesc"), to: "/bazaar",                   requiresAuth: false },
    { icon: Eye,         title: t("home.feature.services"),    desc: t("home.feature.servicesDesc"),    to: "/services",                  requiresAuth: false },
    { icon: BookOpen,    title: t("home.feature.content"),     desc: t("home.feature.contentDesc"),     to: "/content",                   requiresAuth: false },
    { icon: Radio,       title: t("home.feature.entertainment"), desc: t("home.feature.entertainmentDesc"), to: "/services",              requiresAuth: false },
    { icon: Users,       title: t("home.feature.community"),    desc: t("home.feature.communityDesc"),    to: "/community",                requiresAuth: true },
    { icon: Bot,         title: t("home.feature.ai"),           desc: t("home.feature.aiDesc"),           to: "/dashboard",                requiresAuth: true },
    { icon: Gamepad2,    title: t("nav.games"),                desc: t("dash.playGamesLinkDesc"),        to: "/games",                     requiresAuth: true },
  ];

  const steps = [
    { icon: UserPlus, title: t("home.step1"), desc: t("home.step1d"), num: "1" },
    { icon: Zap, title: t("home.step2"), desc: t("home.step2d"), num: "2" },
    { icon: Gift, title: t("home.step3"), desc: t("home.step3d"), num: "3" },
    { icon: TrendingUp, title: t("home.step4"), desc: t("home.step4d"), num: "4" },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative px-4 py-24 text-center overflow-hidden" aria-labelledby="hero-heading">
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,hsl(var(--primary)/0.13),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>
        <AnimatedSection variants={scaleFade} className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
            {t("home.badge")}
          </div>
          <h1 id="hero-heading" className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t("home.title")}
            <span className="text-primary">{t("home.titleHighlight")}</span>
          </h1>
          <p className="mb-6 mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">{t("home.subtitle")}</p>

          {/* Trial & highlights */}
          {!user && (
            <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                t("home.highlight.trial"),
                t("home.highlight.noCard"),
                t("home.highlight.allFeatures"),
              ].map(h => (
                <span key={h} className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {h}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Link to="/dashboard">
                <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>{t("nav.dashboard")} <ArrowRight className="ms-2 h-5 w-5" /></Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>{t("home.getStarted")} <ArrowRight className="ms-2 h-5 w-5" /></Button>
              </Link>
            )}
            <Link to="/bazaar">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" onClick={() => playSound("navigate")}>{t("home.exploreMarketplace")}</Button>
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-20" aria-labelledby="how-heading">
        <div className="section-container">
          <AnimatedSection>
            <h2 id="how-heading" className="mb-12 text-center text-3xl font-bold">{t("home.howTitle")}</h2>
          </AnimatedSection>
          <StaggerGrid className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, idx) => (
              <StaggerItem key={s.num}>
                <div className="relative flex flex-col items-center text-center">
                  {/* Connector line between steps on desktop */}
                  {idx < steps.length - 1 && (
                    <div className="absolute top-7 start-[calc(50%+2rem)] hidden h-px w-[calc(100%-4rem)] border-t border-dashed border-primary/20 lg:block" aria-hidden="true" />
                  )}
                  <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <s.icon className="h-6 w-6" aria-hidden="true" />
                    <span className="absolute -top-2.5 -end-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-black text-primary-foreground" aria-hidden="true">{s.num}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" aria-labelledby="features-heading">
        <div className="section-container">
          <AnimatedSection>
            <h2 id="features-heading" className="mb-12 text-center text-3xl font-bold">{t("home.featuresTitle")}</h2>
          </AnimatedSection>
          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              const isFirst = i === 0;
              const locked = !user && f.requiresAuth;
              return (
                <StaggerItem key={f.title} className={isFirst ? "sm:col-span-2 lg:col-span-2" : ""}>
                  <Link to={locked ? "/signup" : f.to} className="group" onClick={() => playSound("navigate")}>
                    <Card className={`h-full transition-all group-focus-visible:ring-4 group-focus-visible:ring-ring relative ${
                      isFirst
                        ? "bg-primary/5 border-primary/20 hover:shadow-lg hover:border-primary/40"
                        : "hover:shadow-md"
                    }`}>
                      {locked && (
                        <div className="absolute top-3 end-3">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            {t("home.getStarted")}
                          </span>
                        </div>
                      )}
                      <CardContent className={`flex flex-col items-start gap-3 ${isFirst ? "p-8" : "p-6"}`}>
                        <div className={`rounded-xl ${
                          isFirst
                            ? "bg-primary p-4 shadow-sm shadow-primary/25"
                            : "bg-primary/10 p-3"
                        }`}>
                          <Icon
                            className={`${isFirst ? "text-primary-foreground" : "text-primary"} ${isFirst ? "h-9 w-9" : "h-7 w-7"}`}
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className={`font-bold ${isFirst ? "text-2xl" : "text-lg"}`}>{f.title}</h3>
                        <p className={`text-muted-foreground ${isFirst ? "" : "text-sm"}`}>{f.desc}</p>
                        {isFirst && (
                          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                            {t("footer.link.bazaar")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* Points CTA */}
      <section className="border-t border-primary/10 bg-primary/5 px-4 py-12 text-center" aria-labelledby="points-heading">
        <AnimatedSection className="mx-auto max-w-2xl">
          <h2 id="points-heading" className="mb-4 text-3xl font-bold">{t("home.pointsTitle")}</h2>
          <p className="mb-6 text-muted-foreground">{t("home.pointsDesc")}</p>
          {user ? (
            <Link to="/dashboard">
              <Button size="default" className="font-semibold" onClick={() => playSound("navigate")}>{t("nav.dashboard")} <ArrowRight className="ms-2 h-4 w-4" /></Button>
            </Link>
          ) : (
            <Link to="/signup">
              <Button size="default" className="font-semibold" onClick={() => playSound("navigate")}>{t("home.claimPoints")}</Button>
            </Link>
          )}
        </AnimatedSection>

        {/* AdSense — bottom of home page */}
        <AdBanner slot="3569383992" format="horizontal" className="mt-8 px-4" />
      </section>
    </Layout>
  );
}
