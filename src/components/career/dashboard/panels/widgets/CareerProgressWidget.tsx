import { Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { MOCK_CAREER_GOALS } from "../../mock/mockGoals";

export function CareerProgressWidget() {
  const { t } = useLanguage();
  const activeGoals = MOCK_CAREER_GOALS.filter((g) => g.active);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{t("careerDash.widget.careerProgress")}</h3>
      </div>
      <div className="flex flex-col gap-4">
        {activeGoals.map((goal) => {
          const Icon = goal.icon;
          return (
            <div key={goal.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {t(goal.titleKey)}
                </span>
                <span className="text-muted-foreground">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} aria-label={t(goal.titleKey)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
