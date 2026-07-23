import { NotificationBell } from "@/components/NotificationBell";

/** Thin wrapper — reuses the existing app-wide NotificationBell as-is, no separate library notification system. */
export function LibraryNotifications() {
  return <NotificationBell />;
}
