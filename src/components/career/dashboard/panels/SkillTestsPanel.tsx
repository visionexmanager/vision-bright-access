// Still mock — no skill-assessment table exists in the deployed schema. Future phase.
import { ClipboardCheck, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useComingSoon } from "@/components/career/useComingSoon";
import { MOCK_SKILL_TESTS } from "../mock/mockSkillTests";
import type { SkillTestEntry } from "../types";

const STATUS_STYLES: Record<SkillTestEntry["status"], string> = {
  not_started: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function SkillTestsPanel() {
  const { t } = useLanguage();
  const handleAction = useComingSoon();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.skillTests")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.skillTests.subtitle")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {MOCK_SKILL_TESTS.map((test) => (
          <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold">{test.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {test.durationMinutes} {t("careerDash.skillTests.minutes")}
                  {test.score !== null && ` · ${t("careerDash.skillTests.score")}: ${test.score}%`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[test.status]}`}>
                {t(`careerDash.skillTests.status.${test.status}`)}
              </span>
              <Button size="sm" variant={test.status === "completed" ? "outline" : "default"} onClick={handleAction}>
                {t(test.status === "not_started" ? "careerDash.skillTests.start" : test.status === "in_progress" ? "careerDash.skillTests.continue" : "careerDash.skillTests.review")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
