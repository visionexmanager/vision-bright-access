import { useState } from "react";
import { Target, CheckCircle2, Circle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { MOCK_CAREER_GOALS } from "../mock/mockGoals";
import type { CareerGoal } from "../types";

const ROADMAP_STEPS = [
  { id: "step-1", labelKey: "careerDash.roadmap.step1", done: true },
  { id: "step-2", labelKey: "careerDash.roadmap.step2", done: true },
  { id: "step-3", labelKey: "careerDash.roadmap.step3", done: false },
  { id: "step-4", labelKey: "careerDash.roadmap.step4", done: false },
  { id: "step-5", labelKey: "careerDash.roadmap.step5", done: false },
];

export function CareerRoadmapPanel() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<CareerGoal[]>(MOCK_CAREER_GOALS);
  const activeGoal = goals.find((g) => g.active);

  const toggleGoal = (id: string) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, active: !g.active } : g)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.careerRoadmap")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.roadmap.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-bold">{t("careerDash.roadmap.goalsTitle")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                aria-pressed={goal.active}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  goal.active ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background hover:border-primary/20"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${goal.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{t(goal.titleKey)}</span>
                <Progress value={goal.progress} className="w-full" aria-label={t(goal.titleKey)} />
                <span className="text-xs text-muted-foreground">{goal.progress}% · {t(goal.active ? "careerDash.roadmap.active" : "careerDash.roadmap.inactive")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeGoal && (
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="mb-4 font-bold">
            {t("careerDash.roadmap.pathTo")} {t(activeGoal.titleKey)}
          </h2>
          <ol className="flex flex-col gap-3">
            {ROADMAP_STEPS.map((step, i) => (
              <li key={step.id} className="relative flex items-start gap-3 ps-1">
                {i < ROADMAP_STEPS.length - 1 && (
                  <span className="absolute start-[11px] top-6 h-[calc(100%-0.25rem)] w-px bg-border" aria-hidden="true" />
                )}
                {step.done ? (
                  <CheckCircle2 className="relative h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="relative h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={`pt-0.5 text-sm ${step.done ? "text-muted-foreground line-through" : "font-medium"}`}>
                  {t(step.labelKey)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
