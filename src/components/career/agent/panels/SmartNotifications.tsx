import { useState } from "react";
import { Briefcase, CalendarClock, GraduationCap, DollarSign, Building2, Plane, Accessibility, CheckCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MOCK_NOTIFICATIONS } from "../mock/mockNotifications";
import type { AgentNotification, NotificationCategory } from "../types";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  jobs: Briefcase,
  interviews: CalendarClock,
  learning: GraduationCap,
  salary: DollarSign,
  companies: Building2,
  visa: Plane,
  accessibility: Accessibility,
};

const CATEGORIES: NotificationCategory[] = ["jobs", "interviews", "learning", "salary", "companies", "visa", "accessibility"];

export function SmartNotifications() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<AgentNotification[]>(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.category === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("agentUI.nav.notifications")}</h1>
          <p className="text-sm text-muted-foreground">{t("agentUI.notifications.subtitle").replace("{count}", String(unreadCount))}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("agentUI.notifications.markAllRead")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("agentUI.notifications.filterLabel")}>
        <button type="button" onClick={() => setFilter("all")} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
          {t("agentUI.opportunities.all")}
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} type="button" onClick={() => setFilter(cat)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === cat ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {t(`agentUI.notifications.category.${cat}`)}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {filtered.map((n) => {
          const Icon = CATEGORY_ICON[n.category];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markRead(n.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${n.read ? "border-border/50 bg-card" : "border-primary/30 bg-primary/5"}`}
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
