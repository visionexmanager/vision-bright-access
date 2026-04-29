import { useState, useEffect, useId } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Megaphone, Package, Headphones, GraduationCap, MonitorSmartphone,
  ArrowRight, Truck, BarChart3, Heart, Briefcase, Music, Video,
  Coins, Scissors, Scale, Stethoscope, Brain, Sparkles, Users,
  Dumbbell, Plane, ScanLine, Globe, Cpu, CheckCircle, Clock, Trophy,
} from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";
import { Link, useNavigate } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import servicesImg from "@/assets/services-illustration.jpg";
import webDesignImg from "@/assets/service-web-design.jpg";
import digitalMarketingImg from "@/assets/service-digital-marketing.jpg";
import importImg from "@/assets/service-import.jpg";
import consultingImg from "@/assets/service-consulting.jpg";
import trainingImg from "@/assets/service-training.jpg";
import { supabase } from "@/integrations/supabase/client";
import { simulationImages } from "@/data/simulationImages";
import { SIMULATION_PRICES } from "@/systems/pricingSystem";
import { useVXWallet } from "@/hooks/useVXWallet";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────
type Category = "all" | "simulations" | "professional" | "learning";

interface SimRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  estimated_duration: number;
  subcategory: string;
}

interface ProgressRow {
  simulation_id: string;
  completed: boolean;
  score: number;
}

