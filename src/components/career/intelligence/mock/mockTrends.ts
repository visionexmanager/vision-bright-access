import type { ChartSeries, DecliningCareer, EmergingJob } from "../types";

export const IN_DEMAND_JOBS: ChartSeries[] = [
  { label: "AI Engineer", value: 94 },
  { label: "Data Analyst", value: 82 },
  { label: "Cloud Engineer", value: 79 },
  { label: "Product Manager", value: 71 },
  { label: "UX Designer", value: 65 },
  { label: "Cybersecurity Analyst", value: 63 },
];

export const DECLINING_CAREERS: DecliningCareer[] = [
  { role: "Data Entry Clerk", declinePercent: 38, reason: "Automated by AI-driven document processing." },
  { role: "Telemarketer", declinePercent: 31, reason: "Displaced by conversational AI and self-serve channels." },
  { role: "Print Journalist", declinePercent: 24, reason: "Continued shift to digital-first media." },
  { role: "Bank Teller", declinePercent: 19, reason: "Growth of digital banking and self-service kiosks." },
];

export const EMERGING_AI_JOBS: EmergingJob[] = [
  { role: "AI Prompt Engineer", growthPercent: 142, automationRisk: 8 },
  { role: "AI Ethics Officer", growthPercent: 88, automationRisk: 4 },
  { role: "MLOps Engineer", growthPercent: 76, automationRisk: 6 },
  { role: "AI Product Manager", growthPercent: 65, automationRisk: 3 },
];

export const AUTOMATION_RISK_JOBS: EmergingJob[] = [
  { role: "Data Entry Clerk", growthPercent: -38, automationRisk: 91 },
  { role: "Assembly Line Worker", growthPercent: -22, automationRisk: 84 },
  { role: "Bookkeeper", growthPercent: -14, automationRisk: 76 },
  { role: "Customer Support (Tier 1)", growthPercent: -9, automationRisk: 68 },
];
