import type { GlobalMetric } from "../types";

export const GLOBAL_METRICS: GlobalMetric[] = [
  { id: "jobsIndex", labelKey: "intel.overview.jobsIndex", value: 128400000, trend: 4.2 },
  { id: "demandGrowth", labelKey: "intel.overview.demandGrowth", value: 6, suffix: "%", trend: 1.1 },
  { id: "remoteRatio", labelKey: "intel.overview.remoteRatio", value: 27, suffix: "%", trend: 2.4 },
  { id: "topHiringCountries", labelKey: "intel.overview.topHiringCountries", value: 42, trend: 3.0 },
  { id: "fastestSkills", labelKey: "intel.overview.fastestSkills", value: 18, trend: 12.5 },
  { id: "salaryInflation", labelKey: "intel.overview.salaryInflation", value: 5, suffix: "%", trend: -0.8 },
  { id: "aiImpact", labelKey: "intel.overview.aiImpact", value: 63, suffix: "/100", trend: 5.6 },
  { id: "marketHealth", labelKey: "intel.overview.marketHealth", value: 74, suffix: "/100", trend: 1.9 },
];
