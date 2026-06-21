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
  Dumbbell, Plane, ScanLine, Globe, Cpu, CheckCircle, Clock, Trophy, FileText,
  MapPin, Tv, Radio, Wifi, Wrench, Car, Activity, Gauge, Anchor, Ship, Navigation,
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
import { toast } from "@/hooks/use-toast";
import { WatchAdButton } from "@/components/WatchAdButton";

// ── Types ──────────────────────────────────────────────────────────────
type Category = "all" | "simulations" | "professional" | "learning" | "media";

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
// 1000 VX = $1 USD
// Semantic color tokens — 4 categories only:
// primary (teal) = tech/platform  |  blue = education/creative
// amber = business/professional   |  green = health/wellness
const CLR = {
  tech:     "bg-primary/10 text-primary",
  blue:     "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber:    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  green:    "bg-green-500/10 text-green-600 dark:text-green-400",
};

const PROFESSIONAL_SERVICES = [
  { icon: Headphones,       name: "services.techConsulting",   desc: "services.techConsultingDesc",   vx: 20_000,  img: consultingImg,       to: "/services/tech-consulting",   color: CLR.tech  }, // $20
  { icon: GraduationCap,    name: "services.training",         desc: "services.trainingDesc",         vx: 40_000,  img: trainingImg,         to: "/services/training",          color: CLR.blue  }, // $40
  { icon: Package,          name: "services.importPurchasing", desc: "services.importPurchasingDesc", vx: 60_000,  img: importImg,           to: "/services/import-purchasing", color: CLR.amber }, // $60
  { icon: Megaphone,        name: "services.digitalMarketing", desc: "services.digitalMarketingDesc", vx: 90_000,  img: digitalMarketingImg, to: "/services/digital-marketing", color: CLR.tech  }, // $90
  { icon: MonitorSmartphone,name: "services.webDesign",        desc: "services.webDesignDesc",        vx: 130_000, img: webDesignImg,        to: "/services/web-design",        color: CLR.tech  }, // $130
] as const;

const AUTOMOTIVE_SIM_SLUG = "vehicle-diagnostics";
const MARITIME_SIM_SLUG   = "marine-vessel";

// 1000 VX = $1 USD  |  entry starts at 10 VX ($0.01), scales up meaningfully
const EDUCATION_SERVICES = [
  { icon: GraduationCap, name: "services.academy",     desc: "services.academyDesc",  vx: 0,       to: "/academy",                     color: CLR.blue  },
  { icon: FileText,      name: "ocr.serviceTitle",     desc: "ocr.serviceDesc",       vx: 10,      to: "/services/ocr-scan",            color: CLR.tech  }, // $0.01
] as const;

const SUPPORT_SERVICES = [
  { icon: Scissors,    name: "svc.hairTitle",          desc: "svc.hairDesc",          vx: 500,     to: "/services/hair-care",           color: CLR.green }, // $0.50
  { icon: Sparkles,    name: "svc.skinTitle",          desc: "svc.skinDesc",          vx: 800,     to: "/services/skin-care",           color: CLR.green }, // $0.80
  { icon: Users,       name: "svc.socialTitle",        desc: "svc.socialDesc",        vx: 1_000,   to: "/services/social-guide",        color: CLR.blue  }, // $1
  { icon: Truck,       name: "delivery.serviceTitle",  desc: "delivery.serviceDesc",  vx: 1_500,   to: "/services/delivery",            color: CLR.amber }, // $1.50
  { icon: MapPin,      name: "delivery.tripTitle",     desc: "delivery.tripDesc",     vx: 500,     to: "/services/shared-trip",         color: CLR.amber }, // $0.50
  { icon: Dumbbell,    name: "svc.sportsTitle",        desc: "svc.sportsDesc",        vx: 2_000,   to: "/services/sports-coach",        color: CLR.green }, // $2
  { icon: Heart,       name: "oasis.serviceTitle",     desc: "oasis.serviceDesc",     vx: 3_000,   to: "/services/empathy-oasis",       color: CLR.green }, // $3
  { icon: Heart,       name: "nutrition.serviceTitle", desc: "nutrition.serviceDesc", vx: 4_000,   to: "/services/nutrition",           color: CLR.green }, // $4
  { icon: Stethoscope, name: "svc.medicalTitle",       desc: "svc.medicalDesc",       vx: 6_000,   to: "/services/medical-support",     color: CLR.green }, // $6
  { icon: Brain,       name: "svc.psychTitle",         desc: "svc.psychDesc",         vx: 8_000,   to: "/services/psychology",          color: CLR.green }, // $8
  { icon: Plane,       name: "svc.travelTitle",        desc: "svc.travelDesc",        vx: 10_000,  to: "/services/travel-agency",       color: CLR.blue  }, // $10
  { icon: Music,       name: "music.title",            desc: "music.subtitle",        vx: 12_000,  to: "/services/music-conservatory",  color: CLR.blue  }, // $12
  { icon: Video,       name: "studio.title",           desc: "studio.subtitle",       vx: 15_000,  to: "/services/global-studio",       color: CLR.blue  }, // $15
  { icon: Scale,       name: "svc.legalTitle",         desc: "svc.legalDesc",         vx: 20_000,  to: "/services/legal-advisor",       color: CLR.amber }, // $20
  { icon: ScanLine,    name: "radar.serviceTitle",     desc: "radar.serviceDesc",     vx: 25_000,  to: "/services/radar-ai",            color: CLR.tech  }, // $25
  { icon: BarChart3,   name: "econ.title",             desc: "econ.subtitle",         vx: 30_000,  to: "/services/economy",             color: CLR.amber }, // $30
  { icon: Briefcase,   name: "career.title",           desc: "career.subtitle",       vx: 40_000,  to: "/services/career-hub",          color: CLR.amber }, // $40
  { icon: Globe,       name: "empire.serviceTitle",    desc: "empire.serviceDesc",    vx: 60_000,  to: "/services/educational-empire",  color: CLR.blue  }, // $60
] as const;

