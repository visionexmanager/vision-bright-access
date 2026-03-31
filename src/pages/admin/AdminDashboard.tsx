import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Package, FileText, Users, Settings, ShieldCheck, BarChart3 } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, content: 0, users: 0, requests: 0 });

  useEffect(() => {
    const load = async () => {
      const [p, c, u, r] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("content_items").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        products: p.count ?? 0,
        content: c.count ?? 0,
        users: u.count ?? 0,
        requests: r.count ?? 0,
      });
    };
    load();
  }, []);

  const cards = [
    { title: "Products", count: stats.products, icon: Package, link: "/admin/products", color: "text-blue-500" },
    { title: "Content", count: stats.content, icon: FileText, link: "/admin/content", color: "text-green-500" },
    { title: "Users", count: stats.users, icon: Users, link: "/admin/users", color: "text-purple-500" },
    { title: "Site Settings", count: null, icon: Settings, link: "/admin/settings", color: "text-orange-500" },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.title} to={c.link}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  {c.count !== null ? (
                    <p className="text-3xl font-bold">{c.count}</p>
                  ) : (
                    <p className="text-lg text-muted-foreground">Configure</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Service Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{stats.requests} total requests</p>
            <Link to="/admin/requests">
              <Button variant="outline" className="mt-3">View Requests</Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
