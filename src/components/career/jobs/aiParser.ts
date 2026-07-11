import type { JobType, ParsedAiQuery, WorkMode } from "./types";

// Local keyword-based mock parser — no external API call.
// Designed so the return shape (ParsedAiQuery) can be swapped for a real LLM response later
// without touching any of the calling UI code.

const COUNTRY_ALIASES: Record<string, string> = {
  canada: "Canada", "كندا": "Canada",
  germany: "Germany", "ألمانيا": "Germany", "المانيا": "Germany",
  "united kingdom": "United Kingdom", uk: "United Kingdom", britain: "United Kingdom", "بريطانيا": "United Kingdom", "المملكة المتحدة": "United Kingdom",
  "united arab emirates": "United Arab Emirates", uae: "United Arab Emirates", dubai: "United Arab Emirates", "الإمارات": "United Arab Emirates", "الامارات": "United Arab Emirates",
  "saudi arabia": "Saudi Arabia", ksa: "Saudi Arabia", "السعودية": "Saudi Arabia",
  australia: "Australia", "أستراليا": "Australia", "استراليا": "Australia",
  japan: "Japan", "اليابان": "Japan",
  "united states": "United States", usa: "United States", america: "United States", "أمريكا": "United States", "الولايات المتحدة": "United States",
};

const WORK_MODE_ALIASES: Record<string, WorkMode> = {
  remote: "remote", "عن بعد": "remote", "عن بُعد": "remote", "ريموت": "remote",
  hybrid: "hybrid", "هجين": "hybrid",
  onsite: "onsite", "on-site": "onsite", "حضوري": "onsite", "دوام حضوري": "onsite",
};

const JOB_TYPE_ALIASES: Record<string, JobType> = {
  freelance: "freelance", "عمل حر": "freelance", "فريلانس": "freelance",
  internship: "internship", "تدريب": "internship",
  "part time": "part-time", "part-time": "part-time", "دوام جزئي": "part-time",
  "full time": "full-time", "full-time": "full-time", "دوام كامل": "full-time",
  contract: "contract", "عقد": "contract",
  temporary: "temporary", "مؤقت": "temporary",
};

const ACCESSIBILITY_TERMS = ["blind", "كفيف", "كفيفة", "أعمى", "عمياء", "disability", "إعاقة", "اعاقة", "معاق", "معاقة", "wheelchair", "كرسي متحرك", "deaf", "أصم"];
const VISA_TERMS = ["visa", "تأشيرة", "فيزا", "sponsorship", "كفالة"];
const SKILL_KEYWORDS = [
  "react", "python", "javascript", "typescript", "java", "node", "node.js", "figma", "sql",
  "aws", "docker", "kubernetes", "nursing", "nurse", "teacher", "teaching", "design", "marketing",
  "sales", "accounting", "legal", "translation", "security", "logistics", "ai", "machine learning",
];

function findSalary(text: string): number | undefined {
  const match = text.match(/(\d{3,6})\s*(?:\$|usd|دولار|دولاراً|دولارًا)?/i);
  if (!match) return undefined;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) ? num : undefined;
}

function findFromAliasMap<T extends string>(text: string, aliases: Record<string, T>): T | undefined {
  const lower = text.toLowerCase();
  for (const [alias, value] of Object.entries(aliases)) {
    if (lower.includes(alias.toLowerCase())) return value;
  }
  return undefined;
}

export function parseJobQuery(rawText: string): ParsedAiQuery {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  const country = findFromAliasMap(text, COUNTRY_ALIASES);
  const workMode = findFromAliasMap(text, WORK_MODE_ALIASES);
  const jobType = findFromAliasMap(text, JOB_TYPE_ALIASES);
  const minSalary = findSalary(text);
  const isAccessible = ACCESSIBILITY_TERMS.some((term) => lower.includes(term.toLowerCase()));
  const isVisaSponsorship = VISA_TERMS.some((term) => lower.includes(term.toLowerCase()));
  const keywords = SKILL_KEYWORDS.filter((kw) => lower.includes(kw));

  const summaryParts: string[] = [];
  if (keywords.length) summaryParts.push(keywords.map((k) => k[0].toUpperCase() + k.slice(1)).join(", "));
  if (workMode) summaryParts.push(workMode[0].toUpperCase() + workMode.slice(1));
  if (country) summaryParts.push(country);
  if (minSalary) summaryParts.push(`$${minSalary.toLocaleString()}+`);
  if (isAccessible) summaryParts.push("Accessible workplace");
  if (isVisaSponsorship) summaryParts.push("Visa sponsorship");
  if (jobType) summaryParts.push(jobType);

  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "No specific filters detected — showing all jobs";

  return {
    keywords, country, location: country, workMode, minSalary,
    isAccessible: isAccessible || undefined,
    isVisaSponsorship: isVisaSponsorship || undefined,
    jobType, summary,
  };
}
