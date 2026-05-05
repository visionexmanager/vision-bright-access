import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Database, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/contexts/LanguageContext";

const TABLES = ["profiles", "user_roles", "user_points", "user_features", "products", "content_items", "notifications", "content_reports", "admin_logs", "newsletter_subscribers", "service_requests", "simulations", "voice_rooms", "vx_purchases", "page_events", "meal_logs", "tool_purchases", "site_settings"];
const PAGE_SIZE = 20;
const PII_COLUMNS = new Set(["email", "phone", "password", "encrypted_password", "raw_user_meta_data", "raw_app_meta_data", "confirmation_token", "recovery_token", "email_change_token_new", "email_change_token_current"]);

export default function AdminDatabase() {
  const { t } = useLanguage();
  const [selectedTable, setSelectedTable] = useState(TABLES[0]); const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [columns, setColumns] = useState<string[]>([]); const [counts, setCounts] = useState<Record<string, number>>({}); const [page, setPage] = useState(0); const [total, setTotal] = useState(0); const [search, setSearch] = useState(""); const debouncedSearch = useDebounce(search); const [loading, setLoading] = useState(false);
  const tableLabel = (name: string) => t(`admin.database.table.${name}`);
  const loadCounts = async () => { const results = await Promise.all(TABLES.map(name => supabase.from(name as any).select("*", { count: "exact", head: true }))); const map: Record<string, number> = {}; TABLES.forEach((name, i) => { map[name] = results[i].count || 0; }); setCounts(map); };
  const loadTable = async () => { setLoading(true); const from = page * PAGE_SIZE; const { data, count, error } = await (supabase.from(selectedTable as any).select("*", { count: "exact" }).range(from, from + PAGE_SIZE - 1).order("created_at", { ascending: false }) as any); if (error) { toast.error(error.message); setLoading(false); return; } setRows(data || []); setTotal(count || 0); if (data && data.length > 0) setColumns(Object.keys(data[0])); setLoading(false); };
  useEffect(() => { loadCounts(); }, []); useEffect(() => { setPage(0); setSearch(""); }, [selectedTable]); useEffect(() => { loadTable(); }, [selectedTable, page]);
  const filteredRows = debouncedSearch ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(debouncedSearch.toLowerCase())) : rows;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const formatCell = (col: string, val: unknown): string => { if (PII_COLUMNS.has(col)) return "••••••••"; if (val === null || val === undefined) return "-"; if (typeof val === "boolean") return val ? "✓" : "×"; if (typeof val === "object") { const json = JSON.stringify(val); return json.slice(0, 80) + (json.length > 80 ? "..." : ""); } const str = String(val); return str.length > 80 ? str.slice(0, 80) + "..." : str; };
  return (
    <Layout><section className="mx-auto max-w-7xl px-4 py-10"><div className="mb-6 flex items-center gap-3"><Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link><h1 className="text-3xl font-bold">{t("admin.database.title")}</h1><Button variant="ghost" size="icon" onClick={loadTable} aria-label={t("admin.analytics.refresh")}><RefreshCw className="h-4 w-4" /></Button></div>
      <div className="grid gap-6 lg:grid-cols-4"><div className="space-y-1">{TABLES.map(name => <button key={name} onClick={() => setSelectedTable(name)} className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${selectedTable === name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className="flex items-center gap-2"><Database className="h-3 w-3" />{tableLabel(name)}</span><Badge variant={selectedTable === name ? "secondary" : "outline"} className="text-xs">{counts[name] ?? "..."}</Badge></button>)}</div>
      <div className="lg:col-span-3 space-y-4"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder={t("admin.database.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" /><span className="text-sm text-muted-foreground">{t("admin.database.records").replace("{count}", String(total))}</span></div><Card><CardContent className="p-0"><div className="overflow-x-auto">{loading ? <div className="py-12 text-center text-muted-foreground">{t("admin.common.loading")}</div> : <Table><TableHeader><TableRow>{columns.map(col => <TableHead key={col} className="text-xs font-mono">{col}</TableHead>)}</TableRow></TableHeader><TableBody>{filteredRows.length === 0 && <TableRow><TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">{t("admin.database.noData")}</TableCell></TableRow>}{filteredRows.map((row, i) => <TableRow key={i}>{columns.map(col => <TableCell key={col} className="text-xs font-mono max-w-[200px] truncate">{formatCell(col, row[col])}</TableCell>)}</TableRow>)}</TableBody></Table>}</div></CardContent></Card>{totalPages > 1 && <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("admin.database.pageOf").replace("{page}", String(page + 1)).replace("{pages}", String(totalPages))}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}><ChevronLeft className="h-4 w-4" /></Button></div></div>}</div></div></section></Layout>
  );
}
