/**
 * Academy — Self-notification helper (Phase 9, Control Center)
 *
 * Wraps the `notify_self` RPC (see supabase/migrations/20260703000000_academy_notify_self.sql)
 * to insert a row into the EXISTING site-wide `notifications` table — the
 * same table NotificationBell.tsx (Navbar) and AdminNotifications.tsx
 * already read/write. No new notification system is introduced.
 *
 * Self-only by design: the RPC targets auth.uid() internally, so this can
 * only ever notify the currently signed-in user about their own activity
 * (certificate earned, achievements unlocked, etc.) — not other users.
 * Cross-user notifications (e.g. "your instructor graded your assignment")
 * would need a validated RPC against real ownership data, which the Phase 6
 * assessment tables don't have yet (they're local-store only) — see the
 * Phase 9 summary for what's intentionally left unwired.
 */

import { supabase } from "@/integrations/supabase/client";

export type AcademyNotifyType = "info" | "success" | "warning" | "error";

export async function notifyAcademySelf(title: string, body: string, type: AcademyNotifyType = "info"): Promise<void> {
  const { error } = await supabase.rpc("notify_self", { _title: title, _body: body, _type: type });
  if (error) {
    console.warn("[academy/notify] notifyAcademySelf error:", error.message);
  }
}
