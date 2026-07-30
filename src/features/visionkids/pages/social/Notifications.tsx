import * as Icons from "lucide-react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/visionkids/hooks/social/useNotifications";
import type { KidsNotificationType } from "@/features/visionkids/types/social.types";

const TYPE_ICONS: Record<KidsNotificationType, keyof typeof Icons> = {
  info: "Info", warning: "AlertTriangle", success: "CheckCircle2", error: "XCircle",
  achievement: "Award", message: "MessageCircle", invite: "Mail", challenge: "Trophy", weekly_report: "FileText",
};

export default function Notifications() {
  const { t } = useLanguage();
  const { data: notifications = [], isLoading } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useDocumentHead({ title: `${t("kids.social.notifications.title")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/notifications" });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <Bell className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.notifications.title")}
        </h1>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> {t("kids.social.notifications.markAllRead")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : notifications.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.notifications.empty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => {
            const Icon = (Icons[TYPE_ICONS[n.type]] as Icons.LucideIcon) ?? Icons.Bell;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-start transition-colors ${n.is_read ? "border-border bg-card" : "border-kids-primary/40 bg-kids-primary/5"}`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
