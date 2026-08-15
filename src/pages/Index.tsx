import { Layout } from "@/components/Layout";
import { AdBanner } from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  ArrowRight,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CheckCircle,
  Coins,
  FileCog,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartHandshake,
  LineChart,
  Lock,
  Newspaper,
  PlayCircle,
  Rocket,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { VisionKidsHomeSection } from "@/components/VisionKidsHomeSection";
import arcadeHero from "@/features/arcade/assets/visionex-arcade-hero.webp";
import { ARCADE_GAMES } from "@/features/arcade/catalog";
import { categoryLabel, difficultyLabel } from "@/features/arcade/labels";

/**
 * Home page information architecture (single source of truth for the page):
 *
 *   1. Hero            — who Visionex is for and the two primary actions.
 *   2. Directory       — every public destination, grouped by purpose.
 *   3. How it works    — the four onboarding steps.
 *   4. Spotlights      — Arcade, VisionKids, Career Center (one band each).
 *   5. Rewards CTA     — trial / VX coins.
 *
 * Destinations live in DESTINATION_GROUPS below and nowhere else on this page,
 * so a section can never quietly duplicate a link that already has a home. The
 * groups mirror the Navbar and footer sitemap: anything reachable from either
 * has exactly one card here.
 */

interface Destination {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  to: string;
  /** Only for routes that genuinely refuse anonymous visitors (AuthGuard or a redirect). */
  requiresAuth?: boolean;
}

interface DestinationGroup {
  id: string;
  labelKey: string;
  items: Destination[];
}

const DESTINATION_GROUPS: DestinationGroup[] = [
  {
    id: "market",
    labelKey: "home.group.market",
    items: [
      { icon: ShoppingBag, titleKey: "home.feature.marketplace", descKey: "home.feature.marketplaceDesc", to: "/bazaar" },
      { icon: HeartHandshake, titleKey: "home.feature.services", descKey: "home.feature.servicesDesc", to: "/services" },
      { icon: WandSparkles, titleKey: "nav.aiStudio", descKey: "home.feature.aiDesc", to: "/services/ai-media-studio" },
      { icon: FileCog, titleKey: "nav.fileConverter", descKey: "fileStudio.desc", to: "/services/file-studio" },
      { icon: Accessibility, titleKey: "nav.assistiveProducts", descKey: "vep.subtitle", to: "/assistive-products" },
    ],
  },
  {
    id: "learn",
    labelKey: "home.group.learn",
    items: [
      { icon: GraduationCap, titleKey: "home.feature.academy", descKey: "home.feature.academyDesc", to: "/academy", requiresAuth: true },
      { icon: BookOpen, titleKey: "nav.library", descKey: "library.home.heroSubtitle", to: "/library" },
      { icon: PlayCircle, titleKey: "nav.content", descKey: "content.subtitle", to: "/content" },
      { icon: Newspaper, titleKey: "nav.news", descKey: "news.subtitle", to: "/news" },
    ],
  },
  {
    id: "play",
    labelKey: "home.group.play",
    items: [
      { icon: Gamepad2, titleKey: "nav.games", descKey: "games.subtitle", to: "/games" },
      { icon: Rocket, titleKey: "nav.kids", descKey: "kids.hero.subtitle", to: "/kids" },
      { icon: Users, titleKey: "nav.community", descKey: "community.subtitle", to: "/community" },
      { icon: Trophy, titleKey: "leader.title", descKey: "leader.subtitle", to: "/leaderboard" },
    ],
  },
  {
    id: "work",
    labelKey: "home.group.work",
    items: [
      { icon: BriefcaseBusiness, titleKey: "career.title", descKey: "career.subtitle", to: "/careers" },
      { icon: LineChart, titleKey: "nav.finance", descKey: "home.link.financeDesc", to: "/finance" },
      { icon: Coins, titleKey: "nav.coins", descKey: "coins.subtitle", to: "/coins-store" },
      { icon: Wrench, titleKey: "nav.professionalTools", descKey: "home.link.toolsDesc", to: "/professional-tools" },
      { icon: Bot, titleKey: "home.feature.ai", descKey: "home.feature.aiDesc", to: "/dashboard", requiresAuth: true },
    ],
  },
];

