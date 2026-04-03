import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Briefcase,
  ArrowRight,
  BarChart3,
  Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";
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

type Simulation = {
  id: string;
  title: string;
  description: string;
  subcategory: string;
  slug: string;
  points: number;
  difficulty: string;
  estimated_duration: number;
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

const difficultyStyle: Record<string, string> = {
  Beginner: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  Intermediate: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Advanced: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function Content() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [simSubFilter, setSimSubFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [contentRes, simRes] = await Promise.all([
        supabase.from("content_items").select("*").order("created_at"),
        supabase.from("simulations").select("*").eq("published", true).order("sort_order"),
      ]);
      if (contentRes.data) setItems(contentRes.data as ContentItem[]);
      if (simRes.data) setSimulations(simRes.data as Simulation[]);
      setLoading(false);
    };
    load();
  }, []);

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
            <TabsTrigger value="simulations" className="text-base">
              <Briefcase className="me-1 h-4 w-4" aria-hidden="true" />
              {t("content.tab.simulations")}
            </TabsTrigger>
          </TabsList>

          {/* Content tabs */}
          {contentTabs.map((v) => (
            <TabsContent key={v} value={v}>
              {/* Simulator banner inside "all" tab */}
              {v === "all" && simulations.length > 0 && (
                <div
                  className="mb-6 cursor-pointer rounded-xl border bg-gradient-to-r from-primary/10 to-primary/5 p-5 transition-shadow hover:shadow-lg group"
                  onClick={() => setTab("simulations")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setTab("simulations")}
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-primary/20 p-3 shrink-0">
                      <Briefcase className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold">{t("bsim.title")}</h2>
                      <p className="text-sm text-muted-foreground">{t("bsim.bannerDesc")}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{simulations.length}</Badge>
                    <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filterItems(v).map((item) => {
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

          {/* Simulations tab */}
          <TabsContent value="simulations">
            {/* Hero banner */}
            <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-6 md:p-10 border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-primary/20 p-3">
                  <Briefcase className="h-8 w-8 text-primary" />
                </div>
                <Badge variant="secondary" className="text-sm font-medium">
                  {simulations.length} {t("bsim.badge")}
                </Badge>
              </div>
              <h2 className="mb-2 text-2xl font-bold md:text-3xl">{t("bsim.title")}</h2>
              <p className="max-w-2xl text-muted-foreground leading-relaxed">{t("bsim.description")}</p>
            </div>

            {/* Subcategory filter chips */}
            {simulations.length > 0 && (() => {
              const subcats = Array.from(new Set(simulations.map((s) => s.subcategory))).sort();
              const filteredSims = simSubFilter === "all" ? simulations : simulations.filter((s) => s.subcategory === simSubFilter);
              return (
                <>
                  {subcats.length > 1 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={simSubFilter === "all" ? "default" : "outline"}
                        onClick={() => setSimSubFilter("all")}
                        className="rounded-full"
                      >
                        {t("content.tab.all")} ({simulations.length})
                      </Button>
                      {subcats.map((sc) => (
                        <Button
                          key={sc}
                          size="sm"
                          variant={simSubFilter === sc ? "default" : "outline"}
                          onClick={() => setSimSubFilter(sc)}
                          className="rounded-full"
                        >
                          {sc} ({simulations.filter((s) => s.subcategory === sc).length})
                        </Button>
                      ))}
                    </div>
                  )}

                  {filteredSims.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Rocket className="h-16 w-16 text-muted-foreground/30 mb-4" />
                      <p className="text-lg font-medium text-muted-foreground">{t("bsim.empty")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredSims.map((sim) => (
                  <Card
                    key={sim.id}
                    className="group flex flex-col overflow-hidden border-2 border-transparent transition-all hover:border-primary/20 hover:shadow-xl hover:-translate-y-1"
                  >
                    {/* Colored top accent bar */}
                    <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary/60" />
                    <CardContent className="flex flex-1 flex-col gap-4 p-6">
                      <div className="flex items-start justify-between">
                        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 p-3">
                          <BarChart3 className="h-7 w-7 text-primary" />
                        </div>
                        <Badge className="text-sm font-bold bg-primary/10 text-primary border-primary/20">
                          +{sim.points} pts
                        </Badge>
                      </div>

                      <h3 className="text-lg font-bold leading-tight">{sim.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">{sim.description}</p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-medium">{sim.subcategory}</Badge>
                        <Badge
                          variant="outline"
                          className={difficultyStyle[sim.difficulty] || ""}
                        >
                          {sim.difficulty}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>~{sim.estimated_duration} min</span>
                      </div>

                      <div className="mt-auto pt-2">
                        <Button
                          asChild
                          className="w-full text-base font-semibold group-hover:gap-3 transition-all"
                        >
                          <Link to={`/business-simulator/${sim.slug}`}>
                            <Rocket className="h-4 w-4" />
                            {t("bsim.start")}
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}
