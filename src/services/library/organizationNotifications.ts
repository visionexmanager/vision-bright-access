// ─── Library — Enterprise Platform: Notifications & Calendar ──────────────
// Announcements/assignment/deadline/resource/certificate notifications all
// reuse the existing site-wide public.notifications table (see the
// trg_notify_organization_* triggers + send_organization_announcement RPC
// in the migration) — this file only wraps the one interactive action
// (sending an announcement) plus fetching org-scoped calendar events for
// ICS export. The Notification Center itself needs no new code: it already
// reads the shared notifications table for the signed-in user.

import { supabase } from "@/integrations/supabase/client";
import type { OrganizationCalendarEvent } from "@/lib/library/organizationCalendar";

export async function sendOrganizationAnnouncement(orgId: string, title: string, body: string): Promise<number> {
  const { data, error } = await supabase.rpc("send_organization_announcement", { _organization_id: orgId, _title: title, _body: body });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function fetchOrganizationCalendarEvents(orgId: string): Promise<OrganizationCalendarEvent[]> {
  const { data, error } = await supabase
    .from("library_events")
    .select("id, title, description, scheduled_start, scheduled_end")
    .eq("organization_id", orgId)
    .eq("is_cancelled", false)
    .order("scheduled_start", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id, title: e.title, description: e.description, scheduledStart: e.scheduled_start, scheduledEnd: e.scheduled_end,
  }));
}
