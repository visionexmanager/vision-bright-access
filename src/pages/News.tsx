import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Cpu, Accessibility, Brain, Globe } from "lucide-react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import newsImg from "@/assets/news-illustration.jpg";
import { WatchAdButton } from "@/components/WatchAdButton";
import { format } from "date-fns";
import { ar as arLocale, enUS, es, de, pt, zhCN, tr, fr, ru } from "date-fns/locale";

const DATE_LOCALES: Record<string, Locale> = {
  ar: arLocale, es, de, pt, zh: zhCN, tr, fr, ru,
  en: enUS, ur: arLocale, hi: enUS,
};

const NEWS_ITEMS = [
  {
    icon: <Cpu className="h-6 w-6 text-primary" />,
    titleKey: "news.item1.title",
    descKey: "news.item1.desc",
    categoryKey: "news.cat.technology",
    date: new Date("2026-06-01"),
  },
  {
    icon: <Accessibility className="h-6 w-6 text-primary" />,
    titleKey: "news.item2.title",
    descKey: "news.item2.desc",
    categoryKey: "news.cat.accessibility",
    date: new Date("2026-05-28"),
  },
  {
    icon: <Brain className="h-6 w-6 text-primary" />,
    titleKey: "news.item3.title",
    descKey: "news.item3.desc",
    categoryKey: "news.cat.ai",
    date: new Date("2026-05-25"),
  },
  {
    icon: <Globe className="h-6 w-6 text-primary" />,
    titleKey: "news.item4.title",
    descKey: "news.item4.desc",
    categoryKey: "news.cat.community",
    date: new Date("2026-05-20"),
  },
];

export default function News() {
  const { t, lang } = useLanguage();
  const locale = DATE_LOCALES[lang] ?? enUS;

  return (
    <Layout>
      <section className="section-container py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={newsImg} alt="" role="presentation" className="h-44 w-full object-cover sm:h-52" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 text-center">
              <Newspaper className="mx-auto mb-2 h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">{t("news.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("news.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <WatchAdButton variant="banner" className="mb-6" />

        {/* Featured first item */}
        <StaggerGrid className="grid gap-6">
          {NEWS_ITEMS.map((item, i) => {
            const isFeatured = i === 0;
            return (
              <StaggerItem key={i}>
                <Card className={`transition-shadow hover:shadow-md ${isFeatured ? "border-primary/20 bg-primary/5" : ""}`}>
                  <CardHeader className={`flex-row items-start gap-4 ${isFeatured ? "pb-3" : ""}`}>
                    <div className={`shrink-0 rounded-xl p-3 ${isFeatured ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {isFeatured
                        ? <span className="block [&>svg]:h-7 [&>svg]:w-7 [&>svg]:text-current">{item.icon}</span>
                        : <span className="block [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-primary">{item.icon}</span>
                      }
                    </div>
                    <div className="flex-1">
                      {isFeatured && (
                        <Badge className="mb-2 text-xs">{t("news.featured") || "Latest"}</Badge>
                      )}
                      <CardTitle className={isFeatured ? "text-xl" : "text-lg"}>{t(item.titleKey)}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{t(item.categoryKey)}</Badge>
                        <span className="text-xs">{format(item.date, "PPP", { locale })}</span>
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-muted-foreground ${isFeatured ? "text-base" : "text-sm"}`}>{t(item.descKey)}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>
    </Layout>
  );
}
