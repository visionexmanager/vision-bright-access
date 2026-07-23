import { Link } from "react-router-dom";
import { TrendingUp, Sparkles, BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/library/EmptyState";
import { BookCard } from "@/components/library/BookCard";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { useAiInsights } from "@/hooks/library/useAiInsights";
import { useRecommendations } from "@/hooks/library/useRecommendations";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryAiInsights() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { trendingTopics, isLoading: isLoadingTrending } = useAiInsights(12);
  const { books: recommendations, isLoading: isLoadingRecs } = useRecommendations(8);

  useDocumentHead({ title: t("library.aiInsights.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.aiInsights.title")} breadcrumb={[{ label: t("library.aiInsights.title") }]}>
        <div className="space-y-8">
          <section>
            <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
              <TrendingUp className="h-4 w-4" aria-hidden="true" /> {t("library.aiInsights.trendingTopics")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{t("library.aiInsights.trendingTopicsDescription")}</p>
            {isLoadingTrending ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
            ) : trendingTopics.length === 0 ? (
              <EmptyState icon={<TrendingUp className="h-8 w-8" />} title={t("library.aiInsights.noTrends")} className="py-8" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trendingTopics.map((topic) => (
                  <Link key={topic.entity_id} to={topic.slug ? `/library/knowledge-graph/${topic.slug}` : "#"}>
                    <Card className="flex items-center justify-between gap-2 p-3 hover:shadow-md">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{topic.name}</p>
                        <Badge className={`mt-1 text-xs ${KG_ENTITY_TYPE_COLORS[topic.entity_type]?.badge}`} variant="secondary">
                          {t(`library.knowledgeGraph.entityType.${topic.entity_type}`)}
                        </Badge>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">×{topic.growth_ratio.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">{topic.recent_mentions} {t("library.aiInsights.mentions")}</p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {user && (
            <section>
              <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("library.aiInsights.recommendedForYou")}
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">{t("library.aiInsights.recommendedForYouDescription")}</p>
              {isLoadingRecs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
              ) : recommendations.length === 0 ? (
                <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.aiInsights.noRecommendations")} className="py-8" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {recommendations.map((book) => <BookCard key={book.id} book={book} />)}
                </div>
              )}
            </section>
          )}

          <section>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{t("library.aiInsights.deeperAnalytics")}</p>
                  <p className="text-xs text-muted-foreground">{t("library.aiInsights.deeperAnalyticsDescription")}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/library/learning-analytics">{t("library.aiInsights.openAnalytics")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </Button>
            </Card>
          </section>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
