import { Brain, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useWeakTopics } from "@/hooks/library/useWeakTopics";
import { useReadingPlan } from "@/hooks/library/useCommunityAi";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryStudyAssistant() {
  const { t } = useLanguage();
  const { weakTopics, isLoading } = useWeakTopics();
  const { plan, isGenerating, generate } = useReadingPlan();

  useDocumentHead({ title: t("library.studyAssistant.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.studyAssistant.title")} breadcrumb={[{ label: t("library.studyAssistant.title") }]}>
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-5 w-5 text-primary" aria-hidden="true" /> {t("library.studyAssistant.weakAreas")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("library.studyAssistant.weakAreasDesc")}</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonLoader variant="list" count={2} />
              ) : weakTopics.length === 0 ? (
                <EmptyState icon={<Brain className="h-8 w-8" />} title={t("library.studyAssistant.noWeakAreas")} className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {weakTopics.map((topic) => (
                    <li key={topic.topic}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-muted-foreground">{t("library.studyAssistant.accuracy").replace("{accuracy}", String(topic.accuracy_percent)).replace("{count}", String(topic.attempts_count))}</span>
                      </div>
                      <Progress value={topic.accuracy_percent} className="h-1.5" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> {t("library.studyAssistant.planSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button disabled={isGenerating} onClick={() => void generate()} className="gap-1.5">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {isGenerating ? t("library.studyAssistant.generating") : t("library.studyAssistant.generatePlan")}
              </Button>

              {plan && (
                <div className="space-y-4">
                  <p className="text-sm">{plan.planSummary}</p>

                  {plan.weeklyFocus.length > 0 && (
                    <div>
                      <h2 className="mb-1.5 text-sm font-semibold">{t("library.studyAssistant.weeklyFocus")}</h2>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {plan.weeklyFocus.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {plan.studyFocus.length > 0 && (
                    <div>
                      <h2 className="mb-1.5 text-sm font-semibold">{t("library.studyAssistant.studyFocus")}</h2>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {plan.studyFocus.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {plan.bookSuggestionTitles.length > 0 && (
                    <div>
                      <h2 className="mb-1.5 text-sm font-semibold">{t("library.studyAssistant.bookSuggestions")}</h2>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {plan.bookSuggestionTitles.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
