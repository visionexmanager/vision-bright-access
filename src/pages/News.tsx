import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, Cpu, Accessibility, Brain, Globe, Rocket, ShoppingBag, RefreshCw } from "lucide-react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import newsImg from "@/assets/news-illustration.jpg";
import { WatchAdButton } from "@/components/WatchAdButton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar as arLocale, enUS, es, de, pt, zhCN, tr, fr, ru } from "date-fns/locale";
import { AITaskPanel } from "@/components/AITaskPanel";

const DATE_LOCALES: Record<string, Locale> = {
  ar: arLocale, es, de, pt, zh: zhCN, tr, fr, ru,
  en: enUS, ur: arLocale, hi: enUS,
};

/* ── Icon map ── */
const ICON_MAP: Record<string, React.ElementType> = {
  Cpu, Accessibility, Brain, Globe, Rocket, ShoppingBag, Newspaper,
};

/* ── Category to newsletter topic mapping ── */
export const CATEGORY_TOPIC: Record<string, string> = {
  technology:    "news-technology",
  ai:            "news-ai",
  community:     "news-community",
  accessibility: "news-accessibility",
  platform:      "news-platform",
  marketplace:   "news-marketplace",
};

/* ── Static fallback (shown when DB has no articles yet) ── */
const STATIC_ITEMS = [
  { id: "s1", icon: "Cpu",           titleKey: "news.item1.title", descKey: "news.item1.desc", category: "technology",    date: new Date("2026-06-01") },
  { id: "s2", icon: "Accessibility", titleKey: "news.item2.title", descKey: "news.item2.desc", category: "accessibility", date: new Date("2026-05-28") },
  { id: "s3", icon: "Brain",         titleKey: "news.item3.title", descKey: "news.item3.desc", category: "ai",            date: new Date("2026-05-25") },
  { id: "s4", icon: "Globe",         titleKey: "news.item4.title", descKey: "news.item4.desc", category: "community",     date: new Date("2026-05-20") },
];

type DbArticle = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon_name: string;
  published_at: string | null;
  created_at: string;
};

export default function News() {
  const { t, lang } = useLanguage();
  const locale = DATE_LOCALES[lang] ?? enUS;

  const [articles, setArticles] = useState<DbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("news_articles")
      .select("id, title, description, category, icon_name, published_at, created_at")
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false });
    setArticles((data as DbArticle[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const useStatic = articles.length === 0 && !loading;
  const categories = useStatic
    ? ["all", ...new Set(STATIC_ITEMS.map((i) => i.category))]
    : ["all", ...new Set(articles.map((a) => a.category))];

  const filtered = useStatic
    ? (activeCategory === "all" ? STATIC_ITEMS : STATIC_ITEMS.filter((i) => i.category === activeCategory))
    : (activeCategory === "all" ? articles : articles.filter((a) => a.category === activeCategory));

  return (
    <Layout>
      <section className="section-container py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-8 overflow-hidden rounded-2xl">
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

        {/* Category filter */}
        {categories.length > 2 && (
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t("services.filterLabel")}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat === "all" ? t("services.catAll") : t(`news.cat.${cat}`) || cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          </div>
        )}

        {/* Articles */}
        {!loading && (
          <StaggerGrid className="grid gap-6" role="list">
            {(filtered as (typeof STATIC_ITEMS[0] | DbArticle)[]).map((item, i) => {
              const isStatic = "titleKey" in item;
              const title       = isStatic ? t(item.titleKey as Parameters<typeof t>[0]) : (item as DbArticle).title;
              const description = isStatic ? t(item.descKey as Parameters<typeof t>[0]) : (item as DbArticle).description;
              const iconName    = isStatic ? item.icon : (item as DbArticle).icon_name;
              const dateStr     = isStatic
                ? format((item as typeof STATIC_ITEMS[0]).date, "PPP", { locale })
                : format(new Date((item as DbArticle).published_at ?? (item as DbArticle).created_at), "PPP", { locale });
              const category    = item.category;
              const IconComp    = ICON_MAP[iconName] ?? Newspaper;
              const isFeatured  = i === 0;

              return (
                <StaggerItem key={item.id} role="listitem">
                  <Card className={`transition-shadow hover:shadow-md ${isFeatured ? "border-primary/20 bg-primary/5" : ""}`}>
                    <CardHeader className="flex-row items-start gap-4">
                      <div className={`shrink-0 rounded-xl p-3 ${isFeatured ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        <IconComp className={isFeatured ? "h-7 w-7 text-primary-foreground" : "h-5 w-5 text-primary"} aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        {isFeatured && <Badge className="mb-2 text-xs">{t("news.featured") || "Latest"}</Badge>}
                        <CardTitle className={isFeatured ? "text-xl" : "text-lg"}>{title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {t(`news.cat.${category}`) || category}
                          </Badge>
                          <span className="text-xs">{dateStr}</span>
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-muted-foreground ${isFeatured ? "text-base" : "text-sm"}`}>{description}</p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-muted-foreground">{t("news.empty") || "No news in this category yet."}</p>
            <Button variant="outline" size="sm" onClick={() => setActiveCategory("all")}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
              {t("services.catAll")}
            </Button>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="mt-8">
            <AITaskPanel
              assistantId="content-guide"
              title={lang === "ar" ? "موجز الأخبار الذكي" : "AI news brief"}
              description={lang === "ar" ? "يلخص الأخبار الظاهرة ويشرح المصطلحات دون إضافة معلومات غير موجودة." : "Summarizes visible stories and explains terms without inventing facts."}
              actions={[
                { label: lang === "ar" ? "ملخص سريع" : "Quick brief", prompt: lang === "ar" ? "لخص الأخبار الحالية في نقاط قصيرة." : "Summarize the current stories in short bullet points." },
                { label: lang === "ar" ? "شرح مبسط" : "Plain language", prompt: lang === "ar" ? "اشرح أهم الأخبار بلغة بسيطة جدا." : "Explain the most important stories in very simple language." },
                { label: lang === "ar" ? "قارن المواضيع" : "Compare topics", prompt: lang === "ar" ? "قارن موضوعات الأخبار وحدد الروابط بينها اعتمادا على النص فقط." : "Compare the story topics and identify connections using only the supplied text." },
              ]}
              context={{ category: activeCategory, stories: filtered }}
            />
          </div>
        )}
      </section>
    </Layout>
  );
}
