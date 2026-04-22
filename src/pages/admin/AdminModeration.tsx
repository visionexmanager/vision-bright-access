import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, CheckCircle, XCircle, Eye, Flag } from "lucide-react";
import { Link } from "react-router-dom";

type Report = {
  id: string;
  reporter_id: string | null;
  content_type: string;
  content_id: string;
  reason: string;
  details: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  reviewed: "bg-blue-500",
  actioned: "bg-green-600",
  dismissed: "bg-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  reviewed: "تمت المراجعة",
  actioned: "تم الإجراء",
  dismissed: "مرفوض",
};

export default function AdminModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = async () => {
    let query = supabase.from("content_reports").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    const { data } = await query;
    setReports(data ?? []);
  };

  useEffect(() => { load(); }, [filterStatus]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("content_reports").update({
      status,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الحالة"); load(); }
  };

  const pending = reports.filter(r => r.status === "pending").length;

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">إشراف المحتوى</h1>
          {pending > 0 && <Badge className="bg-yellow-500">{pending} بانتظار المراجعة</Badge>}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Card key={key} className="cursor-pointer" onClick={() => setFilterStatus(key)}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{reports.filter(r => r.status === key).length}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البلاغات</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="reviewed">تمت المراجعة</SelectItem>
              <SelectItem value="actioned">تم الإجراء</SelectItem>
              <SelectItem value="dismissed">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نوع المحتوى</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>التفاصيل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ البلاغ</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      لا توجد بلاغات
                    </TableCell>
                  </TableRow>
                )}
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline">{r.content_type}</Badge>
                      <div className="text-xs text-muted-foreground mt-1 truncate max-w-[100px]">{r.content_id}</div>
                    </TableCell>
                    <TableCell className="font-medium">{r.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.details || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="text-green-600 border-green-600"
                              onClick={() => updateStatus(r.id, "actioned")}>
                              <CheckCircle className="me-1 h-3 w-3" /> إجراء
                            </Button>
                            <Button size="sm" variant="outline" className="text-gray-600"
                              onClick={() => updateStatus(r.id, "dismissed")}>
                              <XCircle className="me-1 h-3 w-3" /> رفض
                            </Button>
                          </>
                        )}
                        {r.status !== "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "pending")}>
                            إعادة فتح
                          </Button>
                        )}
                      </div>
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