// ── Service data ───────────────────────────────────────────────────────
const PROFESSIONAL_SERVICES = [
  { icon: MonitorSmartphone, name: "services.webDesign",        desc: "services.webDesignDesc",        vx: 150_000, img: webDesignImg,        to: "/services/web-design",       color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { icon: Megaphone,         name: "services.digitalMarketing", desc: "services.digitalMarketingDesc", vx: 120_000, img: digitalMarketingImg, to: "/services/digital-marketing", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { icon: Package,           name: "services.importPurchasing", desc: "services.importPurchasingDesc", vx: 80_000,  img: importImg,           to: "/services/import-purchasing", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { icon: Headphones,        name: "services.techConsulting",   desc: "services.techConsultingDesc",   vx: 60_000,  img: consultingImg,       to: "/services/tech-consulting",   color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  { icon: GraduationCap,     name: "services.training",         desc: "services.trainingDesc",         vx: 100_000, img: trainingImg,         to: "/services/training",          color: "bg-primary/10 text-primary" },
] as const;

const LEARNING_SERVICES = [
  { icon: Truck,       name: "delivery.serviceTitle",  desc: "delivery.serviceDesc",  vx: 30_000, to: "/services/delivery",            color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  { icon: BarChart3,   name: "econ.title",             desc: "econ.subtitle",         vx: 50_000, to: "/services/economy",             color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { icon: Heart,       name: "nutrition.serviceTitle", desc: "nutrition.serviceDesc", vx: 40_000, to: "/services/nutrition",           color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { icon: Briefcase,   name: "career.title",           desc: "career.subtitle",       vx: 70_000, to: "/services/career-hub",          color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { icon: Music,       name: "music.title",            desc: "music.subtitle",        vx: 60_000, to: "/services/music-conservatory",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { icon: Video,       name: "studio.title",           desc: "studio.subtitle",       vx: 60_000, to: "/services/global-studio",       color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  { icon: Scissors,    name: "svc.hairTitle",          desc: "svc.hairDesc",          vx: 20_000, to: "/services/hair-care",           color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  { icon: Sparkles,    name: "svc.skinTitle",          desc: "svc.skinDesc",          vx: 25_000, to: "/services/skin-care",           color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  { icon: Stethoscope, name: "svc.medicalTitle",       desc: "svc.medicalDesc",       vx: 50_000, to: "/services/medical-support",     color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { icon: Brain,       name: "svc.psychTitle",         desc: "svc.psychDesc",         vx: 55_000, to: "/services/psychology",          color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { icon: Scale,       name: "svc.legalTitle",         desc: "svc.legalDesc",         vx: 70_000, to: "/services/legal-advisor",       color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  { icon: Users,       name: "svc.socialTitle",        desc: "svc.socialDesc",        vx: 35_000, to: "/services/social-guide",        color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { icon: Dumbbell,    name: "svc.sportsTitle",        desc: "svc.sportsDesc",        vx: 40_000, to: "/services/sports-coach",        color: "bg-lime-500/10 text-lime-600 dark:text-lime-400" },
  { icon: Globe,       name: "empire.serviceTitle",    desc: "empire.serviceDesc",    vx: 90_000, to: "/services/educational-empire",  color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  { icon: Heart,       name: "oasis.serviceTitle",     desc: "oasis.serviceDesc",     vx: 45_000, to: "/services/empathy-oasis",       color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { icon: ScanLine,    name: "radar.serviceTitle",     desc: "radar.serviceDesc",     vx: 80_000, to: "/services/radar-ai",            color: "bg-primary/10 text-primary" },
  { icon: Plane,       name: "svc.travelTitle",        desc: "svc.travelDesc",        vx: 55_000, to: "/services/travel-agency",       color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
] as const;

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner:     "bg-green-600/20 text-green-500 border-green-600/30",
  Intermediate: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
  Advanced:     "bg-red-600/20 text-red-500 border-red-600/30",
};

// ── Component ──────────────────────────────────────────────────────────
export default function Services() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { spendVX } = useVXWallet();
  const uid = useId();

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [simulations, setSimulations] = useState<SimRow[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRow>>({});
  const [simsLoading, setSimsLoading] = useState(true);

  useEffect(() => {
    async function loadSims() {
      const { data } = await supabase
        .from("simulations")
        .select("*")
        .eq("published", true)
        .order("sort_order");
      if (data) setSimulations(data);
      setSimsLoading(false);
    }
    loadSims();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("simulation_progress")
      .select("simulation_id, completed, score")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ProgressRow> = {};
        data.forEach((p) => (map[p.simulation_id] = p));
        setProgressMap(map);
      });
  }, [user]);

  const completedCount = Object.values(progressMap).filter((p) => p.completed).length;

  const handleStartSim = async (sim: SimRow) => {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    const ok = await spendVX(SIMULATION_PRICES.singleSession, "simulation", sim.title, sim.id);
    if (ok) navigate(`/business-simulator/${sim.slug}`);
  };

  const TABS: { id: Category; label: string; icon: React.ReactNode }[] = [
    { id: "all",          label: t("services.catAll"),   icon: <Globe className="h-4 w-4" aria-hidden="true" /> },
    { id: "simulations",  label: t("services.catSims"),  icon: <Cpu className="h-4 w-4" aria-hidden="true" /> },
    { id: "professional", label: t("services.catPro"),   icon: <Briefcase className="h-4 w-4" aria-hidden="true" /> },
    { id: "learning",     label: t("services.catLearn"), icon: <GraduationCap className="h-4 w-4" aria-hidden="true" /> },
  ];

  const showSims  = activeCategory === "all" || activeCategory === "simulations";
  const showPro   = activeCategory === "all" || activeCategory === "professional";
  const showLearn = activeCategory === "all" || activeCategory === "learning";

  const simsHeadingId  = `${uid}-sims`;
  const proHeadingId   = `${uid}-pro`;
  const learnHeadingId = `${uid}-learn`;

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="services-heading">

        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-8 overflow-hidden rounded-2xl">
            <img src={servicesImg} alt="" role="presentation" className="h-48 w-full object-cover sm:h-56" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h1 id="services-heading" className="text-3xl font-bold text-foreground">{t("services.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("services.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Category filter */}
        <AnimatedSection>
          <div
            role="group"
            aria-label={t("services.filterLabel")}
            className="mb-8 flex flex-wrap gap-2"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveCategory(tab.id); playSound("click"); }}
                aria-pressed={activeCategory === tab.id}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  activeCategory === tab.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {/* ── Business Simulations ─────────────────────────────────── */}
        {showSims && (
          <AnimatedSection
            className="mb-12"
            aria-labelledby={simsHeadingId}
          >
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Cpu className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catSims")}
                </div>
                <h2 id={simsHeadingId} className="text-2xl font-bold text-foreground">{t("services.simsTitle")}</h2>
                <p className="mt-1 text-muted-foreground max-w-xl">{t("services.simsDesc")}</p>
              </div>
              {user && simulations.length > 0 && (
                <div className="shrink-0 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Trophy className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                  <span>
                    {t("services.completedOf")
                      .replace("{done}", String(completedCount))
                      .replace("{total}", String(simulations.length))}
                  </span>
                </div>
              )}
            </div>

            {simsLoading ? (
              <div
                role="status"
                aria-label={t("services.loadingSims")}
                aria-live="polite"
                className="flex justify-center py-12"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
                <span className="sr-only">{t("services.loadingSims")}</span>
              </div>
            ) : simulations.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t("simulations.noResults") || "No simulations available yet."}</p>
            ) : (
              <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {simulations.map((sim) => {
                  const prog = progressMap[sim.id];
                  const done = prog?.completed;
                  return (
                    <StaggerItem key={sim.id} role="listitem">
                      <Card className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${done ? "border-green-500/40 bg-green-500/5" : ""}`}>
                        {simulationImages[sim.slug] && (
                          <div className="relative h-28 w-full overflow-hidden">
                            <img
                              src={simulationImages[sim.slug]}
                              alt=""
                              role="presentation"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" aria-hidden="true" />
                            {done && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="h-5 w-5 text-green-500 drop-shadow" aria-hidden="true" />
                              </div>
                            )}
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="mb-1 flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-xs ${DIFFICULTY_COLOR[sim.difficulty] ?? ""}`}>
                              {sim.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">{t("services.duration")}</span>
                              {sim.estimated_duration}m
                            </span>
                            {done && <span className="sr-only">{t("services.completed")}</span>}
                          </div>
                          <h3 className="font-semibold text-foreground">{sim.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{sim.description}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">{t("services.cost")}</span>
                              {formatVX(SIMULATION_PRICES.singleSession)}
                            </span>
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStartSim(sim)}
                              aria-label={`${done ? (t("simulations.replay") || "Replay") : (t("simulations.start") || "Start")} ${sim.title}`}
                            >
                              {done ? (t("simulations.replay") || "Replay") : (t("simulations.start") || "Start")}
                              <ArrowRight className="ms-1 h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            )}
          </AnimatedSection>
        )}

        {/* ── Professional Services ────────────────────────────────── */}
        {showPro && (
          <AnimatedSection className="mb-12" aria-labelledby={proHeadingId}>
            <div className="mb-6">
              <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catPro")}
              </div>
              <h2 id={proHeadingId} className="text-2xl font-bold text-foreground">{t("services.proTitle")}</h2>
              <p className="mt-1 text-muted-foreground max-w-xl">{t("services.proDesc")}</p>
            </div>

            <StaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {PROFESSIONAL_SERVICES.map((s) => {
                const serviceName = t(s.name as Parameters<typeof t>[0]);
                const serviceDesc = t(s.desc as Parameters<typeof t>[0]);
                return (
                  <StaggerItem key={s.to} role="listitem">
                    <Link
                      to={s.to}
                      onClick={() => playSound("navigate")}
                      className="group block h-full"
                      aria-label={`${serviceName} — ${formatVX(s.vx)} VX`}
                    >
                      <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                        <CardContent className="flex items-start gap-4 p-5">
                          <div className={`rounded-lg p-3 shrink-0 ${s.color.split(" ").find((c) => c.startsWith("bg-")) ?? ""}`} aria-hidden="true">
                            <s.icon className={`h-5 w-5 ${s.color.split(" ").filter((c) => !c.startsWith("bg-")).join(" ")}`} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{serviceName}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{serviceDesc}</p>
                            <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                              <Coins className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">{t("services.cost")}</span>
                              {formatVX(s.vx)}
                            </div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                        </CardContent>
                      </Card>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </AnimatedSection>
        )}

        {/* ── Learning Services ────────────────────────────────────── */}
        {showLearn && (
          <AnimatedSection className="mb-8" aria-labelledby={learnHeadingId}>
            <div className="mb-6">
              <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catLearn")}
              </div>
              <h2 id={learnHeadingId} className="text-2xl font-bold text-foreground">{t("services.learnTitle")}</h2>
              <p className="mt-1 text-muted-foreground max-w-xl">{t("services.learnDesc")}</p>
            </div>

            <StaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {LEARNING_SERVICES.map((s) => {
                const serviceName = t(s.name as Parameters<typeof t>[0]);
                const serviceDesc = t(s.desc as Parameters<typeof t>[0]);
                return (
                  <StaggerItem key={s.to} role="listitem">
                    <Link
                      to={s.to}
                      onClick={() => playSound("navigate")}
                      className="group block h-full"
                      aria-label={`${serviceName} — ${formatVX(s.vx)} VX`}
                    >
                      <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                        <CardContent className="flex items-start gap-4 p-5">
                          <div className={`rounded-lg p-3 shrink-0 ${s.color.split(" ").find((c) => c.startsWith("bg-")) ?? ""}`} aria-hidden="true">
                            <s.icon className={`h-5 w-5 ${s.color.split(" ").filter((c) => !c.startsWith("bg-")).join(" ")}`} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{serviceName}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{serviceDesc}</p>
                            <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                              <Coins className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">{t("services.cost")}</span>
                              {formatVX(s.vx)}
                            </div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                        </CardContent>
                      </Card>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </AnimatedSection>
        )}

      </section>
    </Layout>
  );
}
