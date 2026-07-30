import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsUsageStatus, UsageCategory } from "@/features/visionkids/types/social.types";

/** Records ~30 real seconds of usage and returns today's status. Call this
 *  from a heartbeat mounted once in the layout — never pass a duration,
 *  the server always credits a fixed 30s per call (see the RPC's own
 *  comment on why: it can't be spoofed into reporting more). */
export async function pingUsage(category: UsageCategory): Promise<KidsUsageStatus> {
  const { data, error } = await kidsDb.rpc("ping_kids_usage", { _category: category }).single();
  if (error) throw error;
  return data as KidsUsageStatus;
}

/** Read-only — for a parent viewing the dashboard, or a child's own app
 *  shell checking status without ticking their own clock further. */
export async function fetchUsageToday(childUserId?: string): Promise<KidsUsageStatus> {
  const { data, error } = await kidsDb.rpc("get_kids_usage_today", { _child_user_id: childUserId ?? null }).single();
  if (error) throw error;
  return data as KidsUsageStatus;
}

/** Bedtime / study-time gates are evaluated client-side against the
 *  child's settings (HH:MM:SS strings from Postgres TIME columns) — same
 *  client-enforced trust model as the rest of this platform's anti-cheat
 *  posture (see kids_usage_pings' own migration comment). A determined
 *  child could bypass this by editing local state, but the point is a
 *  clear, honest guardrail for a cooperating family, not a hard lock. */
export function isWithinTimeWindow(nowHHMM: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const startHHMM = start.slice(0, 5);
  const endHHMM = end.slice(0, 5);
  if (startHHMM <= endHHMM) {
    return nowHHMM >= startHHMM && nowHHMM < endHHMM;
  }
  // Overnight window (e.g. bedtime 20:00 → 07:00)
  return nowHHMM >= startHHMM || nowHHMM < endHHMM;
}
