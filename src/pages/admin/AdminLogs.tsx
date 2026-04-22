import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ScrollText, Search, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

type Log = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  ban_user: "bg-red-600",
  suspend_user: "bg-orange-500",
  unban_user: "bg-green-600",
  grant_points: "bg-yellow-500",
  toggle_feature: "bg-purple-600",
  send_newsletter: "bg-blue-600",
  send_email: "bg-blue-500",
};

const ACTION_LABELS: Record<string, string> = {
  ban_user: "حظر مستخدم",
  suspend_user: "تعليق مستخدم",
  unban_user: "رفع حظر",
  grant_points: "منح نقاط",
  toggle_feature: "تغيير ميزة",
  send_newsletter: "إرسال نشرة",
  send_email: "إرسال إيميل",
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (filterAction !== "all") query = query.eq("action", filterAction);
    const { data } = await query;
    setLogs((data as unknown as Log[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterAction]);

  const filtered = search
    ? logs.filter(l => l.action.includes(search) || l.target_id?.includes(search) ||
        JSON.stringify(l.details || {}).includes(search))
    : logs;

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">سجل العمليات</h1>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Badge variant="secondary">{logs.length} عملية</Badge>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-48"><SelectValue placeholder="فلترة حسب العملية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمليات</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العملية</TableHead>
                  <TableHead>الهدف</TableHead>
                  <TableHead>التفاصيل</TableHead>
                  <TableHead>الأدمن</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
                )}
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] || "bg-gray-500"}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.target_type && <Badge variant="outline" className="text-xs me-1">{log.target_type}</Badge>}
                      <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{log.target_id || "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      {log.details ? JSON.stringify(log.details).slice(0, 100) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {log.admin_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("ar")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
