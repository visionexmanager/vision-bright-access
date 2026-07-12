import { Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { useCareerGoals } from "@/hooks/career/useCareerGoals";

export function CareerProgressWidget() {
  const { t } = useLanguage();
  const { goals, isLoading } = useCareerGoals();
  const topGoals = goals.slice(0, 3);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{t("careerDash.widget.careerProgress")}</h3>
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />
      ) : topGoals.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("careerDash.roadmap.empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {topGoals.map((goal) => (
            <div key={goal.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {goal.title}
                </span>
                <span className="text-muted-foreground">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} aria-label={goal.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
