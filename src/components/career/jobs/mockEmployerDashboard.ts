import { PlusCircle, ListChecks, Users, FileStack, CalendarClock, BarChart3, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EmployerDashboardAction {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  value?: number;
}

export const EMPLOYER_DASHBOARD_ACTIONS: EmployerDashboardAction[] = [
  { id: "postJob", icon: PlusCircle, titleKey: "careersPage.dashboard.employer.postJob.title", descKey: "careersPage.dashboard.employer.postJob.desc" },
  { id: "manageJobs", icon: ListChecks, titleKey: "careersPage.dashboard.employer.manageJobs.title", descKey: "careersPage.dashboard.employer.manageJobs.desc", value: 18 },
  { id: "candidates", icon: Users, titleKey: "careersPage.dashboard.employer.candidates.title", descKey: "careersPage.dashboard.employer.candidates.desc", value: 312 },
  { id: "applications", icon: FileStack, titleKey: "careersPage.dashboard.employer.applications.title", descKey: "careersPage.dashboard.employer.applications.desc", value: 148 },
  { id: "interviews", icon: CalendarClock, titleKey: "careersPage.dashboard.employer.interviews.title", descKey: "careersPage.dashboard.employer.interviews.desc", value: 9 },
  { id: "analytics", icon: BarChart3, titleKey: "careersPage.dashboard.employer.analytics.title", descKey: "careersPage.dashboard.employer.analytics.desc" },
  { id: "aiMatching", icon: Sparkles, titleKey: "careersPage.dashboard.employer.aiMatching.title", descKey: "careersPage.dashboard.employer.aiMatching.desc" },
];
