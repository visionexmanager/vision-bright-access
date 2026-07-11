import { useState } from "react";
import { Milestone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { RoadmapMilestone } from "../types";

function buildRoadmap(targetRole: string): RoadmapMilestone[] {
  const role = targetRole || "Data Scientist";
  return [
    { id: "m1", title: `Master the fundamentals for ${role}`, skills: ["Statistics", "Python", "SQL"], course: `Foundations of ${role} (mock course)`, monthsFromNow: 1 },
    { id: "m2", title: "Build a portfolio project", skills: ["Data Cleaning", "Visualization"], course: "Applied Project Lab (mock course)", monthsFromNow: 3 },
    { id: "m3", title: "Earn a relevant certification", skills: ["Machine Learning"], course: `${role} Certification (mock course)`, monthsFromNow: 5 },
    { id: "m4", title: "Apply and network actively", skills: ["Interviewing", "Storytelling with data"], course: "Interview Prep Track (mock course)", monthsFromNow: 6 },
    { id: "m5", title: `Land your first ${role} role`, skills: [], course: "", monthsFromNow: 8 },
  ];
}

export function AICareerRoadmap() {
  const { t } = useLanguage();
  const [role, setRole] = useState("");
  const { loading, result, run } = useAiSimulation(() => buildRoadmap(role), 1600);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.careerRoadmap.desc")}</p>

      <div>
        <Label htmlFor="roadmap-role" className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.careerRoadmap.targetRole")}</Label>
        <div className="flex gap-2">
          <Input id="roadmap-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("aiSuite.careerRoadmap.rolePlaceholder")} />
          <Button onClick={run} disabled={loading} className="shrink-0">{t("aiSuite.careerRoadmap.generate")}</Button>
        </div>
      </div>

      {loading && <AIThinkingIndicator label={t("aiSuite.careerRoadmap.thinking")} />}

      {result && !loading && (
        <ol className="flex flex-col gap-4">
          {result.map((m, i) => (
            <li key={m.id} className="relative flex gap-3 ps-1">
              {i < result.length - 1 && <span className="absolute start-[15px] top-8 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden="true" />}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Milestone className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pb-2">
                <p className="text-sm font-bold">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t("aiSuite.careerRoadmap.monthsFromNow").replace("{count}", String(m.monthsFromNow))}
                </p>
                {m.skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.skills.map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{s}</span>)}
                  </div>
                )}
                {m.course && <p className="mt-1 text-xs text-primary">{m.course}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
