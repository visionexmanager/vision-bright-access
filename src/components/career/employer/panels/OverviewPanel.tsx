import { Briefcase, Users, CalendarClock, UserCheck, UserX, Sparkles, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { StatWidget } from "@/components/career/dashboard/panels/widgets/StatWidget";
import { MOCK_EMPLOYER_JOBS } from "../mock/mockJobs";
import { MOCK_CANDIDATES } from "../mock/mockCandidates";
import { AI_RECOMMENDATIONS } from "../mock/mockAnalytics";

const MOCK_HIRED_TODAY = 2;

export function OverviewPanel() {
  const { t } = useLanguage();
  const { setActiveSection } = useEmployerDashboard();

  const activeJobs = MOCK_EMPLOYER_JOBS.filter((j) => j.status === "active").length;
  const totalCandidates = MOCK_CANDIDATES.length;
  const inInterview = MOCK_CANDIDATES.filter((c) => c.stage === "interview").length;
  const rejected = MOCK_CANDIDATES.filter((c) => c.stage === "rejected").length;
  const hired = MOCK_CANDIDATES.filter((c) => c.stage === "hired").length;
  const aiSuggested = MOCK_CANDIDATES.filter((c) => c.matchScore >= 85 && c.stage !== "hired" && c.stage !== "rejected").length;
  const conversionRate = totalCandidates ? Math.round((hired / totalCandidates) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.overview.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.overview.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatWidget icon={Briefcase} label={t("employerDash.overview.activeJobs")} value={activeJobs} onClick={() => setActiveSection("manageJobs")} />
        <StatWidget icon={Users} label={t("employerDash.overview.totalCandidates")} value={totalCandidates} onClick={() => setActiveSection("candidates")} />
        <StatWidget icon={CalendarClock} label={t("employerDash.overview.interviewPipeline")} value={inInterview} onClick={() => setActiveSection("interviews")} />
        <StatWidget icon={UserCheck} label={t("employerDash.overview.hiredToday")} value={MOCK_HIRED_TODAY} />
        <StatWidget icon={UserX} label={t("employerDash.overview.rejected")} value={rejected} onClick={() => setActiveSection("candidates")} />
        <StatWidget icon={Sparkles} label={t("employerDash.overview.aiSuggested")} value={aiSuggested} onClick={() => setActiveSection("aiScreening")} />
        <StatWidget icon={TrendingUp} label={t("employerDash.overview.conversionRate")} value={conversionRate} />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">{t("employerDash.overview.aiRecommendations")}</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {AI_RECOMMENDATIONS.map((rec) => <li key={rec.id}>• {rec.text}</li>)}
        </ul>
      </div>
    </div>
  );
}
