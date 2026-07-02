import {
  Search,
  Globe,
  FileText,
  Eye,
  Mail,
  MessageSquare,
  Route,
  DollarSign,
  Building2,
  Zap,
  Accessibility,
  Plane,
  Briefcase,
  Users,
  UserCheck,
} from "lucide-react";
import type { CareerServiceCardData, CareerStatData } from "./types";

export const CAREER_SERVICE_CARDS: CareerServiceCardData[] = [
  { id: "findJobs", icon: Search, titleKey: "careerCenter.card.findJobs.title", descKey: "careerCenter.card.findJobs.desc" },
  { id: "remoteJobs", icon: Globe, titleKey: "careerCenter.card.remoteJobs.title", descKey: "careerCenter.card.remoteJobs.desc" },
  { id: "resumeBuilder", icon: FileText, titleKey: "careerCenter.card.resumeBuilder.title", descKey: "careerCenter.card.resumeBuilder.desc" },
  { id: "aiResumeReview", icon: Eye, titleKey: "careerCenter.card.aiResumeReview.title", descKey: "careerCenter.card.aiResumeReview.desc" },
  { id: "coverLetterGenerator", icon: Mail, titleKey: "careerCenter.card.coverLetterGenerator.title", descKey: "careerCenter.card.coverLetterGenerator.desc" },
  { id: "aiInterview", icon: MessageSquare, titleKey: "careerCenter.card.aiInterview.title", descKey: "careerCenter.card.aiInterview.desc" },
  { id: "careerRoadmap", icon: Route, titleKey: "careerCenter.card.careerRoadmap.title", descKey: "careerCenter.card.careerRoadmap.desc" },
  { id: "salaryInsights", icon: DollarSign, titleKey: "careerCenter.card.salaryInsights.title", descKey: "careerCenter.card.salaryInsights.desc" },
  { id: "companies", icon: Building2, titleKey: "careerCenter.card.companies.title", descKey: "careerCenter.card.companies.desc" },
  { id: "freelance", icon: Zap, titleKey: "careerCenter.card.freelance.title", descKey: "careerCenter.card.freelance.desc" },
  { id: "accessibilityJobs", icon: Accessibility, titleKey: "careerCenter.card.accessibilityJobs.title", descKey: "careerCenter.card.accessibilityJobs.desc" },
  { id: "visaSponsorshipJobs", icon: Plane, titleKey: "careerCenter.card.visaSponsorshipJobs.title", descKey: "careerCenter.card.visaSponsorshipJobs.desc" },
];

// Placeholder values only — wire up to real metrics once the Career Center backend ships.
export const CAREER_STATS: CareerStatData[] = [
  { id: "jobs", icon: Briefcase, value: "—", labelKey: "careerCenter.stats.jobs" },
  { id: "companies", icon: Building2, value: "—", labelKey: "careerCenter.stats.companies" },
  { id: "countries", icon: Globe, value: "—", labelKey: "careerCenter.stats.countries" },
  { id: "candidates", icon: Users, value: "—", labelKey: "careerCenter.stats.candidates" },
  { id: "employers", icon: UserCheck, value: "—", labelKey: "careerCenter.stats.employers" },
];
