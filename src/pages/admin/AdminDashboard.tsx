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

type Stats = {
  products: number; content: number; users: number; requests: number;
  reports: number; subscribers: number; logs: number; notifications: number;
};

const ADMIN_CARDS = [
  { title: "المستخدمون", key: "users" as const, icon: Users, link: "/admin/users", color: "text-purple-500", desc: "إدارة، حظر، نقاط، ميزات" },
  { title: "المنتجات", key: "products" as const, icon: Package, link: "/admin/products", color: "text-blue-500", desc: "إضافة وتعديل المنتجات" },
  { title: "المحتوى", key: "content" as const, icon: FileText, link: "/admin/content", color: "text-green-500", desc: "كورسات، مقالات، بودكاست" },
  { title: "الإشراف", key: "reports" as const, icon: Flag, link: "/admin/moderation", color: "text-red-500", desc: "مراجعة البلاغات" },
  { title: "الإيميلات", key: null, icon: Mail, link: "/admin/emails", color: "text-pink-500", desc: "نشرات بريدية وإيميلات" },
  { title: "المشتركون", key: "subscribers" as const, icon: Bell, link: "/admin/subscribers", color: "text-indigo-500", desc: "إدارة النشرة البريدية" },
  { title: "التحليلات", key: null, icon: BarChart3, link: "/admin/analytics", color: "text-cyan-500", desc: "تقارير وإحصائيات AI" },
  { title: "قاعدة البيانات", key: null, icon: Database, link: "/admin/database", color: "text-teal-500", desc: "عرض وإدارة البيانات" },
  { title: "سجل العمليات", key: "logs" as const, icon: ScrollText, link: "/admin/logs", color: "text-amber-500", desc: "تتبع عمليات الأدمن" },
  { title: "طلبات الخدمة", key: "requests" as const, icon: ShieldAlert, link: "/admin/requests", color: "text-orange-500", desc: "طلبات المستخدمين" },
  { title: "إعدادات الموقع", key: null, icon: Settings, link: "/admin/settings", color: "text-gray-500", desc: "تخصيص الواجهة" },
];

export default function AdminDashboard() {
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
            <h1 className="text-3xl font-bold">لوحة الأدمن</h1>
            <p className="text-muted-foreground text-sm">تحكم كامل بالموقع</p>
          </div>
        </div>

        {/* Quick alerts */}
        <div className="mb-6 flex flex-wrap gap-3">
          {stats.reports > 0 && (
            <Link to="/admin/moderation">
              <Badge className="bg-red-600 cursor-pointer hover:bg-red-700 px-3 py-1.5 text-sm">
                <Flag className="me-1 h-3 w-3" /> {stats.reports} بلاغ بانتظار المراجعة
              </Badge>
            </Link>
          )}
          {stats.requests > 0 && (
            <Link to="/admin/requests">
              <Badge className="bg-orange-500 cursor-pointer hover:bg-orange-600 px-3 py-1.5 text-sm">
                <ShieldAlert className="me-1 h-3 w-3" /> {stats.requests} طلب خدمة
              </Badge>
            </Link>
          )}
          {import.meta.env.VITE_LIVEKIT_URL?.includes("YOUR_PROJECT") && (
            <Badge className="bg-yellow-500 text-black px-3 py-1.5 text-sm">
              <AlertTriangle className="me-1 h-3 w-3" /> LiveKit URL غير مُعد — غرف الصوت معطلة
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ADMIN_CARDS.map((card) => {
            const count = card.key ? stats[card.key] : null;
            return (
              <Link key={card.title} to={card.link}>
                <Card className="transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    {count !== null ? (
                      <p className="text-3xl font-bold">{count}</p>
                    ) : (
                      <p className="text-lg font-medium">إدارة</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
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
