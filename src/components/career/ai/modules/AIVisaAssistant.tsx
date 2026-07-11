import { Plane, ClipboardList } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MOCK_JOBS } from "@/components/career/jobs/mockJobs";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { VisaCountryMatch } from "../types";

const CANDIDATE_COUNTRIES = ["Canada", "Germany", "United Kingdom", "Australia", "United Arab Emirates", "Japan"];

const REQUIREMENTS_BY_FEASIBILITY: Record<VisaCountryMatch["feasibility"], string[]> = {
  high: ["Valid passport", "Job offer letter", "Degree certificate (attested)"],
  medium: ["Valid passport", "Job offer letter", "Language proficiency test", "Degree certificate (attested)"],
  low: ["Valid passport", "Job offer letter", "Language proficiency test", "Points-based eligibility review", "Proof of funds"],
};

function feasibilityFromScore(score: number): VisaCountryMatch["feasibility"] {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function computeVisaMatches(): VisaCountryMatch[] {
  return CANDIDATE_COUNTRIES.map((country) => {
    const jobs = MOCK_JOBS.filter((j) => j.isVisaSponsorship && j.country === country);
    const score = Math.min(95, 30 + jobs.length * 20 + (country.length % 15));
    const feasibility = feasibilityFromScore(score);
    return {
      country,
      matchScore: score,
      visaSponsorshipJobs: jobs.length,
      feasibility,
      requirements: REQUIREMENTS_BY_FEASIBILITY[feasibility],
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

const FEASIBILITY_STYLES: Record<VisaCountryMatch["feasibility"], string> = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function AIVisaAssistant() {
  const { t } = useLanguage();
  const { loading, result, run } = useAiSimulation(computeVisaMatches, 1600);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.visaAssistant.desc")}</p>

      {!result && !loading && (
        <Button onClick={run} className="self-start">
          <Plane className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("aiSuite.visaAssistant.run")}
        </Button>
      )}

      {loading && <AIThinkingIndicator label={t("aiSuite.visaAssistant.thinking")} />}

      {result && !loading && (
        <ul className="flex flex-col gap-3">
          {result.map((match) => (
            <li key={match.country} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">{match.country}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${FEASIBILITY_STYLES[match.feasibility]}`}>
                  {t(`aiSuite.visaAssistant.feasibility.${match.feasibility}`)}
                </span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("aiSuite.visaAssistant.matchScore")}: <span className="font-semibold text-foreground">{match.matchScore}%</span>
                {" · "}
                {t("aiSuite.visaAssistant.sponsorshipJobs").replace("{count}", String(match.visaSponsorshipJobs))}
              </p>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />{t("aiSuite.visaAssistant.requirements")}</p>
              <ul className="text-xs text-muted-foreground">
                {match.requirements.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
