import type { DashboardNotification } from "../types";

export const MOCK_NOTIFICATIONS: DashboardNotification[] = [
  { id: "no-1", kind: "interview", title: "Interview reminder", description: "Your interview with Nova Systems is tomorrow at 3:00 PM.", date: "2026-07-02", read: false },
  { id: "no-2", kind: "message", title: "New message", description: "Nova Systems — Talent Team sent you a message.", date: "2026-07-01", read: false },
  { id: "no-3", kind: "application", title: "Application status updated", description: "Your application to Atlas Finance Group moved to Offer.", date: "2026-06-18", read: false },
  { id: "no-4", kind: "achievement", title: "Badge unlocked", description: "You earned the \"Profile Pro\" badge for completing your profile.", date: "2026-06-12", read: true },
  { id: "no-5", kind: "system", title: "Weekly digest ready", description: "12 new jobs match your saved searches.", date: "2026-06-15", read: true },
];