export default function Index() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();

  const steps = [
    { icon: UserPlus, title: t("home.step1"), desc: t("home.step1d"), num: "1" },
    { icon: Zap, title: t("home.step2"), desc: t("home.step2d"), num: "2" },
    { icon: Gift, title: t("home.step3"), desc: t("home.step3d"), num: "3" },
    { icon: TrendingUp, title: t("home.step4"), desc: t("home.step4d"), num: "4" },
  ];

  const featuredGames = ARCADE_GAMES.filter((game) => game.featured).slice(0, 3);

  return (
    <Layout>
      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
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
          {/* Short promise only. The full platform description now introduces the
              directory below, where a reader who wants the detail is already looking. */}
          <p className="mb-8 mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            {t("home.tagline")}
          </p>

          {!user && (
            <div className="mb-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm">
              {[t("home.highlight.trial"), t("home.highlight.noCard"), t("home.highlight.allFeatures")].map((highlight) => (
                <span key={highlight} className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {highlight}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="px-8 py-6 text-lg font-semibold">
              <Link to={user ? "/dashboard" : "/signup"} onClick={() => playSound("navigate")}>
                {user ? t("nav.dashboard") : t("home.getStarted")}
                <ArrowRight className="ms-2 h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8 py-6 text-lg">
              <Link to="/bazaar" onClick={() => playSound("navigate")}>{t("home.exploreMarketplace")}</Link>
            </Button>
          </div>
        </AnimatedSection>
      </section>

      {/* ── 2. Directory — every destination, grouped by purpose ─────────────── */}
      <section className="px-4 pb-20" aria-labelledby="explore-heading">
        <div className="section-container">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <p className="type-overline mb-3">{t("home.featuresTitle")}</p>
              <h2 id="explore-heading" className="type-heading mb-5">{t("home.featuresSubtitle")}</h2>
              <p className="mx-auto max-w-3xl text-muted-foreground leading-relaxed">{t("home.subtitle")}</p>
            </div>
          </AnimatedSection>

          <div className="flex flex-col gap-12">
            {DESTINATION_GROUPS.map((group) => (
              <div key={group.id}>
                <div className="mb-5 flex items-center gap-4">
                  <h3 id={`home-group-${group.id}`} className="text-sm font-bold uppercase tracking-widest text-foreground/70">
                    {t(group.labelKey)}
                  </h3>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>

                <StaggerGrid role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const locked = !user && item.requiresAuth;

                    return (
                      <StaggerItem key={item.to} role="listitem">
                        <Link
                          to={locked ? "/signup" : item.to}
                          onClick={() => playSound("navigate")}
                          className="group flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            {locked && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                {t("nav.signup")}
                              </span>
                            )}
                          </span>
                          <span className="text-base font-bold leading-snug">{t(item.titleKey)}</span>
                          <span className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{t(item.descKey)}</span>
                          <ArrowRight
                            className="mt-auto h-4 w-4 self-end text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                            aria-hidden="true"
                          />
                        </Link>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. How it works ─────────────────────────────────────────────────── */}
      <section className="bg-muted/30 py-20" aria-labelledby="how-heading">
        <div className="section-container">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <p className="type-overline mb-3">{t("home.howTitle")}</p>
              <h2 id="how-heading" className="type-heading">{t("home.howSubtitle")}</h2>
            </div>
          </AnimatedSection>
          <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <StaggerItem key={step.num}>
                <div className="relative flex h-full flex-col gap-4 rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm">
                  {index < steps.length - 1 && (
                    <div
                      className="absolute top-9 start-[calc(100%-0.5rem)] hidden h-px w-[calc(100%-3rem+1rem)] border-t border-dashed border-primary/20 lg:block"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-3xl font-black text-primary/15" aria-hidden="true">{step.num}</span>
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-base font-bold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── 4a. Spotlight — Visionex Arcade ─────────────────────────────────── */}
      <section className="px-4 py-20" aria-labelledby="home-arcade-heading">
        <div className="section-container">
          <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-[#070914] text-white shadow-2xl">
            <img
              src={arcadeHero}
              alt=""
              loading="lazy"
              decoding="async"
              width={1672}
              height={941}
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070914] via-[#070914]/90 to-[#070914]/45 rtl:bg-gradient-to-l" aria-hidden="true" />

            <div className="relative grid gap-8 p-7 md:grid-cols-[1.1fr_.9fr] md:p-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Visionex Arcade</p>
                <h2 id="home-arcade-heading" className="mt-2 text-3xl font-black sm:text-4xl">{t("nav.games")}</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-slate-200">{t("home.arcade.desc")}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-violet-100">
                    <Link to="/games" onClick={() => playSound("navigate")}>
                      <Gamepad2 className="me-2 h-5 w-5" aria-hidden="true" />
                      {t("nav.games")}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/20 text-white hover:bg-white/10 hover:text-white">
                    <Link to={user ? "/games/tournaments" : "/signup"} onClick={() => playSound("navigate")}>
                      {t("home.arcade.tournaments")}
                    </Link>
                  </Button>
                </div>
              </div>

              <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                {featuredGames.map((game) => (
                  <li key={game.slug}>
                    <Link
                      to={game.to}
                      onClick={() => playSound("navigate")}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur transition-colors hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      <img
                        src={game.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-20 shrink-0 rounded-xl object-cover"
                      />
                      <span className="min-w-0">
                        <strong className="block truncate">{lang === "ar" ? game.titleAr : game.title}</strong>
                        <small className="text-slate-400">{categoryLabel(t, game.categories[0])} · {difficultyLabel(t, game.difficulty)}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4b. Spotlight — VisionKids ──────────────────────────────────────── */}
      <VisionKidsHomeSection />

      {/* ── 4c. Spotlight — Career Center ───────────────────────────────────── */}
      <section className="px-4 pb-20" aria-labelledby="home-career-heading">
        <div className="section-container">
          <AnimatedSection>
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-8 sm:p-12">
              <div
                className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative mx-auto max-w-3xl text-center">
                <p className="type-overline mb-3 inline-flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("careerCenter.badge")}
                </p>
                <h2 id="home-career-heading" className="type-heading mb-3">{t("careerCenter.title")}</h2>
                <p className="mb-4 text-lg font-semibold text-primary">{t("careerCenter.subtitle")}</p>
                <p className="mb-8 leading-relaxed text-muted-foreground">{t("careerCenter.description")}</p>
                <Button asChild size="lg" className="px-8 py-6 text-lg font-semibold">
                  <Link to="/careers" onClick={() => playSound("navigate")}>
                    {t("careerCenter.findJobs")}
                    <ArrowRight className="ms-2 h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── 5. Rewards CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 text-center" aria-labelledby="points-heading">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,hsl(var(--primary)/0.10),transparent)]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" aria-hidden="true" />
        <AnimatedSection className="relative mx-auto max-w-2xl">
          <p className="type-overline mb-4 text-primary">VX Rewards</p>
          <h2 id="points-heading" className="type-heading mb-4">{t("home.pointsTitle")}</h2>
          <p className="mx-auto mb-8 max-w-lg text-muted-foreground">{t("home.pointsDesc")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8 font-semibold">
              <Link to={user ? "/dashboard" : "/signup"} onClick={() => playSound("navigate")}>
                {user ? t("nav.dashboard") : t("home.claimPoints")}
                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 font-semibold">
              <Link to="/coins-store" onClick={() => playSound("navigate")}>
                <Coins className="me-2 h-4 w-4" aria-hidden="true" />
                {t("home.buyCoins")}
              </Link>
            </Button>
          </div>
        </AnimatedSection>
      </section>

      <AdBanner slot="3569383992" format="horizontal" className="section-container pb-16" />
    </Layout>
  );
}
