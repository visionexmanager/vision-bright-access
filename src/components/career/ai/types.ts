import type { LucideIcon } from "lucide-react";

export type AIModuleId =
  | "resumeBuilder"
  | "resumeAnalyzer"
  | "coverLetter"
  | "interviewSimulator"
  | "jobMatching"
  | "salaryPredictor"
  | "careerCoach"
  | "careerRoadmap"
  | "visaAssistant"
  | "healthScore";

export interface AIModuleDef {
  id: AIModuleId;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  accent: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Resume builder ───────────────────────────────────────────────────────
export interface ResumeTemplate {
  id: string;
  name: string;
  style: string;
}

// ── Resume analyzer ──────────────────────────────────────────────────────
export interface ResumeAnalysisResult {
  atsScore: number;
  jobMatchPercent: number;
  grammarIssues: string[];
  skillGaps: string[];
  suggestions: string[];
}

// ── Cover letter ─────────────────────────────────────────────────────────
export type CoverLetterTone = "formal" | "casual" | "persuasive";

// ── Interview simulator ──────────────────────────────────────────────────
export type InterviewMode = "hr" | "technical" | "behavioral";

export interface InterviewQuestion {
  id: string;
  mode: InterviewMode;
  text: string;
}

export interface InterviewFeedback {
  confidence: number;
  clarity: number;
  accuracy: number;
  communication: number;
}

// ── Job matching ─────────────────────────────────────────────────────────
export interface JobMatchResult {
  jobId: string;
  jobTitle: string;
  companyName: string;
  matchScore: number;
  whyMatch: string[];
  missingSkills: string[];
}

// ── Salary predictor ─────────────────────────────────────────────────────
export interface SalaryByCountry {
  country: string;
  amount: number;
}

export interface SalaryPredictionResult {
  currency: string;
  low: number;
  median: number;
  high: number;
  byCountry: SalaryByCountry[];
  growthNextYearPercent: number;
}

// ── Career coach ─────────────────────────────────────────────────────────
export interface CoachTask {
  id: string;
  titleKey: string;
  done: boolean;
}

export interface CoachSuggestion {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

// ── Career roadmap generator ─────────────────────────────────────────────
export interface RoadmapMilestone {
  id: string;
  title: string;
  skills: string[];
  course: string;
  monthsFromNow: number;
}

// ── Visa & relocation assistant ─────────────────────────────────────────
export interface VisaCountryMatch {
  country: string;
  matchScore: number;
  visaSponsorshipJobs: number;
  feasibility: "high" | "medium" | "low";
  requirements: string[];
}

// ── Career health score ──────────────────────────────────────────────────
export interface HealthScoreBreakdown {
  profileStrength: number;
  skillsStrength: number;
  marketDemand: number;
  interviewReadiness: number;
  salaryPotential: number;
}
