// ─── Library — Enterprise Platform: Scheduled Reports ──────────────────────
// Backed by organization_scheduled_reports + a real daily pg_cron trigger
// (enqueue_due_organization_reports) that enqueues due reports into the
// existing library_background_jobs queue; library-process-background-jobs
// sends the email. Note: like every other library_background_jobs consumer,
// that worker itself still needs an external scheduler hitting it over HTTP
// (Supabase Dashboard Cron Jobs, or pg_cron+pg_net) — that's a one-time ops
// step already documented on the worker function itself, not something this
// client code can configure.

import { supabase } from "@/integrations/supabase/client";

export type OrganizationReportCadence = "weekly" | "monthly";

export interface OrganizationScheduledReportRow {
  id: string;
  organization_id: string;
  report_name: string;
  cadence: OrganizationReportCadence;
  recipient_emails: string[];
  is_active: boolean;
  last_run_at: string | null;
  created_by: string;
  created_at: string;
}

export async function fetchScheduledReports(orgId: string): Promise<OrganizationScheduledReportRow[]> {
  const { data, error } = await supabase
    .from("organization_scheduled_reports").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationScheduledReportRow[];
}

export async function createScheduledReport(orgId: string, createdBy: string, reportName: string, cadence: OrganizationReportCadence, recipientEmails: string[]): Promise<OrganizationScheduledReportRow> {
  const { data, error } = await supabase
    .from("organization_scheduled_reports")
    .insert({ organization_id: orgId, report_name: reportName, cadence, recipient_emails: recipientEmails, created_by: createdBy })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as OrganizationScheduledReportRow;
}

export async function deleteScheduledReport(reportId: string): Promise<void> {
  const { error } = await supabase.from("organization_scheduled_reports").delete().eq("id", reportId);
  if (error) throw new Error(error.message);
}

export async function toggleScheduledReport(reportId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("organization_scheduled_reports").update({ is_active: isActive }).eq("id", reportId);
  if (error) throw new Error(error.message);
}
