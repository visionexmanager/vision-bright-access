import { lazy, Suspense, type LazyExoticComponent } from "react";
import { EmployerDashboardLayout } from "@/components/career/employer/EmployerDashboardLayout";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import type { EmployerSection } from "@/components/career/employer/types";

const OverviewPanel = lazy(() => import("@/components/career/employer/panels/OverviewPanel").then((m) => ({ default: m.OverviewPanel })));
const JobBuilder = lazy(() => import("@/components/career/employer/panels/JobBuilder").then((m) => ({ default: m.JobBuilder })));
const ManageJobsPanel = lazy(() => import("@/components/career/employer/panels/ManageJobsPanel").then((m) => ({ default: m.ManageJobsPanel })));
const CandidatesPanel = lazy(() => import("@/components/career/employer/panels/CandidatesPanel").then((m) => ({ default: m.CandidatesPanel })));
const AIScreeningEngine = lazy(() => import("@/components/career/employer/panels/AIScreeningEngine").then((m) => ({ default: m.AIScreeningEngine })));
const InterviewsPanel = lazy(() => import("@/components/career/employer/panels/InterviewsPanel").then((m) => ({ default: m.InterviewsPanel })));
const AnalyticsPanel = lazy(() => import("@/components/career/employer/panels/AnalyticsPanel").then((m) => ({ default: m.AnalyticsPanel })));
const TeamPanel = lazy(() => import("@/components/career/employer/panels/TeamPanel").then((m) => ({ default: m.TeamPanel })));
const MessagingSystem = lazy(() => import("@/components/career/employer/panels/MessagingSystem").then((m) => ({ default: m.MessagingSystem })));
const SettingsPanel = lazy(() => import("@/components/career/employer/panels/SettingsPanel").then((m) => ({ default: m.SettingsPanel })));

const PANEL_COMPONENTS: Record<EmployerSection, LazyExoticComponent<() => JSX.Element>> = {
  overview: OverviewPanel,
  postJob: JobBuilder,
  manageJobs: ManageJobsPanel,
  candidates: CandidatesPanel,
  aiScreening: AIScreeningEngine,
  interviews: InterviewsPanel,
  analytics: AnalyticsPanel,
  team: TeamPanel,
  messages: MessagingSystem,
  settings: SettingsPanel,
};

function ActivePanel() {
  const { activeSection } = useEmployerDashboard();
  const Panel = PANEL_COMPONENTS[activeSection];

  return (
    <Suspense fallback={<SkeletonCard count={3} />}>
      <Panel />
    </Suspense>
  );
}

export default function EmployerDashboard() {
  return (
    <EmployerDashboardLayout>
      <ActivePanel />
    </EmployerDashboardLayout>
  );
}
