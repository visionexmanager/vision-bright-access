import type { SkillDemand, SkillGap } from "../types";

export const SKILL_DEMAND: SkillDemand[] = [
  { skill: "Generative AI", demandScore: 96, growthPercent: 142, topCountries: ["United States", "India", "United Kingdom"], topIndustries: ["Technology", "Finance"] },
  { skill: "Prompt Engineering", demandScore: 89, growthPercent: 118, topCountries: ["United States", "Germany", "Singapore"], topIndustries: ["Technology", "Marketing"] },
  { skill: "Cloud Architecture (AWS/GCP)", demandScore: 91, growthPercent: 44, topCountries: ["United States", "United Kingdom", "Canada"], topIndustries: ["Technology", "Finance"] },
  { skill: "Data Engineering", demandScore: 87, growthPercent: 51, topCountries: ["United States", "India", "Germany"], topIndustries: ["Technology", "Retail"] },
  { skill: "Cybersecurity", demandScore: 85, growthPercent: 38, topCountries: ["United States", "United Arab Emirates", "United Kingdom"], topIndustries: ["Finance", "Government"] },
  { skill: "React / Frontend Engineering", demandScore: 82, growthPercent: 22, topCountries: ["United States", "Brazil", "India"], topIndustries: ["Technology", "Media"] },
  { skill: "Accessibility Engineering (WCAG)", demandScore: 68, growthPercent: 34, topCountries: ["United States", "Canada", "United Kingdom"], topIndustries: ["Technology", "Government"] },
  { skill: "Renewable Energy Engineering", demandScore: 74, growthPercent: 46, topCountries: ["Germany", "United States", "Australia"], topIndustries: ["Energy", "Manufacturing"] },
];

export const SKILL_GAPS: SkillGap[] = [
  { skill: "Generative AI", demand: 96, supply: 41 },
  { skill: "Cloud Architecture", demand: 91, supply: 58 },
  { skill: "Cybersecurity", demand: 85, supply: 52 },
  { skill: "Data Engineering", demand: 87, supply: 60 },
  { skill: "Accessibility Engineering", demand: 68, supply: 24 },
];

export const RECOMMENDED_SKILLS = ["Generative AI", "Prompt Engineering", "Cloud Architecture", "Accessibility Engineering (WCAG)"];
