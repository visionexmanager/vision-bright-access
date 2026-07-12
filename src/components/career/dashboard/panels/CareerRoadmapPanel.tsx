import { useState } from "react";
import { Target, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCareerGoals } from "@/hooks/career/useCareerGoals";
import { CareerErrorState } from "../../ui/CareerErrorState";

const ROADMAP_STEPS = [
  { id: "step-1", labelKey: "careerDash.roadmap.step1", done: true },
  { id: "step-2", labelKey: "careerDash.roadmap.step2", done: true },
  { id: "step-3", labelKey: "careerDash.roadmap.step3", done: false },
  { id: "step-4", labelKey: "careerDash.roadmap.step4", done: false },
  { id: "step-5", labelKey: "careerDash.roadmap.step5", done: false },
];

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

export function CareerRoadmapPanel() {
  const { t } = useLanguage();
  const { goals, isLoading, error, refetch, createGoal, isCreating, updateProgress, removeGoal } = useCareerGoals();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const selectedGoal = goals.find((g) => g.id === selectedId) ?? goals[0] ?? null;

  const submit = async () => {
    if (!title.trim()) return;
    await createGoal({ title: title.trim() });
    setTitle("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.careerRoadmap")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.roadmap.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("careerDash.roadmap.addGoal")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-bold">{t("careerDash.roadmap.goalsTitle")}</h2>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl border border-border/50 bg-background animate-pulse" aria-hidden="true" />)}
          </div>
        ) : error ? (
          <CareerErrorState message={error} onRetry={refetch} />
        ) : goals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("careerDash.roadmap.empty")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all ${
                  selectedGoal?.id === goal.id ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background hover:border-primary/20"
                }`}
              >
                <div className="flex w-full items-start justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedId(goal.id)}
                    className="flex flex-1 items-center gap-2 text-start focus-visible:outline-none"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedGoal?.id === goal.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Target className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">{goal.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGoal(goal.id)}
                    aria-label={t("careerDash.roadmap.remove")}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <Progress value={goal.progress} className="w-full" aria-label={goal.title} />
                <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                  <span>{goal.progress}%</span>
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateProgress({ goalId: goal.id, progress: p })}
                        className={`rounded px-1.5 py-0.5 transition-colors hover:bg-muted ${goal.progress === p ? "font-bold text-primary" : ""}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedGoal && (
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="mb-4 font-bold">
            {t("careerDash.roadmap.pathTo")} {selectedGoal.title}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("careerDash.roadmap.addGoal")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="goal-title">{t("careerDash.roadmap.goalTitle")}</Label>
            <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={submit} disabled={isCreating || !title.trim()}>
              {isCreating ? t("careerDash.profile.saving") : t("careerDash.profile.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
