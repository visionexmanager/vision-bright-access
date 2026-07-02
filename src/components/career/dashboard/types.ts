import type { LucideIcon } from "lucide-react";

export type CareerSection =
  | "overview"
  | "profile"
  | "resume"
  | "portfolio"
  | "applications"
  | "savedJobs"
  | "recommendedJobs"
  | "interviews"
  | "messages"
  | "notifications"
  | "certificates"
  | "skillTests"
  | "careerRoadmap"
  | "salaryInsights"
  | "achievements"
  | "settings";

export interface SidebarNavItem {
  id: CareerSection;
  labelKey: string;
  icon: LucideIcon;
}

// ── Profile ──────────────────────────────────────────────────────────────
export type SkillProficiency = "beginner" | "intermediate" | "advanced" | "expert";

export interface SkillEntry {
  id: string;
  name: string;
  category: string;
  proficiency: SkillProficiency;
  yearsExperience: number;
  lastUsed: string;
}

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startYear: number;
  endYear: number | null;
}

export interface LanguageEntry {
  id: string;
  name: string;
  proficiency: "basic" | "conversational" | "fluent" | "native";
}

export interface ProjectEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url?: string;
}

export interface AwardEntry {
  id: string;
  title: string;
  issuer: string;
  year: number;
}

export interface VolunteeringEntry {
  id: string;
  role: string;
  organization: string;
  period: string;
}

export interface ProfileLinks {
  github: string;
  linkedin: string;
  portfolio: string;
  website: string;
}

export interface UserProfile {
  fullName: string;
  headline: string;
  bio: string;
  avatarColor: string;
  location: string;
  links: ProfileLinks;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  languages: LanguageEntry[];
  projects: ProjectEntry[];
  awards: AwardEntry[];
  volunteering: VolunteeringEntry[];
}

// ── Applications ─────────────────────────────────────────────────────────
export type ApplicationStatus = "applied" | "reviewing" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";

export interface JobApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  companyColor: string;
  status: ApplicationStatus;
  appliedDate: string;
  location: string;
}

// ── Interviews ───────────────────────────────────────────────────────────
export interface InterviewEvent {
  id: string;
  jobTitle: string;
  companyName: string;
  date: string;
  time: string;
  type: "phone" | "video" | "onsite";
  round: string;
}

// ── Messages ─────────────────────────────────────────────────────────────
export interface DashboardMessage {
  id: string;
  senderName: string;
  senderColor: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
}

// ── Notifications ────────────────────────────────────────────────────────
export type NotificationKind = "application" | "interview" | "message" | "achievement" | "system";

export interface DashboardNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  date: string;
  read: boolean;
}

// ── Certificates ─────────────────────────────────────────────────────────
export interface CertificateEntry {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  credentialId: string;
}

// ── Skill tests ──────────────────────────────────────────────────────────
export interface SkillTestEntry {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  durationMinutes: number;
}

// ── Achievements ─────────────────────────────────────────────────────────
export interface AchievementBadge {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  unlocked: boolean;
  xp: number;
}

// ── Timeline (activity log) ─────────────────────────────────────────────
export type TimelineEventKind = "skill" | "certificate" | "application" | "interview" | "offer" | "promotion";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  title: string;
  date: string;
}

// ── Career goals ─────────────────────────────────────────────────────────
export interface CareerGoal {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  progress: number;
  active: boolean;
}

// ── Portfolio ────────────────────────────────────────────────────────────
export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  color: string;
}

// ── Resume ───────────────────────────────────────────────────────────────
export interface ResumeVersion {
  id: string;
  name: string;
  updatedAt: string;
  isPrimary: boolean;
  completeness: number;
}

// ── Settings ─────────────────────────────────────────────────────────────
export interface AccessibilitySettings {
  screenReaderMode: boolean;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  brailleDisplayReady: boolean;
  voiceNavigation: boolean;
}

export interface GeneralSettings {
  timezone: string;
  currency: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  profileVisibility: "public" | "employersOnly" | "private";
}