const ALL_PROFESSIONAL_SERVICES = [...PROFESSIONAL_SERVICES, ...SUPPORT_SERVICES] as const;

const CAR_MAINTENANCE_SIM_CARD = {
  icon: Wrench,
  name: "services.carsMaintenance",
  desc: "services.carsMaintenanceDesc",
  vx: 25_000,
  to: "/services/cars-maintenance",
  color: CLR.amber,
} as const;

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner:     "bg-green-600/20 text-green-500 border-green-600/30",
  Intermediate: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
  Advanced:     "bg-red-600/20 text-red-500 border-red-600/30",
};

const SIM_BRIEFS: Record<string, { en: string; ar: string }> = {
  "egg-incubator": { en: "Control heat and humidity to build a productive hatchery.", ar: "اضبط الحرارة والرطوبة لتبني مشروع تفريخ منتج." },
  "dairy-farm": { en: "Manage feeding, milking, and herd health in a dairy project.", ar: "أدر التغذية والحلب وصحة القطيع في مشروع ألبان." },
  "poultry-farm": { en: "Balance feed, health, and production in a poultry farm.", ar: "وازن بين العلف والصحة والإنتاج في مزرعة دواجن." },
  "cattle-dairy": { en: "Plan pasture, breeding, and milk output for a cattle business.", ar: "خطط للمراعي والتربية وإنتاج الحليب في مشروع ماشية." },
  "sheep-farm": { en: "Run lambing, shearing, and sales across a sheep season.", ar: "أدر الولادة والجز وبيع الموسم في مشروع أغنام." },
  "network-noc": { en: "Diagnose live network incidents like an operations engineer.", ar: "شخّص أعطال الشبكات الحية كمهندس عمليات." },
  "mobile-repair": { en: "Practice phone diagnosis and repair from screen to board.", ar: "تدرّب على تشخيص وصيانة الهاتف من الشاشة إلى اللوحة." },
  "laptop-repair": { en: "Troubleshoot laptop hardware and system faults step by step.", ar: "حل أعطال اللابتوب والأنظمة خطوة بخطوة." },
  "perfume-lab": { en: "Blend notes and quality checks into a signature fragrance.", ar: "امزج الروائح واختبر الجودة لصناعة عطر خاص." },
  "detergent-lab": { en: "Formulate cleaning products with budget and performance in mind.", ar: "اصنع منتجات تنظيف توازن بين التكلفة والأداء." },
  "skin-care-lab": { en: "Create safe skincare formulas and test real product choices.", ar: "طوّر تركيبات عناية آمنة واختبر قرارات المنتج." },
  "woodworking": { en: "Plan materials, jobs, and delivery in a woodworking shop.", ar: "خطط للمواد والطلبات والتسليم في ورشة خشب." },
  "aluminum-glazing": { en: "Move from quote to installation in aluminum and glass work.", ar: "انتقل من التسعير إلى التركيب في أعمال الألمنيوم والزجاج." },
  "global-kitchen": { en: "Lead menu, staff, and costs during busy kitchen service.", ar: "أدر المنيو والفريق والتكاليف في مطبخ مزدحم." },
  "chocolate-factory": { en: "Run sourcing, production, and quality in a chocolate factory.", ar: "أدر التوريد والإنتاج والجودة في مصنع شوكولاتة." },
  "solar-energy": { en: "Size panels, track output, and plan solar project returns.", ar: "احسب الألواح وتتبع الإنتاج وخطط لعائد مشروع شمسي." },
  "hvac-systems": { en: "Install and maintain HVAC systems for real building needs.", ar: "ركّب وصن أنظمة التكييف حسب احتياج المباني." },
  "logistics-supply": { en: "Optimize warehouse, fleet, and supplier decisions.", ar: "حسّن قرارات المخزن والأسطول والموردين." },
  "barber-salon": { en: "Manage bookings, staff, prices, and customer loyalty.", ar: "أدر الحجوزات والفريق والأسعار وولاء العملاء." },
  "board-surgeon": { en: "Make careful operating-room decisions under time pressure.", ar: "اتخذ قرارات دقيقة داخل غرفة عمليات افتراضية." },
  "english-journey": { en: "Guide learners through English practice with clear progress.", ar: "قدّم رحلة تعلم إنجليزية بتدرج ونتائج واضحة." },
  "music-training": { en: "Schedule lessons and grow students toward confident performance.", ar: "نظّم الدروس وطوّر الطلاب نحو أداء واثق." },
  "trade-tycoon": { en: "Buy, sell, and manage cash flow across active markets.", ar: "اشترِ وبِع وأدر السيولة في أسواق متحركة." },
  "vehicle-diagnostics": { en: "Diagnose vehicle faults and choose the right repair path.", ar: "شخّص أعطال المركبات واختر مسار الإصلاح المناسب." },
  "marine-vessel": { en: "Plan vessel operations, navigation, and maritime logistics.", ar: "خطط لتشغيل السفن والملاحة والخدمات البحرية." },
};

