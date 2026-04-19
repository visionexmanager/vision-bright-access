import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Megaphone, Package, Headphones, GraduationCap, MonitorSmartphone, ArrowRight, Truck, BarChart3, Heart, Briefcase, Music, Video, Coins } from "lucide-react";
import { TECH_SERVICE_PRICES, formatVX } from "@/systems/pricingSystem";
import { toast } from "sonner";
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
    { icon: MonitorSmartphone, name: t("services.webDesign"), desc: t("services.webDesignDesc"), points: 100, img: webDesignImg, vx: TECH_SERVICE_PRICES.remoteSupport },
    { icon: Megaphone, name: t("services.digitalMarketing"), desc: t("services.digitalMarketingDesc"), points: 80, img: digitalMarketingImg, vx: TECH_SERVICE_PRICES.techConsultation },
    { icon: Package, name: t("services.importPurchasing"), desc: t("services.importPurchasingDesc"), points: 60, img: importImg, vx: TECH_SERVICE_PRICES.techConsultation },
    { icon: Headphones, name: t("services.techConsulting"), desc: t("services.techConsultingDesc"), points: 120, img: consultingImg, vx: TECH_SERVICE_PRICES.techConsultation },
    { icon: GraduationCap, name: t("services.training"), desc: t("services.trainingDesc"), points: 90, img: trainingImg, vx: TECH_SERVICE_PRICES.remoteSupport },
  ];

  const handleCta = (serviceName: string) => {
    playSound("success");
    toast.success(`${serviceName} — request submitted!`);
  };

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
                  <Button size="lg" className="mt-2 w-full text-base font-semibold" onClick={() => handleCta(s.name)}>
                    {t("services.cta")} <ArrowRight className="ms-2 h-5 w-5" />
                  </Button>
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
