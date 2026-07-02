import { Bookmark, Send, Sparkles, CalendarClock, MessageCircle, Bell } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface UserDashboardStat {
  id: string;
  icon: LucideIcon;
  labelKey: string;
  value: number;
}

export const USER_DASHBOARD_STATS: UserDashboardStat[] = [
  { id: "savedJobs", icon: Bookmark, labelKey: "careersPage.dashboard.user.savedJobs", value: 12 },
  { id: "appliedJobs", icon: Send, labelKey: "careersPage.dashboard.user.appliedJobs", value: 7 },
  { id: "recommended", icon: Sparkles, labelKey: "careersPage.dashboard.user.recommended", value: 24 },
  { id: "interviews", icon: CalendarClock, labelKey: "careersPage.dashboard.user.interviews", value: 2 },
  { id: "messages", icon: MessageCircle, labelKey: "careersPage.dashboard.user.messages", value: 5 },
  { id: "notifications", icon: Bell, labelKey: "careersPage.dashboard.user.notifications", value: 9 },
];

export const MOCK_PROFILE_COMPLETION = 68;
export const MOCK_CAREER_SCORE = 742;
export const MOCK_CAREER_SCORE_MAX = 1000;
