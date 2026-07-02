import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Newspaper, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

type ArticleLang = { title: string; description: string; content?: string };

type NewsArticle = {
  id: string;
  title: string;
  description: string;
  category: string;
  published_at: string | null;
  created_at: string;
  translations: Record<string, ArticleLang> | null;
};

// ── Fetch function ────────────────────────────────────────────────────────────

const FINANCE_CATEGORIES = ["world_economy", "world_politics", "business"];

async function fetchFinanceNews(): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("id, title, description, category, published_at, created_at, translations")
    .in("category", FINANCE_CATEGORIES)
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) throw error;
  return (data as NewsArticle[]) ?? [];
}

// ── Category badge color ──────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  world_economy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  world_politics: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  business: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  world_economy: "World Economy",
  world_politics: "World Politics",
  business: "Business",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketNews() {
  const navigate = useNavigate();
  const { data: articles = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["finance", "market-news"],
    queryFn: fetchFinanceNews,
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const refreshAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => refetch()}
      disabled={isFetching}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      Refresh
    </Button>
  );

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Market News"
        description="Latest global economy, politics, and business news."
        actions={refreshAction}
      >
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/3 mt-2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-3">
            <Newspaper className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold">Failed to load news</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-3">
            <Newspaper className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold">No articles yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Finance news articles will appear here once published.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const date = article.published_at
                ? format(new Date(article.published_at), "MMM d, yyyy")
                : format(new Date(article.created_at), "MMM d, yyyy");
              const colorClass = CATEGORY_COLOR[article.category] ?? "bg-muted text-muted-foreground";
              const label = CATEGORY_LABEL[article.category] ?? article.category;

              return (
                <Card
                  key={article.id}
                  className="flex flex-col gap-3 hover:shadow-md transition-shadow duration-200"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">{date}</span>
                    </div>
                    <CardTitle className="text-base leading-snug line-clamp-2">
                      {article.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {article.description}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary hover:text-primary gap-1"
                      onClick={() => {
                        const ctx = encodeURIComponent(
                          `Analyze this news article and explain its market impact:\n\nTitle: ${article.title}\n\nSummary: ${article.description}\n\nCategory: ${CATEGORY_LABEL[article.category] ?? article.category}`
                        );
                        navigate(`/finance/ai-analyst?ctx=${ctx}`);
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Ask AI
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </FinancePageShell>
    </FinanceLayout>
  );
}
