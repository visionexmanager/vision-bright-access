import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShoppingBag, Mic, GraduationCap, Gamepad2, Wrench,
  Globe, Shield, Zap, Heart, ArrowRight, Sparkles,
} from "lucide-react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";

const PILLARS = [
  {
    icon: ShoppingBag,
    titleKey: "home.feature.marketplace",
    descKey:  "home.feature.marketplaceDesc",
    color:    "bg-primary/10 text-primary",
    to:       "/bazaar",
  },
  {
    icon: Wrench,
    titleKey: "home.feature.services",
    descKey:  "home.feature.servicesDesc",
    color:    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    to:       "/services",
  },
  {
    icon: GraduationCap,
    titleKey: "home.feature.content",
    descKey:  "home.feature.contentDesc",
    color:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    to:       "/content",
  },
  {
    icon: Gamepad2,
    titleKey: "nav.games",
    descKey:  "dash.playGamesLinkDesc",
    color:    "bg-green-500/10 text-green-600 dark:text-green-400",
    to:       "/games",
  },
  {
    icon: Mic,
    titleKey: "footer.link.community",
    descKey:  "home.feature.servicesDesc",
    color:    "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    to:       "/community",
  },
  {
    icon: Globe,
    titleKey: "footer.link.academy",
    descKey:  "services.catLearn",
    color:    "bg-primary/10 text-primary",
    to:       "/academy",
  },
] as const;

const VALUES = [
  { icon: Globe,   titleKey: "about.value.global",       descKey: "about.value.globalDesc"      },
  { icon: Shield,  titleKey: "about.value.trust",        descKey: "about.value.trustDesc"       },
  { icon: Zap,     titleKey: "about.value.innovation",   descKey: "about.value.innovationDesc"  },
  { icon: Heart,   titleKey: "about.value.community",    descKey: "about.value.communityDesc"   },
] as const;

export default function About() {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center" aria-labelledby="about-heading">
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,hsl(var(--primary)/0.12),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
        <AnimatedSection variants={scaleFade} className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("about.badge") || "Our Story"}
          </div>
          <h1 id="about-heading" className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t("about.title") || "Building the Platform"}{" "}
            <span className="text-primary">{t("about.titleHighlight") || "for Everyone"}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            {t("about.subtitle") ||
              "VisionEx is a multilingual, all-in-one digital platform that combines commerce, learning, entertainment, and community in a single seamless experience — powered by a real-value points economy."}
          </p>
          {!user && (
            <Link to="/signup">
              <Button size="lg" className="font-semibold">
                {t("home.getStarted")} <ArrowRight className="ms-2 h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
          )}
        </AnimatedSection>
      </section>

      {/* Mission */}
      <section className="bg-muted/30 py-16" aria-labelledby="mission-heading">
        <AnimatedSection className="section-container mx-auto max-w-3xl text-center">
          <h2 id="mission-heading" className="mb-4 text-3xl font-bold">{t("about.missionTitle") || "Our Mission"}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t("about.missionDesc") ||
              "To make high-quality digital services, education, and community accessible to every person regardless of language, location, or ability — by building tools that are intuitive, inclusive, and rewarding to use."}
          </p>
        </AnimatedSection>
      </section>

      {/* Platform pillars */}
      <section className="py-20" aria-labelledby="pillars-heading">
        <div className="section-container">
          <AnimatedSection className="mb-12 text-center">
            <h2 id="pillars-heading" className="text-3xl font-bold">
              {t("about.pillarsTitle") || "What We Offer"}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("about.pillarsDesc") || "Six interconnected pillars that form the complete VisionEx experience"}
            </p>
          </AnimatedSection>
          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <StaggerItem key={p.to}>
                  <Link to={p.to} className="group block h-full">
                    <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/30">
                      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${p.color}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-bold">{t(p.titleKey)}</h3>
                      <p className="text-sm text-muted-foreground">{t(p.descKey)}</p>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-primary/10 bg-primary/5 py-20" aria-labelledby="values-heading">
        <div className="section-container">
          <AnimatedSection className="mb-12 text-center">
            <h2 id="values-heading" className="text-3xl font-bold">{t("about.valuesTitle") || "Our Values"}</h2>
          </AnimatedSection>
          <StaggerGrid className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <StaggerItem key={v.titleKey}>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-bold">{t(v.titleKey) || v.titleKey.split(".").pop()}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(v.descKey) || ""}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* Languages / Global reach */}
      <section className="py-16" aria-labelledby="global-heading">
        <AnimatedSection className="section-container mx-auto max-w-3xl text-center">
          <h2 id="global-heading" className="mb-4 text-3xl font-bold">
            {t("about.globalTitle") || "Built for the World"}
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            {t("about.globalDesc") ||
              "VisionEx supports 11 languages with full RTL support for Arabic and Urdu, ensuring every user feels at home regardless of where they are or what language they speak."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["🇺🇸 English","🇸🇦 العربية","🇪🇸 Español","🇩🇪 Deutsch","🇫🇷 Français",
              "🇧🇷 Português","🇨🇳 中文","🇹🇷 Türkçe","🇷🇺 Русский","🇮🇳 हिन्दी","🇵🇰 اردو"]
              .map((lang) => (
                <span
                  key={lang}
                  className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium"
                >
                  {lang}
                </span>
              ))}
          </div>
        </AnimatedSection>
      </section>

      {/* CTA */}
      {!user && (
        <section className="bg-muted/50 py-12 text-center" aria-labelledby="cta-heading">
          <AnimatedSection className="section-container mx-auto max-w-2xl">
            <h2 id="cta-heading" className="mb-3 text-2xl font-bold">{t("home.pointsTitle")}</h2>
            <p className="mb-6 text-muted-foreground">{t("home.pointsDesc")}</p>
            <Link to="/signup">
              <Button size="default" className="font-semibold">
                {t("home.getStarted")} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </AnimatedSection>
        </section>
      )}
    </Layout>
  );
}
