import { FileText, FileSearch, Mail, LayoutGrid, MessageSquare, Compass, Calculator, Milestone, Award, ClipboardCheck } from "lucide-react";
import type { CareerTool } from "./types";

export const CAREER_TOOLS: CareerTool[] = [
  { id: "resumeBuilder", icon: FileText, titleKey: "careersPage.tool.resumeBuilder.title", descKey: "careersPage.tool.resumeBuilder.desc" },
  { id: "resumeAnalyzer", icon: FileSearch, titleKey: "careersPage.tool.resumeAnalyzer.title", descKey: "careersPage.tool.resumeAnalyzer.desc" },
  { id: "coverLetter", icon: Mail, titleKey: "careersPage.tool.coverLetter.title", descKey: "careersPage.tool.coverLetter.desc" },
  { id: "portfolioBuilder", icon: LayoutGrid, titleKey: "careersPage.tool.portfolioBuilder.title", descKey: "careersPage.tool.portfolioBuilder.desc" },
  { id: "aiInterview", icon: MessageSquare, titleKey: "careersPage.tool.aiInterview.title", descKey: "careersPage.tool.aiInterview.desc" },
  { id: "careerCoach", icon: Compass, titleKey: "careersPage.tool.careerCoach.title", descKey: "careersPage.tool.careerCoach.desc" },
  { id: "salaryCalculator", icon: Calculator, titleKey: "careersPage.tool.salaryCalculator.title", descKey: "careersPage.tool.salaryCalculator.desc" },
  { id: "careerTimeline", icon: Milestone, titleKey: "careersPage.tool.careerTimeline.title", descKey: "careersPage.tool.careerTimeline.desc" },
  { id: "certificates", icon: Award, titleKey: "careersPage.tool.certificates.title", descKey: "careersPage.tool.certificates.desc" },
  { id: "skillTests", icon: ClipboardCheck, titleKey: "careersPage.tool.skillTests.title", descKey: "careersPage.tool.skillTests.desc" },
];
