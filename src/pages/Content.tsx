import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ACADEMY_PRICES, formatVX } from "@/systems/pricingSystem";
import { useVXWallet } from "@/hooks/useVXWallet";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GraduationCap,
  FileText,
  Headphones,
  MonitorPlay,
  Clock,
  BookOpen,
  Mic,
  Play,
  Coins,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WatchAdButton } from "@/components/WatchAdButton";

type ContentItem = {
  id: string;
  title: string;
  description: string;
  type: "course" | "article" | "podcast" | "media";
  category: string;
  level: string;
  points: number;
  duration: number;
  extra_label: string | null;
  extra_value: number | null;
};

const typeIcons = {
  course: GraduationCap,
  article: FileText,
  podcast: Headphones,
  media: MonitorPlay,
};

// Resolved inside component with t() — see getCtaLabel()
const CTA_FALLBACKS: Record<string, string> = {
  course: "Enroll Now",
  article: "Read Article",
  podcast: "Listen",
  media: "Watch",
};

const difficultyStyle: Record<string, string> = {
  Beginner: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  Intermediate: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Advanced: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function Content() {
  const { t } = useLanguage();

  // Returns translated CTA, falls back to English if key not in translation file
  const getCtaLabel = (type: string) => {
    const key = `content.cta.${type}` as Parameters<typeof t>[0];
    const result = t(key);
    return result === key ? (CTA_FALLBACKS[type] ?? type) : result;
  };
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { spendVX } = useVXWallet();
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("content_items").select("*").order("created_at");
      if (data) setItems(data as ContentItem[]);
      setLoading(false);
    };
    load();
  }, []);

  const handleCta = async (item: ContentItem) => {
    const price = item.type === "course" ? ACADEMY_PRICES.miniCourse : 500;
    if (user) {
      const ok = await spendVX(price, item.type, item.title, item.id);
      if (!ok) return;
      await earnPoints(item.points, `Engaged: ${item.title}`);
    }
    toast({
      title: item.title,
      description: user ? `✅ -${price.toLocaleString()} VX · +${item.points} pts` : `+${item.points} pts`,
    });
  };

  if (loading) {
    return (
      <Layout>
        <div role="status" aria-label={t("content.loading") || "Loading content"} className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  const contentTabs = ["all", "courses", "articles", "podcasts", "media"];

  const filterItems = (v: string) =>
    v === "all"
      ? items
      : items.filter((i) =>
          v === "courses" ? i.type === "course"
          : v === "articles" ? i.type === "article"
          : v === "podcasts" ? i.type === "podcast"
          : i.type === "media"
        );

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="content-heading">
        <AnimatedSection variants={scaleFade}>
          <h1 id="content-heading" className="mb-2 text-3xl font-bold">{t("content.title")}</h1>
          <p className="mb-8 text-lg text-muted-foreground">{t("content.subtitle")}</p>
        </AnimatedSection>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-8 flex flex-wrap gap-1">
            <TabsTrigger value="all" className="text-base">{t("content.tab.all")}</TabsTrigger>
            <TabsTrigger value="courses" className="text-base">
              <GraduationCap className="me-1 h-4 w-4" aria-hidden="true" />
              {t("content.tab.courses")}
            </TabsTrigger>
            <TabsTrigger value="articles" className="text-base">
              <FileText className="me-1 h-4 w-4" aria-hidden="true" />
              {t("content.tab.articles")}
            </TabsTrigger>
            <TabsTrigger value="podcasts" className="text-base">
              <Headphones className="me-1 h-4 w-4" aria-hidden="true" />
              {t("content.tab.podcasts")}
            </TabsTrigger>
            <TabsTrigger value="media" className="text-base">
              <MonitorPlay className="me-1 h-4 w-4" aria-hidden="true" />
              {t("content.tab.media")}
            </TabsTrigger>
          </TabsList>

          <WatchAdButton variant="banner" className="my-6" />

          {/* Content tabs */}
          {contentTabs.map((v) => (
            <TabsContent key={v} value={v}>
              <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
                {filterItems(v).map((item) => {
                  const Icon = typeIcons[item.type] ?? FileText;
                  const price = item.type === "course" ? ACADEMY_PRICES.miniCourse : 500;
                  return (
                    <StaggerItem key={item.id} role="listitem">
                    <Card className="flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                      <CardContent className="flex flex-1 flex-col gap-3 p-6">
                        <div className="flex items-start justify-between">
                          <div className="rounded-xl bg-primary/10 p-3" aria-hidden="true">
                            <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className="text-sm" aria-label={t("content.earnPoints").replace("{points}", String(item.points))}>+{item.points} {t("points.short")}</Badge>
                            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">{t("services.cost")}</span>
                              {formatVX(price)}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-lg font-bold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant="outline">{item.level}</Badge>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">{t("services.duration")}</span>
                            {t("content.durationMinutes").replace("{minutes}", String(item.duration))}
                          </span>
                          {item.extra_label && item.extra_value && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" aria-hidden="true" />
                              {item.extra_value} {item.extra_label}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto pt-2">
                          <Button
                            className="w-full text-base font-semibold"
                            onClick={() => handleCta(item)}
                            aria-label={`${getCtaLabel(item.type) ?? "View"}: ${item.title}`}
                          >
                            {item.type === "podcast" && <Mic className="me-1 h-4 w-4" aria-hidden="true" />}
                            {item.type === "media" && <Play className="me-1 h-4 w-4" aria-hidden="true" />}
                            {getCtaLabel(item.type) ?? "View"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            </TabsContent>
          ))}

        </Tabs>
      </section>
    </Layout>
  );
}
