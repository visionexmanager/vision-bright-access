// ─── Real DB row → legacy UI shape adapters (Phase 1 backend) ─────────────────
// JobCard/CompanyCard/useJobSearch were built against the mock `Job`/`Company`
// types (types.ts). Several of those fields don't exist in the deployed
// `jobs`/`companies` schema (companyLogoColor, country/city split, education,
// isUrgent, isAiJob) — this adapter fills them with honest defaults/best-effort
// derivations instead of fabricating data, so the card UI keeps working
// unchanged while the data source becomes real.

import { colorFromString } from "@/lib/utils/stringColor";
import type { JobWithCompany, CompanyRow, CareerJobType } from "@/lib/types/career";
import type { Job, Company, JobType, WorkMode } from "./types";

const JOB_TYPE_MAP: Record<CareerJobType, JobType> = {
  full_time: "full-time",
  part_time: "part-time",
  contract: "contract",
  temporary: "temporary",
  internship: "internship",
  freelance: "freelance",
};

export function jobRowToCard(row: JobWithCompany): Job {
  const companyName = row.company?.name ?? "";
  const workMode: WorkMode = row.remote ? "remote" : "onsite"; // DB has no "hybrid" — boolean `remote` only
  return {
    id: row.id,
    title: row.title,
    companyId: row.company_id,
    companyName,
    companyLogoColor: colorFromString(companyName || row.company_id),
    location: row.location ?? "",
    country: row.location ?? "",
    city: "",
    salaryMin: row.salary_min ?? 0,
    salaryMax: row.salary_max ?? 0,
    currency: row.currency,
    type: JOB_TYPE_MAP[row.job_type],
    workMode,
    experienceLevel: row.experience_level,
    education: "", // not in the deployed schema
    categoryId: "", // not in the deployed schema — category filter is a no-op until it is
    skills: row.skills_required,
    postedAt: row.created_at,
    isUrgent: false, // not in the deployed schema
    isAccessible: row.accessibility_friendly,
    isVisaSponsorship: row.visa_sponsorship,
    isAiJob: false, // not in the deployed schema
    description: row.description,
  };
}

export function companyRowToCard(row: CompanyRow, openJobs = 0): Company {
  return {
    id: row.id,
    name: row.name,
    logoColor: colorFromString(row.name || row.id),
    industry: row.industry ?? "",
    openJobs,
    rating: row.accessibility_rating ?? 0,
    location: row.location ?? "",
  };
}
