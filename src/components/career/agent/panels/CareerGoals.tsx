import { useState } from "react";
import { Plus, Trash2, Calendar, Flag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MOCK_GOALS, GOAL_LIBRARY_KEYS } from "../mock/mockGoals";
import type { CareerGoalItem, GoalPriority } from "../types";

const PRIORITIES: GoalPriority[] = ["high", "medium", "low"];
const PRIORITY_STYLES: Record<GoalPriority, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export function CareerGoals() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<CareerGoalItem[]>(MOCK_GOALS);
  const [open, setOpen] = useState(false);
  const [titleKey, setTitleKey] = useState(GOAL_LIBRARY_KEYS[0]);
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [deadline, setDeadline] = useState("");

  const addGoal = () => {
    if (!deadline) return;
    setGoals((prev) => [
      ...prev,
      { id: `goal-${Date.now()}`, titleKey, priority, deadline, progress: 0, estimatedCompletion: deadline },
    ]);
    setOpen(false);
    setDeadline("");
  };

  const removeGoal = (id: string) => setGoals((prev) => prev.filter((g) => g.id !== id));
  const updateProgress = (id: string, progress: number) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress } : g)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("agentUI.nav.goals")}</h1>
          <p className="text-sm text-muted-foreground">{t("agentUI.goals.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("agentUI.goals.add")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => (
          <div key={goal.id} className="agent-glass flex flex-col gap-3 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">{t(goal.titleKey)}</p>
              <button type="button" onClick={() => removeGoal(goal.id)} aria-label={t("agentUI.goals.remove")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${PRIORITY_STYLES[goal.priority]}`}>
                <Flag className="h-3 w-3" aria-hidden="true" />
                {t(`agentUI.goals.priority.${goal.priority}`)}
              </span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden="true" />{t("agentUI.goals.deadline")}: {goal.deadline}</span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("agentUI.goals.progress")}</span>
                <span className="font-semibold">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} aria-label={t("agentUI.goals.progress")} />
              <input
                type="range"
                min={0}
                max={100}
                value={goal.progress}
                onChange={(e) => updateProgress(goal.id, Number(e.target.value))}
                aria-label={t("agentUI.goals.updateProgress").replace("{title}", t(goal.titleKey))}
                className="mt-2 w-full accent-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("agentUI.goals.estimatedCompletion")}: {goal.estimatedCompletion}</p>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("agentUI.goals.add")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>{t("agentUI.goals.goalType")}</Label>
              <Select value={titleKey} onValueChange={setTitleKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_LIBRARY_KEYS.map((key) => <SelectItem key={key} value={key}>{t(key)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("agentUI.goals.priority.label")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as GoalPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`agentUI.goals.priority.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="goal-deadline">{t("agentUI.goals.deadline")}</Label>
              <Input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={addGoal} disabled={!deadline}>{t("agentUI.goals.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
