import type { RegionalInsight } from "../types";

export const REGIONAL_INSIGHTS: RegionalInsight[] = [
  { region: "North America", topJobs: ["Software Engineer", "Product Manager", "Data Scientist"], avgSalaryUsd: 98000, topSkills: ["React", "Cloud", "AI/ML"], hiringTrend: "up", remoteAvailability: 34, competitionLevel: "high" },
  { region: "Western Europe", topJobs: ["Software Engineer", "Mechanical Engineer", "Nurse"], avgSalaryUsd: 72000, topSkills: ["Java", "SAP", "Cloud"], hiringTrend: "up", remoteAvailability: 30, competitionLevel: "medium" },
  { region: "Middle East", topJobs: ["Finance Manager", "Logistics Coordinator", "IT Specialist"], avgSalaryUsd: 64000, topSkills: ["Finance", "Logistics", "Arabic/English Bilingual"], hiringTrend: "up", remoteAvailability: 18, competitionLevel: "medium" },
  { region: "South Asia", topJobs: ["Software Developer", "AI Engineer", "Data Analyst"], avgSalaryUsd: 22000, topSkills: ["Python", "Node.js", "AI/ML"], hiringTrend: "up", remoteAvailability: 22, competitionLevel: "high" },
  { region: "Latin America", topJobs: ["Software Developer", "Sales Manager", "Customer Support"], avgSalaryUsd: 26000, topSkills: ["Java", "Sales", "Bilingual Support"], hiringTrend: "flat", remoteAvailability: 26, competitionLevel: "medium" },
  { region: "Sub-Saharan Africa", topJobs: ["Finance Officer", "Customer Support", "Mining Engineer"], avgSalaryUsd: 18000, topSkills: ["Finance", "Customer Support", "Mining"], hiringTrend: "flat", remoteAvailability: 20, competitionLevel: "low" },
];
