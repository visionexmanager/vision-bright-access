import { lazy, Suspense, type LazyExoticComponent } from "react";
import { CareerDashboardLayout } from "@/components/career/dashboard/CareerDashboardLayout";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import type { CareerSection } from "@/components/career/dashboard/types";

const DashboardOverviewPanel = lazy(() => import("@/components/career/dashboard/panels/DashboardOverviewPanel").then((m) => ({ default: m.DashboardOverviewPanel })));
const ProfilePanel = lazy(() => import("@/components/career/dashboard/panels/ProfilePanel").then((m) => ({ default: m.ProfilePanel })));
const ResumePanel = lazy(() => import("@/components/career/dashboard/panels/ResumePanel").then((m) => ({ default: m.ResumePanel })));
const PortfolioPanel = lazy(() => import("@/components/career/dashboard/panels/PortfolioPanel").then((m) => ({ default: m.PortfolioPanel })));
const ApplicationsPanel = lazy(() => import("@/components/career/dashboard/panels/ApplicationsPanel").then((m) => ({ default: m.ApplicationsPanel })));
const SavedJobsPanel = lazy(() => import("@/components/career/dashboard/panels/SavedJobsPanel").then((m) => ({ default: m.SavedJobsPanel })));
const RecommendedJobsPanel = lazy(() => import("@/components/career/dashboard/panels/RecommendedJobsPanel").then((m) => ({ default: m.RecommendedJobsPanel })));
const InterviewsPanel = lazy(() => import("@/components/career/dashboard/panels/InterviewsPanel").then((m) => ({ default: m.InterviewsPanel })));
const MessagesPanel = lazy(() => import("@/components/career/dashboard/panels/MessagesPanel").then((m) => ({ default: m.MessagesPanel })));
const NotificationsPanel = lazy(() => import("@/components/career/dashboard/panels/NotificationsPanel").then((m) => ({ default: m.NotificationsPanel })));
const CertificatesPanel = lazy(() => import("@/components/career/dashboard/panels/CertificatesPanel").then((m) => ({ default: m.CertificatesPanel })));
const SkillTestsPanel = lazy(() => import("@/components/career/dashboard/panels/SkillTestsPanel").then((m) => ({ default: m.SkillTestsPanel })));
const CareerRoadmapPanel = lazy(() => import("@/components/career/dashboard/panels/CareerRoadmapPanel").then((m) => ({ default: m.CareerRoadmapPanel })));
const SalaryInsightsPanel = lazy(() => import("@/components/career/dashboard/panels/SalaryInsightsPanel").then((m) => ({ default: m.SalaryInsightsPanel })));
const AchievementsPanel = lazy(() => import("@/components/career/dashboard/panels/AchievementsPanel").then((m) => ({ default: m.AchievementsPanel })));
const SettingsPanel = lazy(() => import("@/components/career/dashboard/panels/SettingsPanel").then((m) => ({ default: m.SettingsPanel })));

const PANEL_COMPONENTS: Record<CareerSection, LazyExoticComponent<() => JSX.Element>> = {
  overview: DashboardOverviewPanel,
  profile: ProfilePanel,
  resume: ResumePanel,
  portfolio: PortfolioPanel,
  applications: ApplicationsPanel,
  savedJobs: SavedJobsPanel,
  recommendedJobs: RecommendedJobsPanel,
  interviews: InterviewsPanel,
  messages: MessagesPanel,
  notifications: NotificationsPanel,
  certificates: CertificatesPanel,
  skillTests: SkillTestsPanel,
  careerRoadmap: CareerRoadmapPanel,
  salaryInsights: SalaryInsightsPanel,
  achievements: AchievementsPanel,
  settings: SettingsPanel,
};

function ActivePanel() {
  const { activeSection } = useCareerDashboard();
  const Panel = PANEL_COMPONENTS[activeSection];

  return (
    <Suspense fallback={<SkeletonCard count={3} />}>
      <Panel />
    </Suspense>
  );
}

export default function CareerDashboard() {
  return (
    <CareerDashboardLayout>
      <ActivePanel />
    </CareerDashboardLayout>
  );
}
