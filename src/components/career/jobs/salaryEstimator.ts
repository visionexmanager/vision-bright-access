import type { ExperienceLevel, SalaryQuery, SalaryResult } from "./types";

// Deterministic mock estimator — swap for a real salary-data API once available.
const EXPERIENCE_MULTIPLIER: Record<ExperienceLevel, number> = {
  entry: 0.7,
  mid: 1,
  senior: 1.45,
  lead: 1.9,
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function estimateSalary(query: SalaryQuery): SalaryResult {
  const seed = hashString(`${query.job}|${query.country}|${query.city}`.toLowerCase());
  const base = 42000 + (seed % 38000);
  const multiplier = EXPERIENCE_MULTIPLIER[query.experience] || 1;
  const median = Math.round((base * multiplier) / 500) * 500;

  return {
    role: query.job || "This role",
    country: query.country,
    city: query.city,
    experience: query.experience,
    p25: Math.round(median * 0.82),
    median,
    p75: Math.round(median * 1.24),
    currency: "USD",
    sampleSize: 120 + (seed % 900),
  };
}
