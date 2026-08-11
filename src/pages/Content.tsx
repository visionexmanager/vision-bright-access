import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ExternalLink,
  Lock,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WatchAdButton } from "@/components/WatchAdButton";
import { AITaskPanel } from "@/components/AITaskPanel";
import { SmartSearch } from "@/components/SmartSearch";

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
  content_url: string | null;
};

const typeIcons = {
  course: GraduationCap,
  article: FileText,
  podcast: Headphones,
  media: MonitorPlay,
};

/**
 * Each type reuses the CTA label already translated in all 15 locale files.
 * A `content.cta.<type>` namespace was referenced here before but never
 * existed in any dictionary, so every language rendered the English fallback.
 */
const CTA_KEYS = {
  course: "content.enroll",
  article: "content.read",
  podcast: "content.listen",
  media: "content.watch",
} as const;

/**
 * award_points() caps the "Engaged:%" reason at 50 points and raises otherwise.
 * An admin can enter any number in /admin/content, so clamp here instead of
 * letting the RPC reject the award after the VX has already been spent.
 */
const MAX_ENGAGEMENT_POINTS = 50;

/** Only absolute http(s) URLs may reach an anchor href. */
function safeContentUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

const difficultyStyle: Record<string, string> = {
  Beginner: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  Intermediate: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Advanced: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

const priceOf = (item: ContentItem) => (item.type === "course" ? ACADEMY_PRICES.miniCourse : 500);

export default function Content() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { spendVX } = useVXWallet();
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLHeadingElement>());
  const openLinkRefs = useRef(new Map<string, HTMLAnchorElement>());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase.from("content_items").select("*").order("created_at");
    if (error) {
      console.error("content_items load error:", error.message);
      setLoadError(true);
      setItems([]);
    } else {
      setItems((data ?? []) as ContentItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Purchases are recorded by spend_vx(); reading them back is what keeps a
  // second click from charging for content the user already owns.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setUnlocked(new Set());
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("vx_purchases")
        .select("item_id")
        .eq("user_id", userId)
        .in("item_type", ["course", "article", "podcast", "media"]);
      if (!active) return;
      setUnlocked(new Set((data ?? []).map((row) => row.item_id).filter((id): id is string => Boolean(id))));
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // A post-await window.open() is treated as an unrequested popup and blocked,
  // so unlocking swaps the CTA for a real link and moves focus onto it. Keyboard
  // and screen-reader users land exactly on the control that opens the material.
  useEffect(() => {
    if (!justUnlocked) return;
    const link = openLinkRefs.current.get(justUnlocked);
    link?.focus();
    setJustUnlocked(null);
  }, [justUnlocked, unlocked]);

  const handleUnlock = async (item: ContentItem) => {
    if (!user) {
      toast({
        title: t("vxWallet.loginRequired"),
        description: t("vxWallet.loginRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setPending(item.id);
    try {
      const ok = await spendVX(priceOf(item), item.type, item.title, item.id);
      if (!ok) return;

      setUnlocked((current) => new Set(current).add(item.id));
      setJustUnlocked(item.id);

      const points = Math.min(Math.max(item.points, 0), MAX_ENGAGEMENT_POINTS);
      const awarded = points > 0 && (await earnPoints(points, `Engaged: ${item.title}`));

      toast({
        title: item.title,
        description: awarded
          ? `${t("content.unlocked")} · +${points} ${t("points.short")}`
          : t("content.unlocked"),
      });
    } finally {
      setPending(null);
    }
  };

  const contentTabs = ["all", "courses", "articles", "podcasts", "media"];

  const filterItems = useCallback(
    (v: string) =>
      v === "all"
        ? items
        : items.filter((i) =>
            v === "courses" ? i.type === "course"
            : v === "articles" ? i.type === "article"
            : v === "podcasts" ? i.type === "podcast"
            : i.type === "media"
          ),
    [items],
  );

  const aiContext = useMemo(
    () => ({
      activeTab: tab,
      items: filterItems(tab).map(({ title, description, type, category, level }) => ({
        title,
        description,
        type,
        category,
        level,
      })),
    }),
    [tab, filterItems],
  );

  // A content hit used to navigate to /content — the page the user is already
  // on. Switch to the "all" tab instead and move focus onto the matching card.
  const revealSearchResult = (id: string) => {
    if (!items.some((item) => item.id === id)) return;
    setTab("all");
    setHighlighted(id);
    requestAnimationFrame(() => {
      const heading = cardRefs.current.get(id);
      heading?.scrollIntoView({ block: "center", behavior: "smooth" });
      heading?.focus();
    });
  };

  if (loading) {
    return (
      <Layout>
        <div role="status" aria-label={t("content.loading")} className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="content-heading">
        <AnimatedSection variants={scaleFade}>
          <h1 id="content-heading" className="mb-2 text-3xl font-bold">{t("content.title")}</h1>
          <p className="mb-8 text-lg text-muted-foreground">{t("content.subtitle")}</p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="mb-6">
            <SmartSearch
              source="content_items"
              onSelect={(result) => revealSearchResult(result.id)}
            />
          </div>
        </AnimatedSection>

        {loadError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
            <p className="mb-4 text-base font-medium">{t("content.loadFailed")}</p>
            <Button onClick={() => void load()}>{t("content.tryAgain")}</Button>
          </div>
        ) : items.length === 0 ? (
          <p role="status" className="rounded-xl border bg-muted/30 p-8 text-center text-base text-muted-foreground">
            {t("content.empty")}
          </p>
        ) : (
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
          {contentTabs.map((v) => {
            const visible = filterItems(v);
            return (
            <TabsContent key={v} value={v}>
              {visible.length === 0 ? (
                <p role="status" className="rounded-xl border bg-muted/30 p-8 text-center text-base text-muted-foreground">
                  {t("content.emptyFiltered")}
                </p>
              ) : (
              <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
                {visible.map((item) => {
                  const Icon = typeIcons[item.type] ?? FileText;
                  const price = priceOf(item);
                  const url = safeContentUrl(item.content_url);
                  const isUnlocked = url !== null && unlocked.has(item.id);
                  const ctaLabel = t(CTA_KEYS[item.type] ?? "content.read");
                  return (
                    <StaggerItem key={item.id} role="listitem">
                    <Card
                      className={`flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                        highlighted === item.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <CardContent className="flex flex-1 flex-col gap-3 p-6">
                        <div className="flex items-start justify-between">
                          <div className="rounded-xl bg-primary/10 p-3" aria-hidden="true">
                            <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className="text-sm" aria-label={t("content.earnPoints").replace("{points}", String(Math.min(item.points, MAX_ENGAGEMENT_POINTS)))}>+{Math.min(item.points, MAX_ENGAGEMENT_POINTS)} {t("points.short")}</Badge>
                            {url && !isUnlocked && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only">{t("services.cost")}</span>
                                {formatVX(price)}
                              </span>
                            )}
                            {isUnlocked && (
                              <Badge variant="outline" className="border-green-500/40 text-xs text-green-700 dark:text-green-400">
                                {t("content.unlocked")}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <h3
                          className="text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          tabIndex={-1}
                          ref={(node) => {
                            if (node) cardRefs.current.set(item.id, node);
                            else cardRefs.current.delete(item.id);
                          }}
                        >
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant="outline" className={difficultyStyle[item.level]}>{item.level}</Badge>
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
                          {/* Nothing to open yet: show the state instead of charging for a toast. */}
                          {!url ? (
                            <p className="flex items-center justify-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                              <Lock className="h-4 w-4" aria-hidden="true" />
                              {t("content.notAvailableYet")}
                            </p>
                          ) : isUnlocked ? (
                            <Button asChild className="w-full text-base font-semibold">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                ref={(node) => {
                                  if (node) openLinkRefs.current.set(item.id, node);
                                  else openLinkRefs.current.delete(item.id);
                                }}
                                aria-label={`${t("content.open")}: ${item.title} (${t("content.opensNewTab")})`}
                              >
                                <ExternalLink className="me-1 h-4 w-4" aria-hidden="true" />
                                {t("content.open")}
                              </a>
                            </Button>
                          ) : (
                            <Button
                              className="w-full text-base font-semibold"
                              disabled={pending === item.id}
                              onClick={() => void handleUnlock(item)}
                              aria-label={`${ctaLabel}: ${item.title} — ${formatVX(price)}`}
                            >
                              {item.type === "podcast" && <Mic className="me-1 h-4 w-4" aria-hidden="true" />}
                              {item.type === "media" && <Play className="me-1 h-4 w-4" aria-hidden="true" />}
                              {ctaLabel}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
              )}
            </TabsContent>
            );
          })}

        </Tabs>
        )}
        <div className="mt-8">
          <AITaskPanel
            assistantId="content-guide"
            title="AI content guide"
            description="Summarize, simplify, or turn the visible library into a learning path."
            actions={[
              { label: "Recommend next", prompt: "Recommend the best next item and explain why." },
              { label: "Learning path", prompt: "Build a short learning path from these items, from easiest to hardest." },
              { label: "Accessible overview", prompt: "Give a concise, screen-reader-friendly overview of the available content." },
            ]}
            context={aiContext}
          />
        </div>
      </section>
    </Layout>
  );
}
