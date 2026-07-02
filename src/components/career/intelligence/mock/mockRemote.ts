import type { RemoteCountryStat, RemoteEmployer } from "../types";

export const REMOTE_COUNTRY_STATS: RemoteCountryStat[] = [
  { country: "Portugal", remoteScore: 91, avgRemoteSalaryUsd: 58000, growthPercent: 34, timezoneGroup: "UTC+0/+1" },
  { country: "United States", remoteScore: 88, avgRemoteSalaryUsd: 102000, growthPercent: 18, timezoneGroup: "UTC-5 to -8" },
  { country: "Canada", remoteScore: 85, avgRemoteSalaryUsd: 76000, growthPercent: 22, timezoneGroup: "UTC-4 to -8" },
  { country: "Spain", remoteScore: 83, avgRemoteSalaryUsd: 54000, growthPercent: 29, timezoneGroup: "UTC+1" },
  { country: "Poland", remoteScore: 80, avgRemoteSalaryUsd: 46000, growthPercent: 31, timezoneGroup: "UTC+1" },
  { country: "Mexico", remoteScore: 76, avgRemoteSalaryUsd: 38000, growthPercent: 27, timezoneGroup: "UTC-6" },
];

export const REMOTE_FRIENDLY_INDUSTRIES = ["Technology", "Marketing", "Customer Support", "Finance", "Design", "Education"];

export const REMOTE_EMPLOYERS: RemoteEmployer[] = [
  { name: "Nova Systems", color: "#6366f1", remoteJobs: 48, industry: "Technology" },
  { name: "Vertex AI Labs", color: "#a855f7", remoteJobs: 39, industry: "Artificial Intelligence" },
  { name: "Clearview Design Studio", color: "#ec4899", remoteJobs: 21, industry: "Design" },
  { name: "Atlas Finance Group", color: "#0ea5e9", remoteJobs: 17, industry: "Finance" },
];
