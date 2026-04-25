import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Megaphone, Package, Headphones, GraduationCap, MonitorSmartphone, ArrowRight, Truck, BarChart3, Heart, Briefcase, Music, Video, Coins, Scissors, Scale, Stethoscope, Brain, Sparkles, Users, Dumbbell, Plane, ScanLine, Globe } from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";
import { Link } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import servicesImg from "@/assets/services-illustration.jpg";
import webDesignImg from "@/assets/service-web-design.jpg";
import digitalMarketingImg from "@/assets/service-digital-marketing.jpg";
import importImg from "@/assets/service-import.jpg";
import consultingImg from "@/assets/service-consulting.jpg";
import trainingImg from "@/assets/service-training.jpg";

export default function Services() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const services = [
    { icon: MonitorSmartphone, name: t("services.webDesign"), desc: t("services.webDesignDesc"), points: 100, img: webDesignImg, vx: 150_000, to: "/services/web-design" },
    { icon: Megaphone, name: t("services.digitalMarketing"), desc: t("services.digitalMarketingDesc"), points: 80, img: digitalMarketingImg, vx: 120_000, to: "/services/digital-marketing" },
    { icon: Package, name: t("services.importPurchasing"), desc: t("services.importPurchasingDesc"), points: 60, img: importImg, vx: 80_000, to: "/services/import-purchasing" },
    { icon: Headphones, name: t("services.techConsulting"), desc: t("services.techConsultingDesc"), points: 120, img: consultingImg, vx: 60_000, to: "/services/tech-consulting" },
    { icon: GraduationCap, name: t("services.training"), desc: t("services.trainingDesc"), points: 90, img: trainingImg, vx: 100_000, to: "/services/training" },
  ];

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="services-heading">
        {/* Hero banner */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={servicesImg} alt="" className="h-48 w-full object-cover sm:h-56" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h1 id="services-heading" className="text-3xl font-bold text-foreground">{t("services.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("services.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((s) => (
            <StaggerItem key={s.name}>
              <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
                <div className="relative h-36 w-full overflow-hidden">
                  <img src={s.img} alt="" className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" width={640} height={512} loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
                <CardContent className="flex flex-1 flex-col gap-4 p-6">
                  <div className="rounded-xl bg-primary/10 p-3 w-fit">
                    <s.icon className="h-7 w-7 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-bold">{s.name}</h2>
                  <p className="flex-1 text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="flex items-center gap-2">
                    <Badge className="w-fit text-sm">{t("services.earn").replace("{points}", String(s.points))}</Badge>
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <Coins className="h-3.5 w-3.5" />
                      {formatVX(s.vx)}
                    </span>
                  </div>
                  <Link to={s.to} onClick={() => playSound("navigate")} className="mt-2 block">
                    <Button size="lg" className="w-full text-base font-semibold">
                      {t("services.cta")} <ArrowRight className="ms-2 h-5 w-5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>

        {/* More Services */}
        <AnimatedSection className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link to="/services/delivery" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-sky-500/10 p-3 shrink-0">
                    <Truck className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("delivery.serviceTitle")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("delivery.serviceDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/economy" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-indigo-500/10 p-3 shrink-0">
                    <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("econ.title")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("econ.subtitle")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/nutrition" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-emerald-500/10 p-3 shrink-0">
                    <Heart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("nutrition.serviceTitle")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("nutrition.serviceDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/career-hub" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-amber-500/10 p-3 shrink-0">
                    <Briefcase className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("career.title")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("career.subtitle")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/music-conservatory" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-purple-500/10 p-3 shrink-0">
                    <Music className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("music.title")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("music.subtitle")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/global-studio" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-rose-500/10 p-3 shrink-0">
                    <Video className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("studio.title")}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t("studio.subtitle")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/hair-care" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-pink-500/10 p-3 shrink-0">
                    <Scissors className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Hair Care Specialist</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Professional hair analysis, treatments & transformation</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/skin-care" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-orange-500/10 p-3 shrink-0">
                    <Sparkles className="h-6 w-6 text-orange-500 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Skin Care Expert</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Personalised dermatology care for radiant skin</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/medical-support" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-red-500/10 p-3 shrink-0">
                    <Stethoscope className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Medical Support</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Licensed doctors & specialists — wherever you are</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/psychology" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-violet-500/10 p-3 shrink-0">
                    <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Psychology & Mental Health</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Compassionate therapy and mental wellness support</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/legal-advisor" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-slate-500/10 p-3 shrink-0">
                    <Scale className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Legal Advisor</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Expert legal counsel across commercial, civil & family law</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/social-guide" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-teal-500/10 p-3 shrink-0">
                    <Users className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Social Guide</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Navigate life's challenges with professional support</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/sports-coach" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-lime-500/10 p-3 shrink-0">
                    <Dumbbell className="h-6 w-6 text-lime-600 dark:text-lime-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Sports & Fitness Coach</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Expert personal training to achieve your fitness goals</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/educational-empire" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-yellow-500/10 p-3 shrink-0">
                    <Globe className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Global Educational Empire</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Build & manage your own academy — from classroom to worldwide network</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/empathy-oasis" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-violet-500/10 p-3 shrink-0">
                    <Heart className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Universal Empathy Oasis</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Breathe, relax & reset — calming tools for mind & body</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/radar-ai" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                    <ScanLine className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Radar AI</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">Smart vision for the blind — describe any scene instantly</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/services/travel-agency" onClick={() => playSound("navigate")} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-cyan-500/10 p-3 shrink-0">
                    <Plane className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Travel Agency</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">From first thought to safe return — every detail handled</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </AnimatedSection>

        {/* Academy CTA */}
        <AnimatedSection className="mt-8 text-center">
          <Link to="/academy">
            <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>
              🎓 {t("services.academy")} <ArrowRight className="ms-2 h-5 w-5" />
            </Button>
          </Link>
        </AnimatedSection>
      </section>
    </Layout>
  );
}
