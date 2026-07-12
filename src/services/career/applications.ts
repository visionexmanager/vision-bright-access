// ─── Career Center — Applications Service (Phase 1 backend) ──────────────────
// Table: applications, joined to jobs/companies. RLS: candidates see only
// their own rows; employers see applications to jobs they posted (not used
// here — job-seeker side only in this phase).

import { supabase } from "@/integrations/supabase/client";
import type { ApplicationWithJob, CareerApplicationStatus } from "@/lib/types/career";

const APPLICATION_WITH_JOB_SELECT = "*, job:jobs(*, company:companies(*))";

export async function fetchMyApplications(userId: string): Promise<ApplicationWithJob[]> {
  const { data, error } = await (supabase.from("applications") as any)
    .select(APPLICATION_WITH_JOB_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApplicationWithJob[];
}

export async function applyToJob(userId: string, jobId: string, coverLetter?: string): Promise<ApplicationWithJob> {
  const { data, error } = await (supabase.from("applications") as any)
    .insert({ user_id: userId, job_id: jobId, cover_letter: coverLetter ?? null })
    .select(APPLICATION_WITH_JOB_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as ApplicationWithJob;
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  const { error } = await (supabase.from("applications") as any)
    .update({ status: "withdrawn" satisfies CareerApplicationStatus })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
}
