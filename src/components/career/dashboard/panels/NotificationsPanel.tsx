import { useEffect, useState } from "react";
import { FileStack, CalendarClock, MessageCircle, Trophy, Info, CheckCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MOCK_NOTIFICATIONS } from "../mock/mockNotifications";
import type { DashboardNotification, NotificationKind } from "../types";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  application: FileStack,
  interview: CalendarClock,
  message: MessageCircle,
  achievement: Trophy,
  system: Info,
};

export function NotificationsPanel() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<DashboardNotification[]>(MOCK_NOTIFICATIONS);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Client-side simulation of a realtime notification arriving — no backend/socket wired up yet.
  useEffect(() => {
    const timer = setTimeout(() => {
      const incoming: DashboardNotification = {
        id: `no-live-${Date.now()}`,
        kind: "system",
        title: t("careerDash.notifications.liveExample.title"),
        description: t("careerDash.notifications.liveExample.desc"),
        date: new Date().toISOString().slice(0, 10),
        read: false,
      };
      setNotifications((prev) => [incoming, ...prev]);
      setLiveAnnouncement(incoming.title);
    }, 8000);
    return () => clearTimeout(timer);
  }, [t]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.notifications")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.notifications.subtitle").replace("{count}", String(unreadCount))}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("careerDash.notifications.markAllRead")}
        </Button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{liveAnnouncement}</span>

      <ul className="flex flex-col gap-2">
        {notifications.map((n) => {
          const Icon = KIND_ICON[n.kind];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markRead(n.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  n.read ? "border-border/50 bg-card" : "border-primary/30 bg-primary/5"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{n.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.date}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
