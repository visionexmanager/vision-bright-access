import { useState } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_CANDIDATES } from "../mock/mockCandidates";
import type { Candidate } from "../types";

function runScreening(): Candidate[] {
  return [...MOCK_CANDIDATES]
    .filter((c) => c.stage !== "hired" && c.stage !== "rejected")
    .sort((a, b) => b.matchScore - a.matchScore);
}

function explain(candidate: Candidate): string {
  const strong = candidate.matchedSkills.slice(0, 3).join(", ");
  return `Strong match on ${strong || "core requirements"}, ${candidate.experienceYears} years of relevant experience, and a ${candidate.cultureFit}/100 culture-fit signal from screening responses.`;
}

export function AIScreeningEngine() {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { loading, result, run } = useAiSimulation(runScreening, 1600);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.aiScreening")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.aiScreening.subtitle")}</p>
      </div>

      {!result && !loading && (
        <Button onClick={run} className="self-start">
          <Filter className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("employerDash.aiScreening.run")}
        </Button>
      )}

      {loading && <AIThinkingIndicator label={t("employerDash.aiScreening.thinking")} />}

      {result && !loading && (
        <ol className="flex flex-col gap-3">
          {result.map((c, i) => {
            const expanded = expandedId === c.id;
            return (
              <li key={c.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <CompanyAvatar name={c.name} color={c.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.appliedJobTitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">{c.matchScore}</span>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    aria-expanded={expanded}
                    aria-label={t("employerDash.aiScreening.why")}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border/50 pt-3">
                    <p className="text-xs text-muted-foreground">{explain(c)}</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([["skillMatch", t("employerDash.candidates.skillMatch")], ["experienceMatch", t("employerDash.candidates.experienceMatch")], ["salaryFit", t("employerDash.candidates.salaryFit")]] as const).map(([key, label]) => (
                        <div key={key}>
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span>{c[key]}</span></div>
                          <Progress value={c[key]} aria-label={label} />
                        </div>
                      ))}
                    </div>
                    {c.missingSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.missingSkills.map((s) => <span key={s} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">{s}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
