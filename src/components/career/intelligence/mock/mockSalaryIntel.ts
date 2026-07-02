import type { SalaryByDimension, SalaryForecast } from "../types";

export const SALARY_BY_INDUSTRY: SalaryByDimension[] = [
  { label: "Technology", amount: 98000 },
  { label: "Finance", amount: 91000 },
  { label: "Healthcare", amount: 76000 },
  { label: "Energy", amount: 84000 },
  { label: "Retail", amount: 52000 },
  { label: "Education", amount: 48000 },
];

export const SALARY_BY_EXPERIENCE: SalaryByDimension[] = [
  { label: "Entry", amount: 48000 },
  { label: "Mid", amount: 78000 },
  { label: "Senior", amount: 115000 },
  { label: "Lead", amount: 148000 },
];

export const SALARY_BY_SKILL: SalaryByDimension[] = [
  { label: "Generative AI", amount: 142000 },
  { label: "Cloud Architecture", amount: 128000 },
  { label: "Cybersecurity", amount: 118000 },
  { label: "Data Engineering", amount: 112000 },
  { label: "React", amount: 98000 },
];

export const SALARY_INFLATION_TREND: SalaryForecast[] = [
  { year: 2022, amount: 82000 },
  { year: 2023, amount: 86500 },
  { year: 2024, amount: 90200 },
  { year: 2025, amount: 94800 },
  { year: 2026, amount: 98000 },
];

export const SALARY_FUTURE_PREDICTION: SalaryForecast[] = [
  { year: 2026, amount: 98000 },
  { year: 2027, amount: 103000 },
  { year: 2028, amount: 108500 },
  { year: 2029, amount: 114000 },
  { year: 2030, amount: 120500 },
];
