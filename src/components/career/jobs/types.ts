import type { LucideIcon } from "lucide-react";

export type WorkMode = "remote" | "hybrid" | "onsite";
export type JobType =
  | "full-time"
  | "part-time"
  | "contract"
  | "temporary"
  | "internship"
  | "freelance";
export type ExperienceLevel = "entry" | "mid" | "senior" | "lead";

export interface Job {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  companyLogoColor: string;
  location: string;
  country: string;
  city: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  type: JobType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  education: string;
  categoryId: string;
  skills: string[];
  postedAt: string;
  isUrgent: boolean;
  isAccessible: boolean;
  isVisaSponsorship: boolean;
  isAiJob: boolean;
  description: string;
}

export interface Company {
  id: string;
  name: string;
  logoColor: string;
  industry: string;
  openJobs: number;
  rating: number;
  location: string;
}

export interface Category {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  jobCount: number;
}

export interface CountryStat {
  id: string;
  name: string;
  jobCount: number;
  cities: CityStat[];
}

export interface CityStat {
  id: string;
  name: string;
  jobCount: number;
}

export interface CareerInsight {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  items: string[];
}

export interface AccessibilityFeature {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

export interface CareerTool {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

export interface SalaryQuery {
  country: string;
  city: string;
  job: string;
  experience: ExperienceLevel;
}

export interface SalaryResult {
  role: string;
  country: string;
  city: string;
  experience: ExperienceLevel;
  p25: number;
  median: number;
  p75: number;
  currency: string;
  sampleSize: number;
}

export interface ParsedAiQuery {
  keywords: string[];
  location?: string;
  country?: string;
  workMode?: WorkMode;
  minSalary?: number;
  isAccessible?: boolean;
  isVisaSponsorship?: boolean;
  jobType?: JobType;
  summary: string;
}

export interface JobFilters {
  title: string;
  category: string;
  company: string;
  skills: string;
  location: string;
  country: string;
  minSalary: string;
  jobTypes: JobType[];
  experience: ExperienceLevel | "";
  education: string;
  workModes: WorkMode[];
  visaSponsorship: boolean;
  accessibleJobs: boolean;
  urgentHiring: boolean;
  entryLevel: boolean;
  aiJobs: boolean;
}

export type UpdateFilterFn = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;

export const EMPTY_JOB_FILTERS: JobFilters = {
  title: "",
  category: "",
  company: "",
  skills: "",
  location: "",
  country: "",
  minSalary: "",
  jobTypes: [],
  experience: "",
  education: "",
  workModes: [],
  visaSponsorship: false,
  accessibleJobs: false,
  urgentHiring: false,
  entryLevel: false,
  aiJobs: false,
};
