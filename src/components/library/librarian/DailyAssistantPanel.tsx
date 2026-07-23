import { Sparkles, BookOpen, Brain, Headphones, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibrarianDailyPlan } from "@/hooks/library/useLibrarianDailyPlan";
import { useLanguage } from "@/contexts/LanguageContext";

function PlanSectionCard({ icon: Icon, title, summary, focusItems }: { icon: React.ElementType; title: string; summary: string; focusItems?: string[] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {title}</h3>
      <p className="mb-2 text-sm text-muted-foreground">{summary}</p>
      {focusItems && focusItems.length > 0 && (
        <ul className="ms-4 list-disc space-y-0.5 text-sm">
          {focusItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </Card>
  );
}

export function DailyAssistantPanel() {
  const { t } = useLanguage();
  const { plan, isLoading, isGenerating, generate } = useLibrarianDailyPlan();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.dailyPlan.title")}
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isGenerating} onClick={() => void generate(!!plan)}>
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {plan ? t("library.librarian.dailyPlan.regenerate") : t("library.librarian.dailyPlan.generate")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : !plan ? (
        <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.librarian.dailyPlan.empty")} className="py-8" />
      ) : (
        <div className="space-y-3">
          <Card className="border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">{plan.motivational_summary}</p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlanSectionCard icon={BookOpen} title={t("library.librarian.dailyPlan.readingPlan")} summary={plan.reading_plan.summary} focusItems={plan.reading_plan.focus_items} />
            <PlanSectionCard icon={Brain} title={t("library.librarian.dailyPlan.studyPlan")} summary={plan.study_plan.summary} focusItems={plan.study_plan.focus_items} />
            <PlanSectionCard icon={Headphones} title={t("library.librarian.dailyPlan.listeningPlan")} summary={plan.listening_plan.summary} />
            <PlanSectionCard icon={RotateCcw} title={t("library.librarian.dailyPlan.reviewPlan")} summary={plan.review_plan.summary} />
          </div>

          {plan.due_flashcard_ids.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-1.5 text-sm font-semibold">{t("library.librarian.dailyPlan.dueFlashcards")}</h3>
              <p className="text-sm text-muted-foreground">{t("library.librarian.dailyPlan.dueFlashcardsCount").replace("{count}", String(plan.due_flashcard_ids.length))}</p>
            </Card>
          )}

          {plan.practice_questions.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("library.librarian.dailyPlan.practiceQuestions")}</h3>
              <ul className="space-y-2">
                {plan.practice_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">{q.topic}</Badge>
                    <span>{q.question}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
