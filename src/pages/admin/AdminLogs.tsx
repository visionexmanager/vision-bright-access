import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/contexts/LanguageContext";

const PAGE_SIZE = 50;
type Log = { id: string; admin_id: string; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string; };
const ACTION_COLORS: Record<string, string> = { ban_user: "bg-red-600", suspend_user: "bg-orange-500", unban_user: "bg-green-600", grant_points: "bg-yellow-500", toggle_feature: "bg-purple-600", send_newsletter: "bg-blue-600", send_email: "bg-blue-500" };
const ACTION_KEYS = ["ban_user", "suspend_user", "unban_user", "grant_points", "toggle_feature", "send_newsletter", "send_email"];

export default function AdminLogs() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [filterAction, setFilterAction] = useState("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const actionLabel = (action: string) => t(`admin.logs.action.${action}`);

  const load = async (p = page) => {
    setLoading(true);
    let query = supabase.from("admin_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
    if (filterAction !== "all") query = query.eq("action", filterAction);
    const { data, count } = await query;
    setLogs((data as unknown as Log[]) ?? []);
    setTotal(count || 0);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); load(0); }, [filterAction]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page]);

  const filtered = debouncedSearch ? logs.filter(l => l.action.includes(debouncedSearch) || l.target_id?.includes(debouncedSearch) || JSON.stringify(l.details || {}).includes(debouncedSearch)) : logs;

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <h1 className="text-3xl font-bold">{t("admin.logs.title")}</h1>
          <Button variant="ghost" size="icon" onClick={() => load()} aria-label={t("admin.analytics.refresh")}><RefreshCw className="h-4 w-4" /></Button>
          <Badge variant="secondary">{t("admin.logs.total").replace("{count}", String(total))}</Badge>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder={t("admin.logs.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="w-48" /></div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("admin.logs.filterPlaceholder")} /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t("admin.logs.allActions")}</SelectItem>{ACTION_KEYS.map((key) => <SelectItem key={key} value={key}>{actionLabel(key)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{t("admin.logs.action")}</TableHead><TableHead>{t("admin.logs.target")}</TableHead><TableHead>{t("admin.logs.details")}</TableHead><TableHead>{t("admin.logs.admin")}</TableHead><TableHead>{t("admin.requests.date")}</TableHead></TableRow></TableHeader><TableBody>
          {loading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("admin.common.loading")}</TableCell></TableRow>}
          {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("admin.logs.none")}</TableCell></TableRow>}
          {filtered.map((log) => <TableRow key={log.id}><TableCell><Badge className={ACTION_COLORS[log.action] || "bg-gray-500"}>{ACTION_KEYS.includes(log.action) ? actionLabel(log.action) : log.action}</Badge></TableCell><TableCell>{log.target_type && <Badge variant="outline" className="text-xs me-1">{log.target_type}</Badge>}<span className="text-xs text-muted-foreground truncate max-w-[120px] block">{log.target_id || "-"}</span></TableCell><TableCell className="text-xs text-muted-foreground max-w-[200px]">{log.details ? JSON.stringify(log.details).slice(0, 100) : "-"}</TableCell><TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{log.admin_id.slice(0, 8)}...</TableCell><TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell></TableRow>)}
        </TableBody></Table></CardContent></Card>
        {total > PAGE_SIZE && <div className="flex items-center justify-between mt-4"><span className="text-sm text-muted-foreground">{t("admin.logs.pagination").replace("{page}", String(page + 1)).replace("{pages}", String(Math.ceil(total / PAGE_SIZE))).replace("{total}", String(total))}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) - 1}><ChevronLeft className="h-4 w-4" /></Button></div></div>}
      </section>
    </Layout>
  );
}
