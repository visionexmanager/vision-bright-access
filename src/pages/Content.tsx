import { useState } from "react";
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

type ContentItem = {
  key: string;
  descKey: string;
  category: string;
  level: string;
  type: "course" | "article" | "podcast" | "media";
  points: number;
  duration: number;
  extra?: string;
};

const contentItems: ContentItem[] = [
  // Courses
  { key: "content.c1", descKey: "content.c1d", category: "Course", level: "Beginner", type: "course", points: 50, duration: 120, extra: "content.lessons|8" },
  { key: "content.c2", descKey: "content.c2d", category: "Course", level: "Intermediate", type: "course", points: 75, duration: 90, extra: "content.lessons|6" },
  { key: "content.c3", descKey: "content.c3d", category: "Course", level: "Beginner", type: "course", points: 40, duration: 60, extra: "content.lessons|5" },
  { key: "content.c4", descKey: "content.c4d", category: "Course", level: "Advanced", type: "course", points: 80, duration: 150, extra: "content.lessons|10" },
  // Articles
  { key: "content.a1", descKey: "content.a1d", category: "Article", level: "Beginner", type: "article", points: 10, duration: 5 },
  { key: "content.a2", descKey: "content.a2d", category: "Guide", level: "Intermediate", type: "article", points: 15, duration: 8 },
  { key: "content.a3", descKey: "content.a3d", category: "Tutorial", level: "Intermediate", type: "article", points: 12, duration: 7 },
  { key: "content.a4", descKey: "content.a4d", category: "Guide", level: "Beginner", type: "article", points: 10, duration: 6 },
  { key: "content.a5", descKey: "content.a5d", category: "Reference", level: "Advanced", type: "article", points: 20, duration: 10 },
  // Podcasts
  { key: "content.p1", descKey: "content.p1d", category: "Podcast", level: "Beginner", type: "podcast", points: 15, duration: 30, extra: "content.episodes|24" },
  { key: "content.p2", descKey: "content.p2d", category: "Podcast", level: "Beginner", type: "podcast", points: 15, duration: 25, extra: "content.episodes|18" },
  { key: "content.p3", descKey: "content.p3d", category: "Podcast", level: "Intermediate", type: "podcast", points: 20, duration: 35, extra: "content.episodes|12" },
  // Media
  { key: "content.m1", descKey: "content.m1d", category: "Media", level: "Beginner", type: "media", points: 20, duration: 45 },
  { key: "content.m2", descKey: "content.m2d", category: "Media", level: "Beginner", type: "media", points: 25, duration: 30 },
  { key: "content.m3", descKey: "content.m3d", category: "Media", level: "Intermediate", type: "media", points: 30, duration: 60 },
];

const typeIcons = {
  course: GraduationCap,
  article: FileText,
  podcast: Headphones,
  media: MonitorPlay,
};

const ctaKeys = {
  course: "content.enroll",
  article: "content.read",
  podcast: "content.listen",
  media: "content.watch",
};

export default function Content() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const [tab, setTab] = useState("all");

  const filtered = tab === "all"
    ? contentItems
    : contentItems.filter((i) =>
        tab === "courses" ? i.type === "course"
        : tab === "articles" ? i.type === "article"
        : tab === "podcasts" ? i.type === "podcast"
        : i.type === "media"
      );

  const handleCta = async (item: ContentItem) => {
    if (user) {
      await earnPoints(item.points, `Engaged: ${t(item.key)}`);
    }
    toast({
      title: t(item.key),
      description: `+${item.points} pts`,
    });
  };

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

          {/* Single content area for all tabs */}
          {["all", "courses", "articles", "podcasts", "media"].map((v) => (
            <TabsContent key={v} value={v}>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {(v === "all" ? contentItems : contentItems.filter((i) =>
                  v === "courses" ? i.type === "course"
                  : v === "articles" ? i.type === "article"
                  : v === "podcasts" ? i.type === "podcast"
                  : i.type === "media"
                )).map((item) => {
                  const Icon = typeIcons[item.type];
                  return (
                    <Card key={item.key} className="flex flex-col transition-shadow hover:shadow-lg">
                      <CardContent className="flex flex-1 flex-col gap-3 p-6">
                        <div className="flex items-start justify-between">
                          <div className="rounded-xl bg-primary/10 p-3">
                            <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                          </div>
                          <Badge className="text-sm">+{item.points} pts</Badge>
                        </div>

                        <h2 className="text-lg font-bold">{t(item.key)}</h2>
                        <p className="text-sm text-muted-foreground line-clamp-2">{t(item.descKey)}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{t(`cat.${item.category}`)}</Badge>
                          <Badge variant="outline">{t(`cat.${item.level}`)}</Badge>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            {t("content.duration").replace("{min}", String(item.duration))}
                          </span>
                          {item.extra && (() => {
                            const [k, n] = item.extra.split("|");
                            return (
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-4 w-4" aria-hidden="true" />
                                {t(k).replace("{n}", n)}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="mt-auto pt-2">
                          <Button
                            className="w-full text-base font-semibold"
                            onClick={() => handleCta(item)}
                          >
                            {item.type === "podcast" && <Mic className="me-1 h-4 w-4" aria-hidden="true" />}
                            {item.type === "media" && <Play className="me-1 h-4 w-4" aria-hidden="true" />}
                            {t(ctaKeys[item.type])}
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
