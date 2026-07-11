import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";
import { MOCK_APPLICATIONS } from "@/components/career/dashboard/mock/mockApplications";
import { MOCK_INTERVIEWS } from "@/components/career/dashboard/mock/mockInterviews";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import { ScoreRing } from "../ScoreRing";
import type { HealthScoreBreakdown } from "../types";

function computeHealthScore(): HealthScoreBreakdown {
  const profileChecks = [
    MOCK_PROFILE.bio.length > 0,
    MOCK_PROFILE.skills.length >= 3,
    MOCK_PROFILE.experience.length > 0,
    MOCK_PROFILE.projects.length > 0,
    Boolean(MOCK_PROFILE.links.linkedin),
  ];
  const profileStrength = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);

  const expertSkills = MOCK_PROFILE.skills.filter((s) => s.proficiency === "expert" || s.proficiency === "advanced").length;
  const skillsStrength = Math.min(100, 50 + expertSkills * 10);

  const marketDemand = Math.min(100, 55 + MOCK_PROFILE.skills.length * 5);

  const interviewReadiness = Math.min(100, 40 + MOCK_INTERVIEWS.length * 15 + MOCK_APPLICATIONS.filter((a) => a.status === "interview" || a.status === "offer").length * 10);

  const salaryPotential = Math.min(100, 60 + MOCK_PROFILE.experience.length * 8);

  return { profileStrength, skillsStrength, marketDemand, interviewReadiness, salaryPotential };
}

export function AICareerHealthScore() {
  const { t } = useLanguage();
  const { loading, result, run } = useAiSimulation(computeHealthScore, 1500);

  const overall = result
    ? Math.round((result.profileStrength + result.skillsStrength + result.marketDemand + result.interviewReadiness + result.salaryPotential) / 5)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.healthScore.desc")}</p>

      {!result && !loading && <Button onClick={run} className="self-start">{t("aiSuite.healthScore.run")}</Button>}
      {loading && <AIThinkingIndicator label={t("aiSuite.healthScore.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <ScoreRing value={overall} size={140} sublabel={t("aiSuite.healthScore.overall")} />
          </div>
          <div className="flex flex-col gap-3">
            {(["profileStrength", "skillsStrength", "marketDemand", "interviewReadiness", "salaryPotential"] as const).map((key) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{t(`aiSuite.healthScore.metric.${key}`)}</span>
                  <span className="text-muted-foreground">{result[key]}</span>
                </div>
                <Progress value={result[key]} aria-label={t(`aiSuite.healthScore.metric.${key}`)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
