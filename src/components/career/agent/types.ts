import type { LucideIcon } from "lucide-react";

export type AgentSection =
  | "home"
  | "briefing"
  | "goals"
  | "opportunities"
  | "recommendations"
  | "application"
  | "interview"
  | "negotiation"
  | "journal"
  | "productivity"
  | "insights"
  | "notifications"
  | "settings";

export interface SidebarNavItem {
  id: AgentSection;
  labelKey: string;
  icon: LucideIcon;
}

export type AgentPersonality = "professional" | "friendly" | "minimal" | "motivational" | "executive";

export interface AgentIdentity {
  name: string;
  avatarEmoji: string;
  avatarColor: string;
  personality: AgentPersonality;
}

// ── Career goals ─────────────────────────────────────────────────────────
export type GoalPriority = "low" | "medium" | "high";

export interface CareerGoalItem {
  id: string;
  titleKey: string;
  customTitle?: string;
  priority: GoalPriority;
  deadline: string;
  progress: number;
  estimatedCompletion: string;
}

// ── Opportunity monitor ─────────────────────────────────────────────────
export type OpportunityKind = "newJob" | "salaryChange" | "hiringCompany" | "visaOpportunity" | "remoteOpportunity" | "emergingSkill";

export interface OpportunityEvent {
  id: string;
  kind: OpportunityKind;
  title: string;
  detail: string;
  date: string;
}

// ── Recommendations ──────────────────────────────────────────────────────
export type RecommendationKind = "job" | "company" | "course" | "certification" | "skill";

export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  title: string;
  subtitle: string;
  reason: string;
  matchScore: number;
}

// ── Interview assistant ──────────────────────────────────────────────────
export interface InterviewPrepQuestion {
  id: string;
  category: "common" | "technical" | "behavioral";
  question: string;
}

// ── Negotiation assistant ────────────────────────────────────────────────
export interface OfferComparisonItem {
  id: string;
  label: string;
  offerA: string;
  offerB: string;
}

// ── Career journal ────────────────────────────────────────────────────────
export type JournalEntryKind = "application" | "interview" | "achievement" | "skill" | "certificate" | "milestone";

export interface JournalEntry {
  id: string;
  kind: JournalEntryKind;
  title: string;
  date: string;
}

// ── Productivity ─────────────────────────────────────────────────────────
export interface ProductivityTask {
  id: string;
  titleKey: string;
  done: boolean;
}

// ── AI Insights ───────────────────────────────────────────────────────────
export interface InsightCard {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  value: number;
  descKey: string;
  tone: "positive" | "neutral" | "warning";
}

// ── Notifications ─────────────────────────────────────────────────────────
export type NotificationCategory = "jobs" | "interviews" | "learning" | "salary" | "companies" | "visa" | "accessibility";

export interface AgentNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  date: string;
  read: boolean;
}

// ── AI Memory ─────────────────────────────────────────────────────────────
export interface AgentMemory {
  knownSkills: string[];
  careerInterests: string[];
  preferredCountries: string[];
  preferredIndustries: string[];
  preferredSalaryMin: number;
  preferredJobTypes: string[];
}

export interface AgentAccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
}
