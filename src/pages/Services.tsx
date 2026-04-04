import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe, Megaphone, Package, Headphones, GraduationCap, MonitorSmartphone, ArrowRight, Truck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Services() {
  const { t } = useLanguage();

  const services = [
    { icon: MonitorSmartphone, name: t("services.webDesign"), desc: t("services.webDesignDesc"), points: 100 },
    { icon: Megaphone, name: t("services.digitalMarketing"), desc: t("services.digitalMarketingDesc"), points: 80 },
    { icon: Package, name: t("services.importPurchasing"), desc: t("services.importPurchasingDesc"), points: 60 },
    { icon: Headphones, name: t("services.techConsulting"), desc: t("services.techConsultingDesc"), points: 120 },
    { icon: GraduationCap, name: t("services.training"), desc: t("services.trainingDesc"), points: 90 },
  ];

  const handleCta = (serviceName: string) => {
    toast.success(`${serviceName} — request submitted!`);
  };

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="services-heading">
        <h1 id="services-heading" className="mb-2 text-3xl font-bold">{t("services.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("services.subtitle")}</p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.name} className="flex flex-col transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-1 flex-col gap-4 p-8">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <s.icon className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold">{s.name}</h2>
                <p className="flex-1 text-muted-foreground leading-relaxed">{s.desc}</p>
                <Badge className="w-fit text-sm">{t("services.earn").replace("{points}", String(s.points))}</Badge>
                <Button
                  size="lg"
                  className="mt-2 w-full text-base font-semibold"
                  onClick={() => handleCta(s.name)}
                >
                  {t("services.cta")} <ArrowRight className="ms-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Delivery CTA */}
        <div className="mt-8">
          <Link to="/services/delivery">
            <Card className="transition-shadow hover:shadow-lg border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-6 p-8">
                <div className="rounded-xl bg-primary/10 p-4">
                  <Truck className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-foreground">{t("delivery.serviceTitle")}</h2>
                  <p className="text-muted-foreground mt-1">{t("delivery.serviceDesc")}</p>
                </div>
                <ArrowRight className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Academy CTA */}
        <div className="mt-8 text-center">
          <Link to="/academy">
            <Button size="lg" className="text-lg px-8 py-6 font-semibold">
              🎓 {t("services.academy")} <ArrowRight className="ms-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
