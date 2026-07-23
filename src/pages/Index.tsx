import { Layout } from "@/components/Layout";
import { AdBanner } from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Eye, Radio, ShoppingBag, BookOpen, GraduationCap, UserPlus, Users, Zap, Gift, TrendingUp, Gamepad2, CheckCircle, Lock, Coins, BriefcaseBusiness, WandSparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { CareerCenterSection } from "@/components/career/CareerCenterSection";

export default function Index() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();

  const features = [
    { icon: ShoppingBag, title: t("home.feature.marketplace"), desc: t("home.feature.marketplaceDesc"), to: "/bazaar",                   requiresAuth: false },
    { icon: Eye,         title: t("home.feature.services"),    desc: t("home.feature.servicesDesc"),    to: "/services",                  requiresAuth: false },
    { icon: BookOpen,    title: t("home.feature.content"),     desc: t("home.feature.contentDesc"),     to: "/content",                   requiresAuth: false },
    { icon: GraduationCap, title: t("home.feature.academy"),   desc: t("home.feature.academyDesc"),     to: "/academy",                   requiresAuth: true },
    { icon: Radio,       title: t("home.feature.entertainment"), desc: t("home.feature.entertainmentDesc"), to: "/services",              requiresAuth: false },
    { icon: Users,       title: t("home.feature.community"),    desc: t("home.feature.communityDesc"),    to: "/community",                requiresAuth: true },
    { icon: Bot,         title: t("home.feature.ai"),           desc: t("home.feature.aiDesc"),           to: "/dashboard",                requiresAuth: true },
    { icon: Gamepad2,    title: t("nav.games"),                desc: t("dash.playGamesLinkDesc"),        to: "/games",                     requiresAuth: true },
  ];

  const featuredSections = [
    { icon: BookOpen, title: t("nav.library"), desc: t("library.home.heroSubtitle"), to: "/library", requiresAuth: false },
    { icon: BriefcaseBusiness, title: t("career.title"), desc: t("career.subtitle"), to: "/careers", requiresAuth: false },
    { icon: GraduationCap, title: t("home.feature.academy"), desc: t("home.feature.academyDesc"), to: "/academy", requiresAuth: true },
    { icon: WandSparkles, title: t("nav.aiStudio"), desc: t("home.feature.aiDesc"), to: "/services/ai-media-studio", requiresAuth: true },
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
          <h1 id="hero-heading" className="type-display mb-6 text-balance">
            {t("home.title")}
            <span className="text-primary">{t("home.titleHighlight")}</span>
          </h1>
          <p className="mb-6 mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">{t("home.subtitle")}</p>

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

      {/* Primary destinations */}
      <section className="relative z-10 -mt-8 px-4 pb-12" aria-label={t("home.featuresTitle")}>
        <StaggerGrid className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredSections.map((section) => {
            const Icon = section.icon;
            const locked = !user && section.requiresAuth;

            return (
              <StaggerItem key={section.to}>
                <Link
                  to={locked ? "/signup" : section.to}
                  className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                  onClick={() => playSound("navigate")}
                >
                  <Card className="h-full overflow-hidden border-border/60 bg-card/95 shadow-lg shadow-black/5 backdrop-blur transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-xl">
                    <CardContent className="flex h-full min-h-48 flex-col p-6">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="rounded-xl bg-primary/10 p-3 text-primary">
                          <Icon className="h-7 w-7" aria-hidden="true" />
                        </div>
                        {locked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            {t("home.getStarted")}
                          </span>
                        )}
                      </div>
                      <h2 className="mb-2 text-xl font-bold">{section.title}</h2>
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{section.desc}</p>
                      <ArrowRight className="mt-auto h-5 w-5 self-end text-primary transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* How It Works */}
      <section className="py-20" aria-labelledby="how-heading">
        <div className="section-container">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <p className="type-overline mb-3">{t("home.howTitle")}</p>
              <h2 id="how-heading" className="type-heading">{t("home.howSubtitle") || t("home.howTitle")}</h2>
            </div>
          </AnimatedSection>
          <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, idx) => (
              <StaggerItem key={s.num}>
                <div className="relative flex flex-col gap-4 rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/30 hover:shadow-sm transition-all">
                  {/* Connector line between steps on desktop */}
                  {idx < steps.length - 1 && (
                    <div className="absolute top-9 start-[calc(100%-0.5rem)] hidden h-px w-[calc(100%-3rem+1rem)] border-t border-dashed border-primary/20 lg:block" aria-hidden="true" />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-3xl font-black text-primary/15" aria-hidden="true">{s.num}</span>
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-base font-bold">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-20" aria-labelledby="features-heading">
        <div className="section-container">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <p className="type-overline mb-3">{t("home.featuresTitle")}</p>
              <h2 id="features-heading" className="type-heading">{t("home.featuresSubtitle") || t("home.featuresTitle")}</h2>
            </div>
          </AnimatedSection>
          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              const isFirst = i === 0;
              const locked = !user && f.requiresAuth;
              return (
                <StaggerItem key={f.title} className={isFirst ? "sm:col-span-2 lg:col-span-2" : ""}>
                  <Link to={locked ? "/signup" : f.to} className="group h-full block" onClick={() => playSound("navigate")}>
                    <Card className={`h-full transition-all duration-200 group-focus-visible:ring-4 group-focus-visible:ring-ring relative overflow-hidden ${
                      isFirst
                        ? "bg-primary text-primary-foreground border-primary hover:brightness-110 hover:shadow-xl hover:shadow-primary/20"
                        : "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
                    }`}>
                      {isFirst && (
                        <div className="absolute -bottom-6 -end-6 h-32 w-32 rounded-full bg-white/5" aria-hidden="true" />
                      )}
                      {locked && !isFirst && (
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
                            ? "bg-white/15 p-4"
                            : "bg-primary/10 p-3"
                        }`}>
                          <Icon
                            className={isFirst ? "h-9 w-9 text-primary-foreground" : "h-7 w-7 text-primary"}
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className={`font-bold ${isFirst ? "text-2xl text-primary-foreground" : "text-lg"}`}>{f.title}</h3>
                        <p className={isFirst ? "text-primary-foreground/80" : "text-sm text-muted-foreground"}>{f.desc}</p>
                        {isFirst && (
                          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-foreground/90 group-hover:gap-2 transition-all">
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
      <section className="relative overflow-hidden px-4 py-16 text-center" aria-labelledby="points-heading">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,hsl(var(--primary)/0.10),transparent)]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" aria-hidden="true" />
        <AnimatedSection className="relative mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
            VX Rewards
          </div>
          <h2 id="points-heading" className="type-heading mb-4">{t("home.pointsTitle")}</h2>
          <p className="mb-8 text-muted-foreground max-w-lg mx-auto">{t("home.pointsDesc")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button size="lg" className="font-semibold px-8" onClick={() => playSound("navigate")}>{t("nav.dashboard")} <ArrowRight className="ms-2 h-4 w-4" /></Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button size="lg" className="font-semibold px-8" onClick={() => playSound("navigate")}>{t("home.claimPoints")}</Button>
              </Link>
            )}
            <Link to="/coins-store">
              <Button size="lg" variant="outline" className="font-semibold px-8" onClick={() => playSound("navigate")}>
                <Coins className="me-2 h-4 w-4" aria-hidden="true" /> {t("home.buyCoins")}
              </Button>
            </Link>
          </div>
        </AnimatedSection>

        {/* AdSense — bottom of home page */}
        <AdBanner slot="3569383992" format="horizontal" className="mt-10 px-4" />
      </section>

      <CareerCenterSection />
    </Layout>
  );
}
