// ─── Career Center — Notifications Service (Phase 1 backend) ─────────────────
// Reuses the site-wide `notifications` table (same one src/components/
// NotificationBell.tsx reads) — Career Center only added a `category` column
// to filter its own notices out of the shared stream. RLS: owner-only
// SELECT/UPDATE ("Users view own notifications" / "Users update own
// notifications" policies from 20260422000000_admin_panel_expansion.sql).

import { supabase } from "@/integrations/supabase/client";
import type { CareerNotificationRow } from "@/lib/types/career";

export const CAREER_NOTIFICATION_CATEGORIES = [
  "jobs", "interviews", "learning", "salary", "companies", "visa", "accessibility",
] as const;

export async function fetchCareerNotifications(userId: string, limit = 30): Promise<CareerNotificationRow[]> {
  const { data, error } = await (supabase.from("notifications") as any)
    .select("id, user_id, title, body, type, category, is_read, created_at")
    .eq("user_id", userId)
    .in("category", CAREER_NOTIFICATION_CATEGORIES)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CareerNotificationRow[];
}

export async function markCareerNotificationRead(notificationId: string): Promise<void> {
  const { error } = await (supabase.from("notifications") as any)
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function markAllCareerNotificationsRead(userId: string): Promise<void> {
  const { error } = await (supabase.from("notifications") as any)
    .update({ is_read: true })
    .eq("user_id", userId)
    .in("category", CAREER_NOTIFICATION_CATEGORIES)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}
