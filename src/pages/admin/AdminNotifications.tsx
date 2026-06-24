import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Bell, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

type NotifRow = { id: string; title: string; body: string; type: string; is_read: boolean; created_at: string; };

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600",
  success: "bg-green-500/10 text-green-600",
  warning: "bg-yellow-500/10 text-yellow-600",
  promo: "bg-purple-500/10 text-purple-600",
};

export default function AdminNotifications() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<NotifRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadRecent = async () => {
    const { data } = await supabase.from("notifications").select("id, title, body, type, is_read, created_at").order("created_at", { ascending: false }).limit(20);
    if (data) setRecent(data as NotifRow[]);
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => { loadRecent(); }, []);

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { toast.error(t("admin.notifications.validation")); return; }
    setLoading(true);

    const { data: profiles } = await supabase.from("profiles").select("user_id");
    if (!profiles || profiles.length === 0) { toast.error(t("admin.notifications.noUsers")); setLoading(false); return; }

    const rows = profiles.map((p) => ({ user_id: p.user_id, title: title.trim(), body: body.trim(), type, sent_by: user?.id ?? null }));
    const { error } = await supabase.from("notifications").insert(rows);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.notifications.sent").replace("{count}", String(profiles.length)));
    setTitle(""); setBody(""); setType("info");
    loadRecent();
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10">
            <Bell className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("admin.notifications.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("admin.notifications.subtitle")}</p>
          </div>
          {unreadCount > 0 && <Badge className="bg-red-500 ms-auto">{unreadCount} {t("admin.notifications.unread")}</Badge>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.notifications.broadcastTitle")}</CardTitle>
            <CardDescription>{t("admin.notifications.broadcastDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendBroadcast} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.notifications.msgTitle")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.notifications.titlePlaceholder")} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.notifications.msgBody")}</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("admin.notifications.bodyPlaceholder")} rows={3} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.notifications.typeLabel")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">{t("admin.notifications.type.info")}</SelectItem>
                    <SelectItem value="success">{t("admin.notifications.type.success")}</SelectItem>
                    <SelectItem value="warning">{t("admin.notifications.type.warning")}</SelectItem>
                    <SelectItem value="promo">{t("admin.notifications.type.promo")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                <Send className="me-2 h-4 w-4" />
                {loading ? t("admin.notifications.sending") : t("admin.notifications.send")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {recent.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" /> {t("admin.notifications.recentTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recent.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                    <Badge className={`shrink-0 mt-0.5 text-xs ${TYPE_COLORS[n.type] ?? TYPE_COLORS.info}`}>{t(`admin.notifications.type.${n.type}`)}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
