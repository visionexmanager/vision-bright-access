import { Briefcase, CalendarClock, GraduationCap, DollarSign, Building2, Plane, Accessibility, Info, CheckCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useCareerNotifications } from "@/hooks/career/useCareerNotifications";
import { CareerErrorState } from "../../ui/CareerErrorState";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  jobs: Briefcase,
  interviews: CalendarClock,
  learning: GraduationCap,
  salary: DollarSign,
  companies: Building2,
  visa: Plane,
  accessibility: Accessibility,
};

export function NotificationsPanel() {
  const { t } = useLanguage();
  const { notifications, unreadCount, isLoading, error, refetch, markRead, markAllRead } = useCareerNotifications();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.notifications")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.notifications.subtitle").replace("{count}", String(unreadCount))}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead()} disabled={unreadCount === 0}>
          <CheckCheck className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("careerDash.notifications.markAllRead")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl border border-border/50 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />
      ) : notifications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.notifications.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const Icon = (n.category && CATEGORY_ICON[n.category]) || Info;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    n.is_read ? "border-border/50 bg-card" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm ${n.is_read ? "font-medium" : "font-bold"}`}>{n.title}</p>
                      {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
