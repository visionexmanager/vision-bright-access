import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Services() {
  const { t } = useLanguage();

  const services = [
    { name: t("services.audit"), desc: t("services.auditDesc"), points: 75 },
    { name: t("services.wcag"), desc: t("services.wcagDesc"), points: 60 },
    { name: t("services.testing"), desc: t("services.testingDesc"), points: 100 },
    { name: t("services.remediation"), desc: t("services.remediationDesc"), points: 90 },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="services-heading">
        <h1 id="services-heading" className="mb-2 text-3xl font-bold">{t("services.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("services.subtitle")}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.name} className="transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-4 p-8">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <Eye className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold">{s.name}</h2>
                <p className="text-muted-foreground">{s.desc}</p>
                <Badge className="w-fit text-sm">{t("services.earn").replace("{points}", String(s.points))}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
