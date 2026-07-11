import type { AIRecommendation, ChartPoint } from "../types";

export const TIME_TO_HIRE: ChartPoint[] = [
  { label: "Feb", value: 32 },
  { label: "Mar", value: 29 },
  { label: "Apr", value: 27 },
  { label: "May", value: 24 },
  { label: "Jun", value: 21 },
  { label: "Jul", value: 19 },
];

export const BEST_SOURCES: ChartPoint[] = [
  { label: "VisionEx Careers", value: 42 },
  { label: "AI Talent Search", value: 23 },
  { label: "Referral", value: 15 },
  { label: "LinkedIn", value: 12 },
  { label: "Other", value: 8 },
];

export const CANDIDATE_QUALITY_TREND: ChartPoint[] = [
  { label: "Feb", value: 68 },
  { label: "Mar", value: 71 },
  { label: "Apr", value: 74 },
  { label: "May", value: 76 },
  { label: "Jun", value: 80 },
  { label: "Jul", value: 83 },
];

export const SALARY_TRENDS: ChartPoint[] = [
  { label: "Frontend", value: 118000 },
  { label: "Backend", value: 105000 },
  { label: "AI/ML", value: 128000 },
  { label: "Design", value: 92000 },
  { label: "Support", value: 44000 },
];

export const JOB_PERFORMANCE: ChartPoint[] = [
  { label: "Sr Frontend Eng.", value: 34 },
  { label: "AI Prompt Eng.", value: 19 },
  { label: "Backend Dev.", value: 41 },
  { label: "Product Designer", value: 12 },
  { label: "Support Specialist", value: 58 },
];

export const AI_RECOMMENDATIONS: AIRecommendation[] = [
  { id: "rec-1", text: "Your Senior Frontend Engineer posting is attracting strong candidates — consider raising the salary band slightly to close offers faster." },
  { id: "rec-2", text: "AI Talent Search is outperforming LinkedIn as a source this month — allocate more sourcing time there." },
  { id: "rec-3", text: "3 candidates in Screening have been idle for 5+ days — review them to avoid losing strong applicants." },
  { id: "rec-4", text: "Candidate quality is trending up 15% over the last quarter, largely from accessibility-tagged postings." },
];
