import { useState } from "react";
import { CheckSquare, Square, Flame, Lightbulb, CalendarRange, CalendarClock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { TODAYS_TASKS, FOCUS_SUGGESTIONS, WEEKLY_GOAL_PROGRESS, MONTHLY_PROGRESS, CAREER_STREAK_DAYS } from "../mock/mockProductivity";
import type { ProductivityTask } from "../types";

export function ProductivityCenter() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<ProductivityTask[]>(TODAYS_TASKS);

  const toggleTask = (id: string) => setTasks((prev) => prev.map((tk) => (tk.id === id ? { ...tk, done: !tk.done } : tk)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.productivity")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.productivity.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="agent-glass rounded-2xl p-5 lg:col-span-2">
          <p className="mb-3 text-sm font-bold">{t("agentUI.productivity.todaysTasks")}</p>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <li key={task.id}>
                <button type="button" onClick={() => toggleTask(task.id)} aria-pressed={task.done} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {task.done ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={task.done ? "text-muted-foreground line-through" : ""}>{t(task.titleKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="agent-glass flex flex-col items-center justify-center gap-2 rounded-2xl border-amber-500/20 p-5 text-center">
          <Flame className="h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="text-3xl font-black">{CAREER_STREAK_DAYS}</p>
          <p className="text-xs text-muted-foreground">{t("agentUI.productivity.careerStreak")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="agent-glass rounded-2xl p-5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.productivity.weeklyGoals")}</p>
          <Progress value={WEEKLY_GOAL_PROGRESS} aria-label={t("agentUI.productivity.weeklyGoals")} />
          <p className="mt-1 text-xs text-muted-foreground">{WEEKLY_GOAL_PROGRESS}%</p>
        </div>
        <div className="agent-glass rounded-2xl p-5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.productivity.monthlyProgress")}</p>
          <Progress value={MONTHLY_PROGRESS} aria-label={t("agentUI.productivity.monthlyProgress")} />
          <p className="mt-1 text-xs text-muted-foreground">{MONTHLY_PROGRESS}%</p>
        </div>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.productivity.focusSuggestions")}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {FOCUS_SUGGESTIONS.map((key) => <li key={key}>• {t(key)}</li>)}
        </ul>
      </div>
    </div>
  );
}
