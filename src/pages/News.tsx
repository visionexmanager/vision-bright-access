import { Layout } from "@/components/Layout";
import { NewsletterSubscribe } from "@/components/NewsletterSubscribe";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Cpu, Accessibility, Brain, Globe } from "lucide-react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import newsImg from "@/assets/news-illustration.jpg";

const NEWS_ITEMS = [
  { icon: <Cpu className="h-6 w-6 text-primary" />, titleKey: "news.item1.title", descKey: "news.item1.desc", category: "Technology", date: "2026-04-08" },
  { icon: <Accessibility className="h-6 w-6 text-primary" />, titleKey: "news.item2.title", descKey: "news.item2.desc", category: "Accessibility", date: "2026-04-07" },
  { icon: <Brain className="h-6 w-6 text-primary" />, titleKey: "news.item3.title", descKey: "news.item3.desc", category: "AI", date: "2026-04-05" },
  { icon: <Globe className="h-6 w-6 text-primary" />, titleKey: "news.item4.title", descKey: "news.item4.desc", category: "Community", date: "2026-04-03" },
];

export default function News() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={newsImg} alt="" className="h-44 w-full object-cover sm:h-52" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <Newspaper className="mx-auto mb-2 h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">{t("news.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("news.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6">
          {NEWS_ITEMS.map((item, i) => (
            <StaggerItem key={i}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader className="flex-row items-center gap-4">
                  {item.icon}
                  <div className="flex-1">
                    <CardTitle className="text-lg">{t(item.titleKey)}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{item.category}</Badge>
                      <span>{item.date}</span>
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t(item.descKey)}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>

        <div className="mt-10">
          <NewsletterSubscribe />
        </div>
      </section>
    </Layout>
  );
}