// ── Component ──────────────────────────────────────────────────────────
export default function Services() {
  const { t, lang } = useLanguage();
  const { playSound } = useSound();
  const { user } = useAuth();
  const navigate = useNavigate();
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
    if (!user) { toast({ title: t("services.loginRequired"), variant: "destructive" }); return; }
    navigate(`/business-simulator/${sim.slug}`);
  };

  const TABS: { id: Category; label: string; icon: React.ReactNode }[] = [
    { id: "all",          label: t("services.catAll"),        icon: <Globe className="h-4 w-4" aria-hidden="true" /> },
    { id: "media",        label: t("services.catMedia"),      icon: <Tv className="h-4 w-4" aria-hidden="true" /> },
    { id: "learning",     label: t("services.catLearn"),      icon: <GraduationCap className="h-4 w-4" aria-hidden="true" /> },
    { id: "simulations",  label: t("services.catSims"),       icon: <Cpu className="h-4 w-4" aria-hidden="true" /> },
    { id: "professional", label: t("services.catPro"),        icon: <Briefcase className="h-4 w-4" aria-hidden="true" /> },
  ];

  const showAuto     = false;
  const showMaritime = false;
  const showSims     = activeCategory === "all" || activeCategory === "simulations";
  const showPro      = activeCategory === "all" || activeCategory === "professional";
  const showLearn    = activeCategory === "all" || activeCategory === "learning";
  const showMedia    = activeCategory === "all" || activeCategory === "media";

  const genericSimulations = simulations;
  const getSimBrief = (sim: SimRow) => {
    const brief = SIM_BRIEFS[sim.slug];
    if (brief) return lang === "ar" ? brief.ar : brief.en;
    return t(`sim.${sim.slug}.desc`) || sim.description;
  };

  const autoHeadingId     = `${uid}-auto`;
  const maritimeHeadingId = `${uid}-maritime`;
  const simsHeadingId     = `${uid}-sims`;
  const proHeadingId      = `${uid}-pro`;
  const learnHeadingId    = `${uid}-learn`;
  const mediaHeadingId    = `${uid}-media`;

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="services-heading">

        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-8 overflow-hidden rounded-2xl">
            <img src={servicesImg} alt="" role="presentation" className="h-48 w-full object-cover sm:h-56" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6">
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

        <WatchAdButton variant="card" className="mb-6" />

        {/* ── Automotive Services ───────────────────────────────────── */}
        {showAuto && (
          <AnimatedSection className="mb-12" aria-labelledby={autoHeadingId}>
            <div className="mb-6">
              <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-500">
                <Car className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catAutomotive")}
              </div>
              <h2 id={autoHeadingId} className="text-2xl font-bold text-foreground">{t("services.automotiveTitle")}</h2>
              <p className="mt-1 text-muted-foreground max-w-xl">{t("services.automotiveDesc")}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" role="list">

              {/* Cars Maintenance */}
              <StaggerItem role="listitem">
                <Link
                  to="/services/cars-maintenance"
                  onClick={() => playSound("navigate")}
                  className="group block h-full"
                  aria-label={t("services.carsMaintenance")}
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-amber-500/20">
                    <div className="relative h-32 bg-gradient-to-br from-amber-700 via-amber-600 to-orange-500 overflow-hidden">
                      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
                      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Wrench className="h-16 w-16 text-white/25 group-hover:text-white/35 transition-colors" />
                      </div>
                      <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white">
                        <Gauge className="h-3 w-3" aria-hidden="true" /> PRO SERVICE
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{t("services.carsMaintenance")}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t("services.carsMaintenanceDesc")}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-amber-500/10 p-2">
                          <Wrench className="h-5 w-5 text-amber-500" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Coverage">
                        {["Cars", "Trucks", "Buses", "Motorcycles"].map((v) => (
                          <span key={v} className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                            {v}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Coins className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{t("services.cost")}</span>
                          {formatVX(25_000)}
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-all group-hover:bg-amber-600">
                          {t("services.cta")}
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>

              {/* Vehicle Diagnostics & Repair Simulator */}
              <StaggerItem role="listitem">
                <Link
                  to={`/business-simulator/${AUTOMOTIVE_SIM_SLUG}`}
                  onClick={() => playSound("navigate")}
                  className="group block h-full"
                  aria-label={t("services.vehicleDiags")}
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-green-500/20">
                    <div className="relative h-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 overflow-hidden">
                      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-green-500/10" aria-hidden="true" />
                      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-cyan-500/10" aria-hidden="true" />
                      {/* Animated scan line */}
                      <div className="absolute inset-x-0 h-px bg-green-400/40 animate-pulse" style={{ top: "60%" }} aria-hidden="true" />
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Activity className="h-16 w-16 text-green-400/30 group-hover:text-green-400/45 transition-colors" />
                      </div>
                      <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-green-500/20 border border-green-500/30 px-2.5 py-1 text-[11px] font-bold text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" aria-hidden="true" />
                        {t("services.vehicleDiagsSimBadge")}
                      </div>
                      {/* Diagnostic readout decoration */}
                      <div className="absolute bottom-2 end-3 font-mono text-[9px] text-green-400/50 space-y-0.5 text-right" aria-hidden="true">
                        <div>OBD-II · J1939 · CAN</div>
                        <div>VISIONEX DIAG v4.2</div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{t("services.vehicleDiags")}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t("services.vehicleDiagsDesc")}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-green-500/10 p-2">
                          <Activity className="h-5 w-5 text-green-500" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Features">
                        {["AI Diagnostics", "OBD Scanner", "Repair Garage", "VX Rewards"].map((f) => (
                          <span key={f} className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/5 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                            {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Coins className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{t("services.cost")}</span>
                          {formatVX(200)} / session
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-all group-hover:bg-green-500">
                          {t("services.vehicleDiagsStartSim")}
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>

            </div>
          </AnimatedSection>
        )}

        {/* ── Maritime & Logistics Services ────────────────────────── */}
        {showMaritime && (
          <AnimatedSection className="mb-12" aria-labelledby={maritimeHeadingId}>
            <div className="mb-6">
              <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-500">
                <Ship className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catMaritime")}
              </div>
              <h2 id={maritimeHeadingId} className="text-2xl font-bold text-foreground">{t("services.maritimeTitle")}</h2>
              <p className="mt-1 text-muted-foreground max-w-xl">{t("services.maritimeDesc")}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" role="list">

              {/* Live Marine Vessel Tracking & Maritime Logistics Simulator */}
              <StaggerItem role="listitem">
                <Link
                  to={`/business-simulator/${MARITIME_SIM_SLUG}`}
                  onClick={() => playSound("navigate")}
                  className="group block h-full"
                  aria-label={t("services.marineVessel")}
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-cyan-500/20">
                    <div className="relative h-32 bg-gradient-to-br from-[#020a14] via-[#051220] to-[#0a2040] overflow-hidden">
                      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-cyan-500/10" aria-hidden="true" />
                      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-blue-500/10" aria-hidden="true" />
                      {/* Radar sweep animation */}
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Navigation className="h-16 w-16 text-cyan-400/25 group-hover:text-cyan-400/40 transition-colors" />
                      </div>
                      {/* Animated scan line */}
                      <div className="absolute inset-x-0 h-px bg-cyan-400/30 animate-pulse" style={{ top: "55%" }} aria-hidden="true" />
                      <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-bold text-cyan-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden="true" />
                        {t("services.marineVesselBadge")}
                      </div>
                      <div className="absolute bottom-2 end-3 font-mono text-[9px] text-cyan-400/50 space-y-0.5 text-right" aria-hidden="true">
                        <div>AIS · MMSI · IMO</div>
                        <div>VISIONEX NAV v2.0</div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{t("services.marineVessel")}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t("services.marineVesselDesc")}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-cyan-500/10 p-2">
                          <Anchor className="h-5 w-5 text-cyan-500" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Features">
                        {["Fleet Tracking", "AIS Data", "Port Logistics", "VX Rewards"].map((f) => (
                          <span key={f} className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-xs text-cyan-600 dark:text-cyan-400">
                            {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Coins className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{t("services.cost")}</span>
                          {formatVX(300)} / session
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white transition-all group-hover:bg-cyan-500">
                          {t("services.marineVesselStartSim")}
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>

            </div>
          </AnimatedSection>
        )}

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
              {user && genericSimulations.length > 0 && (
                <div className="shrink-0 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Trophy className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                  <span>
                    {t("services.completedOf")
                      .replace("{done}", String(completedCount))
                      .replace("{total}", String(genericSimulations.length))}
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
            ) : genericSimulations.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t("simulations.noResults") || "No simulations available yet."}</p>
            ) : (
              <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                <StaggerItem role="listitem">
                  <Link
                    to={CAR_MAINTENANCE_SIM_CARD.to}
                    onClick={() => playSound("navigate")}
                    className="group block h-full"
                    aria-label={`${t(CAR_MAINTENANCE_SIM_CARD.name)} - ${formatVX(CAR_MAINTENANCE_SIM_CARD.vx)}`}
                  >
                    <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                      <CardContent className="flex items-start gap-4 p-5">
                        <div className={`rounded-lg p-3 shrink-0 ${CAR_MAINTENANCE_SIM_CARD.color.split(" ").find((c) => c.startsWith("bg-")) ?? ""}`} aria-hidden="true">
                          <CAR_MAINTENANCE_SIM_CARD.icon className={`h-5 w-5 ${CAR_MAINTENANCE_SIM_CARD.color.split(" ").filter((c) => !c.startsWith("bg-")).join(" ")}`} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{t(CAR_MAINTENANCE_SIM_CARD.name)}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{t(CAR_MAINTENANCE_SIM_CARD.desc)}</p>
                          <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                            <Coins className="h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">{t("services.cost")}</span>
                            {formatVX(CAR_MAINTENANCE_SIM_CARD.vx)}
                          </div>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
                {genericSimulations.map((sim) => {
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
                              {t(`cat.${sim.difficulty}`) || sim.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">{t("services.duration")}</span>
                              {sim.estimated_duration}m
                            </span>
                            {done && <span className="sr-only">{t("services.completed")}</span>}
                          </div>
                          <h3 className="font-semibold text-foreground">{t(`sim.${sim.slug}.title`) || sim.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{getSimBrief(sim)}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">{t("services.cost")}</span>
                              {formatVX(SIMULATION_PRICES.quarterHour)} / {SIMULATION_PRICES.quarterMinutes}m
                            </span>
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStartSim(sim)}
                              aria-label={`${done ? t("summary.replay") : t("summary.start")} ${sim.title}`}
                            >
                              {done ? t("summary.replay") : t("summary.start")}
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
              {ALL_PROFESSIONAL_SERVICES.map((s) => {
                const serviceName = t(s.name as Parameters<typeof t>[0]);
                const serviceDesc = t(s.desc as Parameters<typeof t>[0]);
                const priceLabel = formatVX(s.vx);
                return (
                  <StaggerItem key={s.to} role="listitem">
                    <Link
                      to={s.to}
                      onClick={() => playSound("navigate")}
                      className="group block h-full"
                      aria-label={`${serviceName} - ${priceLabel}`}
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
                              {priceLabel}
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

        {/* ── Media Services ───────────────────────────────────────── */}
        {showMedia && (
          <AnimatedSection className="mb-12" aria-labelledby={mediaHeadingId}>
            {/* Section header */}
            <div className="mb-6">
              <div aria-hidden="true" className="mb-1 inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                <Tv className="h-3.5 w-3.5" aria-hidden="true" /> {t("services.catMedia")}
              </div>
              <h2 id={mediaHeadingId} className="text-2xl font-bold text-foreground">{t("services.mediaHeading")}</h2>
              <p className="mt-1 text-muted-foreground max-w-xl">{t("services.mediaDesc")}</p>
            </div>

            {/* Two feature cards side by side */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" role="list">

              {/* ── VisionTV ── */}
              <StaggerItem role="listitem">
                <Link
                  to="/services/live-tv"
                  onClick={() => playSound("navigate")}
                  className="group block h-full"
                  aria-label={t("nav.liveTV")}
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-blue-500/20">
                    {/* Gradient banner */}
                    <div className="relative h-32 bg-gradient-to-br from-blue-700 via-blue-500 to-blue-400 overflow-hidden">
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
                      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
                      {/* Live badge */}
                      <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                        LIVE
                      </div>
                      {/* Signal icon */}
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Tv className="h-16 w-16 text-white/30 group-hover:text-white/40 transition-colors" />
                      </div>
                      {/* Wifi signal dots (decorative) */}
                      <div className="absolute bottom-3 end-3 flex items-end gap-0.5" aria-hidden="true">
                        {[2, 3, 4, 5].map((h) => (
                          <div key={h} className="w-1 rounded-full bg-white/60" style={{ height: `${h * 3}px` }} />
                        ))}
                      </div>
                    </div>

                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{t("nav.liveTV")}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t("liveTV.heroDesc")}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-blue-500/10 p-2">
                          <Tv className="h-5 w-5 text-blue-500" aria-hidden="true" />
                        </div>
                      </div>
                      {/* Feature pills */}
                      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Features">
                        {["HD & 4K", "Sports", "News", "Movies"].map((f) => (
                          <span key={f} className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                            <Wifi className="h-2.5 w-2.5" aria-hidden="true" /> {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t("services.mediaTitle")}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-all group-hover:bg-blue-600">
                          {t("liveTV.subscribeNow")}
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>

              {/* ── VisionRadio ── */}
              <StaggerItem role="listitem">
                <Link
                  to="/services/live-radio"
                  onClick={() => playSound("navigate")}
                  className="group block h-full"
                  aria-label={t("nav.liveRadio")}
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-orange-500/20">
                    {/* Gradient banner */}
                    <div className="relative h-32 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 overflow-hidden">
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
                      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
                      {/* Live badge */}
                      <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                        LIVE
                      </div>
                      {/* Radio icon */}
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Radio className="h-16 w-16 text-white/30 group-hover:text-white/40 transition-colors" />
                      </div>
                      {/* Animated audio-wave bars */}
                      <div className="absolute bottom-3 end-3 flex items-end gap-0.5" aria-hidden="true">
                        {[3, 5, 4, 6, 3, 5].map((h, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-white/70 animate-pulse"
                            style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>
                    </div>

                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{t("nav.liveRadio")}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t("liveRadio.heroDesc")}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-orange-500/10 p-2">
                          <Radio className="h-5 w-5 text-orange-500" aria-hidden="true" />
                        </div>
                      </div>
                      {/* Feature pills */}
                      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Features">
                        {["Music", "News", "Quran", "Sports"].map((f) => (
                          <span key={f} className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 text-xs text-orange-600 dark:text-orange-400">
                            <Radio className="h-2.5 w-2.5" aria-hidden="true" /> {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t("services.mediaTitle")}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white transition-all group-hover:bg-orange-600">
                          {t("liveRadio.subscribeNow")}
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>

            </div>
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
              {EDUCATION_SERVICES.map((s) => {
                const serviceName = t(s.name as Parameters<typeof t>[0]);
                const serviceDesc = t(s.desc as Parameters<typeof t>[0]);
                const priceLabel = s.vx > 0 ? formatVX(s.vx) : t("services.openLearning");
                return (
                  <StaggerItem key={s.to} role="listitem">
                    <Link
                      to={s.to}
                      onClick={() => playSound("navigate")}
                      className="group block h-full"
                      aria-label={`${serviceName} - ${priceLabel}`}
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
                              {priceLabel}
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
