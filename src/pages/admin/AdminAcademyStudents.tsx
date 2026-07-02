import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Users, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAcademyLevelInfo } from "@/lib/academy/leveling";

type StudentRow = {
  user_id: string; name: string; country: string; level: string;
  xp_total: number; streak_days: number; last_active: string; created_at: string;
};

const PAGE_SIZE = 25;

/** Neutralizes CSV/formula injection (OWASP): a self-entered name/country starting with =, +, -, or @ would otherwise execute as a formula when the admin opens this file in Excel/Sheets. */
function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv(rows: StudentRow[]) {
  const header = ["user_id", "name", "country", "level", "xp_total", "streak_days", "last_active", "created_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((k) => csvCell((r as any)[k])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `academy-students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAcademyStudents() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sort, setSort] = useState<"xp_desc" | "recent" | "name">("xp_desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const { data } = await (supabase.from("academy_profiles") as any)
        .select("user_id, name, country, level, xp_total, streak_days, last_active, created_at")
        .order("xp_total", { ascending: false })
        .limit(2000);
      if (data) setRows(data as StudentRow[]);
      setIsLoading(false);
    };
    load();
  }, []);

  const levels = useMemo(() => Array.from(new Set(rows.map((r) => r.level))).filter(Boolean), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.country.toLowerCase().includes(q));
    }
    if (levelFilter !== "all") list = list.filter((r) => r.level === levelFilter);

    list = [...list];
    if (sort === "xp_desc") list.sort((a, b) => b.xp_total - a.xp_total);
    else if (sort === "recent") list.sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [rows, query, levelFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/academy" aria-label="العودة إلى إدارة الأكاديمية"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">طلاب الأكاديمية</h1>
            <p className="text-muted-foreground text-sm">{rows.length.toLocaleString()} طالب مسجّل — بيانات حقيقية من Supabase</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" aria-hidden="true" />
            تصدير CSV
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="ابحث بالاسم أو البلد..." className="ps-9 rounded-xl" aria-label="بحث عن طالب" />
          </div>
          <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستويات</SelectItem>
              {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xp_desc">الأعلى XP</SelectItem>
              <SelectItem value="recent">الأحدث نشاطاً</SelectItem>
              <SelectItem value="name">الاسم (أبجدي)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لا يوجد طلاب مطابقون.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البلد</TableHead>
                    <TableHead>المستوى الدراسي</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>مستوى الأكاديمية</TableHead>
                    <TableHead>آخر نشاط</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const levelInfo = getAcademyLevelInfo(r.xp_total);
                    return (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{r.name || "بدون اسم"}</TableCell>
                        <TableCell>{r.country || "—"}</TableCell>
                        <TableCell>{r.level || "—"}</TableCell>
                        <TableCell>{r.xp_total.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="secondary">{levelInfo.level} — {levelInfo.rank.rank}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.last_active).toLocaleDateString("ar")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">صفحة {page} من {pageCount} — {filtered.length} نتيجة</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                  <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>التالي</Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
