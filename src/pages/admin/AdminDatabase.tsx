import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Database, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const TABLES = [
  { name: "profiles", label: "المستخدمون" },
  { name: "user_roles", label: "الأدوار" },
  { name: "user_points", label: "النقاط" },
  { name: "user_features", label: "الميزات" },
  { name: "products", label: "المنتجات" },
  { name: "content_items", label: "المحتوى" },
  { name: "notifications", label: "الإشعارات" },
  { name: "content_reports", label: "البلاغات" },
  { name: "admin_logs", label: "سجل الأدمن" },
  { name: "newsletter_subscribers", label: "المشتركون" },
  { name: "service_requests", label: "طلبات الخدمة" },
  { name: "simulations", label: "المحاكاة" },
  { name: "voice_rooms", label: "غرف الصوت" },
  { name: "vx_purchases", label: "مشتريات VX" },
  { name: "page_events", label: "أحداث الصفحة" },
  { name: "meal_logs", label: "سجل الوجبات" },
  { name: "tool_purchases", label: "أدوات مشتراة" },
  { name: "site_settings", label: "إعدادات الموقع" },
];

const PAGE_SIZE = 20;

export default function AdminDatabase() {
  const [selectedTable, setSelectedTable] = useState(TABLES[0].name);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCounts = async () => {
    const results = await Promise.all(
      TABLES.map(t => supabase.from(t.name as any).select("*", { count: "exact", head: true }))
    );
    const map: Record<string, number> = {};
    TABLES.forEach((t, i) => { map[t.name] = results[i].count || 0; });
    setCounts(map);
  };

  const loadTable = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const { data, count, error } = await (supabase.from(selectedTable as any)
      .select("*", { count: "exact" })
      .range(from, from + PAGE_SIZE - 1)
      .order("created_at", { ascending: false }) as any);

    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows(data || []);
    setTotal(count || 0);
    if (data && data.length > 0) setColumns(Object.keys(data[0]));
    setLoading(false);
  };

  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { setPage(0); setSearch(""); }, [selectedTable]);
  useEffect(() => { loadTable(); }, [selectedTable, page]);

  const filteredRows = search
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "✓" : "✗";
    if (typeof val === "object") return JSON.stringify(val).slice(0, 80) + (JSON.stringify(val).length > 80 ? "…" : "");
    const str = String(val);
    return str.length > 80 ? str.slice(0, 80) + "…" : str;
  };

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">قاعدة البيانات</h1>
          <Button variant="ghost" size="icon" onClick={loadTable}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Table List */}
          <div className="space-y-1">
            {TABLES.map(t => (
              <button
                key={t.name}
                onClick={() => setSelectedTable(t.name)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedTable === t.name
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Database className="h-3 w-3" />{t.label}
                </span>
                <Badge variant={selectedTable === t.name ? "secondary" : "outline"} className="text-xs">
                  {counts[t.name] ?? "…"}
                </Badge>
              </button>
            ))}
          </div>

          {/* Table Content */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في البيانات..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <span className="text-sm text-muted-foreground">{total} سجل</span>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map(col => (
                            <TableHead key={col} className="text-xs font-mono">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                              لا توجد بيانات
                            </TableCell>
                          </TableRow>
                        )}
                        {filteredRows.map((row, i) => (
                          <TableRow key={i}>
                            {columns.map(col => (
                              <TableCell key={col} className="text-xs font-mono max-w-[200px] truncate">
                                {formatCell(row[col])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  صفحة {page + 1} من {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
