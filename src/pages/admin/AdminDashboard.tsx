import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, FileText, Users, Settings, ShieldCheck, BarChart3,
  Mail, ShieldAlert, Database, ScrollText, Flag, Coins, Bell, AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

type Stats = {
  products: number; content: number; users: number; requests: number;
  reports: number; subscribers: number; logs: number; notifications: number;
};

const ADMIN_CARDS = [
  { id: "users", key: "users" as const, icon: Users, link: "/admin/users", color: "text-purple-500" },
  { id: "products", key: "products" as const, icon: Package, link: "/admin/products", color: "text-blue-500" },
  { id: "content", key: "content" as const, icon: FileText, link: "/admin/content", color: "text-green-500" },
  { id: "moderation", key: "reports" as const, icon: Flag, link: "/admin/moderation", color: "text-red-500" },
  { id: "emails", key: null, icon: Mail, link: "/admin/emails", color: "text-pink-500" },
  { id: "subscribers", key: "subscribers" as const, icon: Bell, link: "/admin/subscribers", color: "text-indigo-500" },
  { id: "analytics", key: null, icon: BarChart3, link: "/admin/analytics", color: "text-cyan-500" },
  { id: "database", key: null, icon: Database, link: "/admin/database", color: "text-teal-500" },
  { id: "logs", key: "logs" as const, icon: ScrollText, link: "/admin/logs", color: "text-amber-500" },
  { id: "requests", key: "requests" as const, icon: ShieldAlert, link: "/admin/requests", color: "text-orange-500" },
  { id: "settings", key: null, icon: Settings, link: "/admin/settings", color: "text-gray-500" },
  { id: "vx", key: null, icon: Coins, link: "/admin/vx", color: "text-yellow-500" },
];

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats>({
    products: 0, content: 0, users: 0, requests: 0,
    reports: 0, subscribers: 0, logs: 0, notifications: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [p, c, u, r, rep, sub, logs, notif] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("content_items").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id", { count: "exact", head: true }),
        supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
        supabase.from("admin_logs").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      ]);
      setStats({
        products: p.count ?? 0,
        content: c.count ?? 0,
        users: u.count ?? 0,
        requests: r.count ?? 0,
        reports: rep.count ?? 0,
        subscribers: sub.count ?? 0,
        logs: logs.count ?? 0,
        notifications: notif.count ?? 0,
      });
    };
    load();
  }, []);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t("admin.dashboard.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("admin.dashboard.subtitle")}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {stats.reports > 0 && (
            <Link to="/admin/moderation">
              <Badge className="bg-red-600 cursor-pointer hover:bg-red-700 px-3 py-1.5 text-sm">
                <Flag className="me-1 h-3 w-3" /> {t("admin.dashboard.pendingReports").replace("{count}", String(stats.reports))}
              </Badge>
            </Link>
          )}
          {stats.requests > 0 && (
            <Link to="/admin/requests">
              <Badge className="bg-orange-500 cursor-pointer hover:bg-orange-600 px-3 py-1.5 text-sm">
                <ShieldAlert className="me-1 h-3 w-3" /> {t("admin.dashboard.serviceRequests").replace("{count}", String(stats.requests))}
              </Badge>
            </Link>
          )}
          {import.meta.env.VITE_LIVEKIT_URL?.includes("YOUR_PROJECT") && (
            <Badge className="bg-yellow-500 text-black px-3 py-1.5 text-sm">
              <AlertTriangle className="me-1 h-3 w-3" /> {t("admin.dashboard.livekitWarning")}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ADMIN_CARDS.map((card) => {
            const count = card.key ? stats[card.key] : null;
            return (
              <Link key={card.id} to={card.link}>
                <Card className="transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t(`admin.dashboard.card.${card.id}.title`)}</CardTitle>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    {count !== null ? <p className="text-3xl font-bold">{count}</p> : <p className="text-lg font-medium">{t("admin.dashboard.manage")}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{t(`admin.dashboard.card.${card.id}.desc`)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
