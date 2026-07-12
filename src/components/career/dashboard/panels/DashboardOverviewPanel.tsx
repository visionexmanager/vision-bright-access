import { FileStack, CalendarClock, Trophy, MessageCircle, Bookmark } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { useCareerApplications } from "@/hooks/career/useCareerApplications";
import { useCareerMessages } from "@/hooks/career/useCareerMessages";
// Interviews and saved-jobs have no backing table yet (see InterviewsPanel.tsx
// and SavedJobsPanel.tsx) — their stat tiles stay on mock data until a future
// phase adds those tables.
import { MOCK_INTERVIEWS } from "../mock/mockInterviews";
import { MOCK_SAVED_JOB_IDS } from "../mock/mockSavedJobs";
import { StatWidget } from "./widgets/StatWidget";
import { CareerScoreWidget } from "./widgets/CareerScoreWidget";
import { ProfileCompletionWidget } from "./widgets/ProfileCompletionWidget";
import { RecentActivityWidget } from "./widgets/RecentActivityWidget";
import { UpcomingInterviewsWidget } from "./widgets/UpcomingInterviewsWidget";
import { RecommendedSkillsWidget } from "./widgets/RecommendedSkillsWidget";
import { CareerProgressWidget } from "./widgets/CareerProgressWidget";
import { SalaryPredictionWidget } from "./widgets/SalaryPredictionWidget";

export function DashboardOverviewPanel() {
  const { t } = useLanguage();
  const { setActiveSection } = useCareerDashboard();
  const { applications } = useCareerApplications();
  const { messages } = useCareerMessages();
  const offersCount = applications.filter((a) => a.status === "offer").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.overview.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.overview.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatWidget icon={FileStack} label={t("careerDash.nav.applications")} value={applications.length} onClick={() => setActiveSection("applications")} />
        <StatWidget icon={CalendarClock} label={t("careerDash.nav.interviews")} value={MOCK_INTERVIEWS.length} onClick={() => setActiveSection("interviews")} />
        <StatWidget icon={Trophy} label={t("careerDash.widget.offers")} value={offersCount} onClick={() => setActiveSection("applications")} />
        <StatWidget icon={MessageCircle} label={t("careerDash.nav.messages")} value={messages.length} onClick={() => setActiveSection("messages")} />
        <StatWidget icon={Bookmark} label={t("careerDash.nav.savedJobs")} value={MOCK_SAVED_JOB_IDS.length} onClick={() => setActiveSection("savedJobs")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CareerScoreWidget />
        <ProfileCompletionWidget />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityWidget />
        <div className="flex flex-col gap-4">
          <UpcomingInterviewsWidget />
          <RecommendedSkillsWidget />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CareerProgressWidget />
        <SalaryPredictionWidget />
      </div>
    </div>
  );
}
