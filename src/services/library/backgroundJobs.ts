// ─── Library — Background Jobs Queue (Phase 11) ────────────────────────────
// Admin read-only visibility into library_background_jobs — the queue
// itself is only ever written by enqueue_library_background_job() (client)
// and the library-process-background-jobs worker (service role); see that
// migration section for why a client can't insert/update rows directly.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryBackgroundJobRow {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchRecentBackgroundJobs(limit = 50): Promise<LibraryBackgroundJobRow[]> {
  const { data, error } = await supabase
    .from("library_background_jobs")
    .select("id, job_type, payload, status, attempts, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBackgroundJobRow[];
}
