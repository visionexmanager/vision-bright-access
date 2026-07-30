import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsNotification } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

/** Reuses the site-wide `notifications` table (20260422000000) — widened
 *  with kid-relevant types in 20260813000000 — instead of a parallel
 *  kids_notifications table. */
export async function fetchMyNotifications(limit = 50): Promise<KidsNotification[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit)
    .returns<KidsNotification[]>();
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await kidsDb.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw error;
}

export async function fetchUnreadCount(): Promise<number> {
  const userId = await requireUserId();
  const { count, error } = await kidsDb
    .from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}
