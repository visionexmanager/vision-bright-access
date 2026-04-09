import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ShoppingBag, BookOpen, Sparkles, UserPlus, Zap, Gift, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import heroImg from "@/assets/hero-illustration.jpg";

export default function Index() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();

  const features = [
    { icon: ShoppingBag, title: t("home.feature.marketplace"), desc: t("home.feature.marketplaceDesc"), to: "/marketplace" },
    { icon: Eye, title: t("home.feature.services"), desc: t("home.feature.servicesDesc"), to: "/services" },
    { icon: BookOpen, title: t("home.feature.content"), desc: t("home.feature.contentDesc"), to: "/content" },
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
      <section className="relative px-4 py-20 text-center overflow-hidden" aria-labelledby="hero-heading">
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="" className="h-full w-full object-cover opacity-15 dark:opacity-10" width={1280} height={720} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background" />
        </div>
        <AnimatedSection variants={scaleFade} className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-base font-semibold">{t("home.badge")}</span>
          </div>
          <h1 id="hero-heading" className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t("home.title")}
            <span className="text-primary">{t("home.titleHighlight")}</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">{t("home.subtitle")}</p>
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
            <Link to="/marketplace">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" onClick={() => playSound("navigate")}>{t("home.exploreMarketplace")}</Button>
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 px-4 py-16" aria-labelledby="how-heading">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <h2 id="how-heading" className="mb-12 text-center text-3xl font-bold">{t("home.howTitle")}</h2>
          </AnimatedSection>
          <StaggerGrid className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <StaggerItem key={s.num}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <s.icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="absolute -end-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-sm font-bold shadow border">{s.num}</span>
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
      <section className="px-4 py-16" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <h2 id="features-heading" className="mb-10 text-center text-3xl font-bold">{t("home.featuresTitle")}</h2>
          </AnimatedSection>
          <StaggerGrid className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <Link to={f.to} className="group" onClick={() => playSound("navigate")}>
                  <Card className="h-full transition-shadow hover:shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-ring">
                    <CardContent className="flex flex-col items-start gap-4 p-8">
                      <div className="rounded-xl bg-primary/10 p-3">
                        <f.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xl font-bold">{f.title}</h3>
                      <p className="text-muted-foreground">{f.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* Points CTA */}
      <section className="bg-muted/50 px-4 py-16 text-center" aria-labelledby="points-heading">
        <AnimatedSection className="mx-auto max-w-2xl">
          <h2 id="points-heading" className="mb-4 text-3xl font-bold">{t("home.pointsTitle")}</h2>
          <p className="mb-6 text-lg text-muted-foreground">{t("home.pointsDesc")}</p>
          {user ? (
            <Link to="/dashboard">
              <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>{t("nav.dashboard")} <ArrowRight className="ms-2 h-5 w-5" /></Button>
            </Link>
          ) : (
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>{t("home.claimPoints")}</Button>
            </Link>
          )}
        </AnimatedSection>
      </section>
    </Layout>
  );
}
