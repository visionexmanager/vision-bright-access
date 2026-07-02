export interface GlobalMetric {
  id: string;
  labelKey: string;
  value: number;
  suffix?: string;
  trend: number;
}

export interface CountryJobData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hiringIntensity: number;
  openJobs: number;
  remoteRatio: number;
  visaFriendly: boolean;
  topSkills: string[];
  avgSalaryUsd: number;
}

export interface ChartSeries {
  label: string;
  value: number;
}

export interface DecliningCareer {
  role: string;
  declinePercent: number;
  reason: string;
}

export interface EmergingJob {
  role: string;
  growthPercent: number;
  automationRisk: number;
}

export interface SalaryByDimension {
  label: string;
  amount: number;
}

export interface SalaryForecast {
  year: number;
  amount: number;
}

export type FakeJobFlag = "fakeJob" | "scamListing" | "misleadingSalary" | "suspiciousCompany" | "duplicateListing";

export interface FakeJobAnalysis {
  riskScore: number;
  confidence: number;
  flags: FakeJobFlag[];
  explanation: string;
}

export interface SkillDemand {
  skill: string;
  demandScore: number;
  growthPercent: number;
  topCountries: string[];
  topIndustries: string[];
}

export interface SkillGap {
  skill: string;
  demand: number;
  supply: number;
}

export interface RemoteCountryStat {
  country: string;
  remoteScore: number;
  avgRemoteSalaryUsd: number;
  growthPercent: number;
  timezoneGroup: string;
}

export interface RemoteEmployer {
  name: string;
  color: string;
  remoteJobs: number;
  industry: string;
}

export interface VisaCountryIntel {
  country: string;
  visaEaseScore: number;
  sponsorshipIndex: number;
  relocationDifficulty: number;
  migrationFriendlyJobs: string[];
  immigrationPaths: string[];
}

export interface CompanyIntel {
  id: string;
  name: string;
  color: string;
  industry: string;
  growthScore: number;
  hiringVelocity: number;
  retentionScore: number;
  salaryCompetitiveness: number;
  cultureScore: number;
  riskScore: number;
}

export interface ForecastRole {
  role: string;
  growthWindow: string;
  projectedGrowthPercent: number;
  aiReplacementRisk: number;
  stabilityIndex: number;
  projectedSalaryUsd: number;
}

export interface RegionalInsight {
  region: string;
  topJobs: string[];
  avgSalaryUsd: number;
  topSkills: string[];
  hiringTrend: "up" | "flat" | "down";
  remoteAvailability: number;
  competitionLevel: "low" | "medium" | "high";
}
