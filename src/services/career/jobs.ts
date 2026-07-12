// ─── Career Center — Jobs Service (Phase 1 backend) ───────────────────────────
// Tables: jobs, companies. Public listings (RLS: active jobs are viewable by
// anyone; companies are fully public) — no auth required to browse.

import { supabase } from "@/integrations/supabase/client";
import type { JobWithCompany, CompanyRow } from "@/lib/types/career";

export interface JobFilters {
  query?: string;
  remote?: boolean;
  jobType?: string;
  limit?: number;
}

const JOB_WITH_COMPANY_SELECT = "*, company:companies(*)";

export async function fetchActiveJobs(filters: JobFilters = {}): Promise<JobWithCompany[]> {
  let q = (supabase.from("jobs") as any)
    .select(JOB_WITH_COMPANY_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%,]/g, "");
    q = q.ilike("title", `%${term}%`);
  }
  if (filters.remote !== undefined) q = q.eq("remote", filters.remote);
  if (filters.jobType) q = q.eq("job_type", filters.jobType);
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JobWithCompany[];
}

export async function fetchJobById(jobId: string): Promise<JobWithCompany | null> {
  const { data, error } = await (supabase.from("jobs") as any)
    .select(JOB_WITH_COMPANY_SELECT)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as JobWithCompany | null;
}

export async function fetchCompanies(limit = 20): Promise<CompanyRow[]> {
  const { data, error } = await (supabase.from("companies") as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyRow[];
}

/**
 * Simple skill-overlap recommendation: active jobs whose `skills_required`
 * intersects the candidate's `career_profiles.skills`, falling back to the
 * newest active jobs when the candidate has no skills on file yet. Not ML —
 * an honest, cheap first pass matching what the deployed schema can support.
 */
export async function fetchRecommendedJobs(skills: string[], limit = 10): Promise<JobWithCompany[]> {
  let q = (supabase.from("jobs") as any)
    .select(JOB_WITH_COMPANY_SELECT)
    .eq("status", "active");

  if (skills.length > 0) {
    q = q.overlaps("skills_required", skills);
  }

  q = q.order("created_at", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JobWithCompany[];
}
