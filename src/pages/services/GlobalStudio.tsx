import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Globe, Video, Image, Palette, PenTool, ArrowRight, Coins } from "lucide-react";
import { toast } from "sonner";
import { TECH_SERVICE_PRICES, formatVX } from "@/systems/pricingSystem";
import heroImg from "@/assets/service-studio.jpg";

export default function GlobalStudio() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const studioServices = [
    { icon: Video, title: t("studio.videoProduction"), desc: t("studio.videoDesc"), vx: TECH_SERVICE_PRICES.remoteSupport },
    { icon: Image, title: t("studio.photography"), desc: t("studio.photoDesc"), vx: TECH_SERVICE_PRICES.techConsultation },
    { icon: Palette, title: t("studio.graphicDesign"), desc: t("studio.graphicDesc"), vx: TECH_SERVICE_PRICES.techConsultation },
    { icon: PenTool, title: t("studio.branding"), desc: t("studio.brandingDesc"), vx: TECH_SERVICE_PRICES.remoteSupport },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={heroImg} alt="" className="h-44 w-full object-cover sm:h-52" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <Globe className="mx-auto mb-2 h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold">{t("studio.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("studio.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6 sm:grid-cols-2">
          {studioServices.map((s) => (
            <StaggerItem key={s.title}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <s.icon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{s.title}</CardTitle>
                      <Badge variant="outline" className="mt-1 flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        {formatVX(s.vx)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{s.desc}</p>
                  <Button className="w-full" onClick={() => { playSound("success"); toast.success(`${s.title} — ${t("studio.requested")}`); }}>
                    {t("studio.requestService")} <ArrowRight className="ms-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </Layout>
  );
}
