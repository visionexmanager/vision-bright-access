import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
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
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

const ctaLabels: Record<string, string> = {
  course: "Enroll Now",
  article: "Read Article",
  podcast: "Listen",
  media: "Watch",
};

export default function Content() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
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

  const filtered = tab === "all"
    ? items
    : items.filter((i) => i.type === (tab === "courses" ? "course" : tab === "articles" ? "article" : tab === "podcasts" ? "podcast" : "media"));

  const handleCta = async (item: ContentItem) => {
    if (user) {
      await earnPoints(item.points, `Engaged: ${item.title}`);
    }
    toast({
      title: item.title,
      description: `+${item.points} pts`,
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="content-heading">
        <h1 id="content-heading" className="mb-2 text-3xl font-bold">{t("content.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("content.subtitle")}</p>

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

          {["all", "courses", "articles", "podcasts", "media"].map((v) => (
            <TabsContent key={v} value={v}>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {(v === "all" ? items : items.filter((i) =>
                  v === "courses" ? i.type === "course"
                  : v === "articles" ? i.type === "article"
                  : v === "podcasts" ? i.type === "podcast"
                  : i.type === "media"
                )).map((item) => {
                  const Icon = typeIcons[item.type] ?? FileText;
                  return (
                    <Card key={item.id} className="flex flex-col transition-shadow hover:shadow-lg">
                      <CardContent className="flex flex-1 flex-col gap-3 p-6">
                        <div className="flex items-start justify-between">
                          <div className="rounded-xl bg-primary/10 p-3">
                            <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                          </div>
                          <Badge className="text-sm">+{item.points} pts</Badge>
                        </div>

                        <h2 className="text-lg font-bold">{item.title}</h2>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant="outline">{item.level}</Badge>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            {item.duration} min
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
                          >
                            {item.type === "podcast" && <Mic className="me-1 h-4 w-4" aria-hidden="true" />}
                            {item.type === "media" && <Play className="me-1 h-4 w-4" aria-hidden="true" />}
                            {ctaLabels[item.type] ?? "View"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </Layout>
  );
}
