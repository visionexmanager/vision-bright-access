import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";
import { MOCK_JOBS } from "@/components/career/jobs/mockJobs";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { JobMatchResult } from "../types";

function computeMatches(): JobMatchResult[] {
  const profileSkills = new Set(MOCK_PROFILE.skills.map((s) => s.name.toLowerCase()));
  return MOCK_JOBS.map((job) => {
    const jobSkills = job.skills.map((s) => s.toLowerCase());
    const matched = job.skills.filter((s) => profileSkills.has(s.toLowerCase()));
    const missing = job.skills.filter((s) => !profileSkills.has(s.toLowerCase()));
    const matchScore = jobSkills.length ? Math.round((matched.length / jobSkills.length) * 100) : 40;
    return {
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      matchScore: Math.max(matchScore, 20),
      whyMatch: matched,
      missingSkills: missing,
    };
  })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}

export function AIJobMatching() {
  const { t } = useLanguage();
  const { loading, result, run } = useAiSimulation(computeMatches, 1500);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.jobMatching.desc")}</p>

      {!result && !loading && (
        <Button onClick={run} className="self-start">
          <Sparkles className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("aiSuite.jobMatching.run")}
        </Button>
      )}

      {loading && <AIThinkingIndicator label={t("aiSuite.jobMatching.thinking")} />}

      {result && !loading && (
        <ul className="flex flex-col gap-3">
          {result.map((match) => (
            <li key={match.jobId} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{match.jobTitle}</p>
                  <p className="text-xs text-muted-foreground">{match.companyName}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">{match.matchScore}%</span>
              </div>
              {match.whyMatch.length > 0 && (
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("aiSuite.jobMatching.why")}:</span> {match.whyMatch.join(", ")}
                </p>
              )}
              {match.missingSkills.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{t("aiSuite.jobMatching.missing")}:</span> {match.missingSkills.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
