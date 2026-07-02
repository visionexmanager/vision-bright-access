import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Full notification history — reads the SAME `notifications` table
 * NotificationBell.tsx (Navbar) already uses, just without the 30-row cap
 * and with a read/unread filter. No new notification system, no new table.
 * Shared by /academy/notifications and the Instructor Dashboard's
 * Notifications tab so both stay in sync with one implementation.
 */

type NotifRow = { id: string; title: string; body: string; type: string; is_read: boolean; created_at: string };

const TYPE_ICON: Record<string, typeof Info> = {
  info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle,
};
const TYPE_COLOR: Record<string, string> = {
  info: "text-blue-500 bg-blue-500/10", success: "text-emerald-500 bg-emerald-500/10",
  warning: "text-yellow-500 bg-yellow-500/10", error: "text-red-500 bg-red-500/10",
};

export function NotificationHistoryList() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await (supabase.from("notifications") as any)
      .select("id, title, body, type, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setNotifications(data as NotifRow[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    if (!user) return;
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const visible = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">الكل ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread">غير مقروءة ({unreadCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2 rounded-xl">
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">{filter === "unread" ? "لا توجد إشعارات غير مقروءة." : "لا توجد إشعارات بعد."}</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="سجل الإشعارات">
          {visible.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Info;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border ${n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}
              >
                <span className={`p-2 rounded-xl shrink-0 ${TYPE_COLOR[n.type] ?? TYPE_COLOR.info}`} aria-hidden="true">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground text-sm">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{new Date(n.created_at).toLocaleString("ar")}</p>
                </div>
                {!n.is_read && (
                  <Button variant="ghost" size="sm" onClick={() => markOneRead(n.id)} className="shrink-0 text-xs rounded-lg">
                    تحديد كمقروء
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
