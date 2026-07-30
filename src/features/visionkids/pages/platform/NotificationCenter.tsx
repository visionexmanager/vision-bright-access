import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useNotifications, useMarkNotificationRead } from "@/features/visionkids/hooks/platform/usePlatform";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

export default function NotificationCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  useDocumentHead({
    title: `${t("kids.platform.nav.notifications")} — VisionKids`,
    description: t("kids.platform.notifications.subtitle"),
    canonicalPath: "/kids/platform/notifications",
  });

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <PlatformHeader emoji="🔔" title={t("kids.platform.nav.notifications")} subtitle={t("kids.platform.notifications.subtitle")} />
        {user && hasUnread && (
          <button type="button" onClick={() => markRead.mutate(null)} disabled={markRead.isPending}
            className="mt-8 inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold hover:border-kids-primary/50 disabled:opacity-50">
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> {t("kids.platform.notifications.markAll")}
          </button>
        )}
      </div>

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.platform.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : notifications.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.platform.notifications.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => {
            const body = (
              <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${n.read ? "border-border bg-card" : "border-kids-primary/40 bg-kids-primary/5"}`}>
                <span className="text-2xl" aria-hidden="true">{n.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold leading-tight">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-kids-primary" aria-label={t("kids.platform.unread")} />}
              </div>
            );
            return (
              <li key={n.id} onClick={() => !n.read && markRead.mutate(n.id)}>
                {n.link ? <Link to={n.link}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
