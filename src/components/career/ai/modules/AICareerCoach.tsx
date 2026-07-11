import { useState } from "react";
import { CheckSquare, Square, BookOpen, Briefcase, MessageSquareText, Quote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MOCK_JOBS } from "@/components/career/jobs/mockJobs";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { CoachTask } from "../types";

const TASK_KEYS = [
  "aiSuite.careerCoach.task1",
  "aiSuite.careerCoach.task2",
  "aiSuite.careerCoach.task3",
  "aiSuite.careerCoach.task4",
];

const LEARNING_KEYS = ["aiSuite.careerCoach.learn1", "aiSuite.careerCoach.learn2", "aiSuite.careerCoach.learn3"];
const TIP_KEYS = ["aiSuite.careerCoach.tip1", "aiSuite.careerCoach.tip2", "aiSuite.careerCoach.tip3"];
const MOTIVATION_KEYS = ["aiSuite.careerCoach.motivation1", "aiSuite.careerCoach.motivation2", "aiSuite.careerCoach.motivation3"];

function buildPlan(): CoachTask[] {
  return TASK_KEYS.map((titleKey, i) => ({ id: `task-${i}`, titleKey, done: false }));
}

export function AICareerCoach() {
  const { t } = useLanguage();
  const { loading, result, run } = useAiSimulation(buildPlan, 1200);
  const [tasks, setTasks] = useState<CoachTask[] | null>(null);
  const recommendedJobs = MOCK_JOBS.slice(0, 2);
  const motivationIndex = new Date().getDate() % MOTIVATION_KEYS.length;

  const generate = () => { run(); setTasks(null); };
  const toggleTask = (id: string) => {
    setTasks((prev) => (prev ?? result ?? []).map((tk) => (tk.id === id ? { ...tk, done: !tk.done } : tk)));
  };

  const activeTasks = tasks ?? result;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("aiSuite.careerCoach.desc")}</p>

      {!activeTasks && !loading && (
        <Button onClick={generate} className="self-start">{t("aiSuite.careerCoach.generate")}</Button>
      )}
      {loading && <AIThinkingIndicator label={t("aiSuite.careerCoach.thinking")} />}

      {activeTasks && !loading && (
        <div>
          <p className="mb-2 text-sm font-bold">{t("aiSuite.careerCoach.dailyTasks")}</p>
          <ul className="flex flex-col gap-1.5">
            {activeTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-pressed={task.done}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {task.done ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={task.done ? "text-muted-foreground line-through" : ""}>{t(task.titleKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />{t("aiSuite.careerCoach.learningTitle")}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {LEARNING_KEYS.map((k) => <li key={k}>• {t(k)}</li>)}
        </ul>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />{t("aiSuite.careerCoach.jobsTitle")}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {recommendedJobs.map((j) => <li key={j.id}>• {j.title} — {j.companyName}</li>)}
        </ul>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />{t("aiSuite.careerCoach.tipsTitle")}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {TIP_KEYS.map((k) => <li key={k}>• {t(k)}</li>)}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-4 text-sm italic text-primary">
        <Quote className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t(MOTIVATION_KEYS[motivationIndex])}
      </div>
    </div>
  );
}
