import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Ban, GraduationCap, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAllApplications, setApplicationStatus,
} from "@/lib/academy/instructorLocalStore";
import type { AcademyInstructorApplicationRow } from "@/lib/types/academy-lms";

const STATUS_LABEL: Record<AcademyInstructorApplicationRow["status"], string> = {
  draft: "مسودة", pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض", suspended: "موقوف",
};
const STATUS_COLOR: Record<AcademyInstructorApplicationRow["status"], string> = {
  draft: "bg-muted text-muted-foreground", pending: "bg-yellow-500", approved: "bg-emerald-600",
  rejected: "bg-red-500", suspended: "bg-red-700",
};
const STATUSES: AcademyInstructorApplicationRow["status"][] = ["pending", "approved", "rejected", "suspended"];

export default function AdminInstructorApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<AcademyInstructorApplicationRow[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteDraftAction, setNoteDraftAction] = useState<"rejected" | "suspended">("rejected");
  const [noteDraft, setNoteDraft] = useState("");

  const load = () => setApplications(listAllApplications().filter((a) => a.status !== "draft"));
  useEffect(() => { load(); }, []);

  const visible = filterStatus === "all" ? applications : applications.filter((a) => a.status === filterStatus);

  const act = (application: AcademyInstructorApplicationRow, status: AcademyInstructorApplicationRow["status"], note: string | null) => {
    if (!user) return;
    setApplicationStatus(application.user_id, status, note, user.id);
    setNoteDraftId(null);
    setNoteDraft("");
    load();
  };

  const openNoteDraft = (applicationId: string, action: "rejected" | "suspended") => {
    setNoteDraftId(applicationId);
    setNoteDraftAction(action);
    setNoteDraft("");
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin" aria-label="العودة إلى لوحة التحكم"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold">طلبات المدرّسين</h1>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATUSES.map((status) => (
            <Card key={status} className="cursor-pointer" onClick={() => setFilterStatus(status)}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{applications.filter((a) => a.status === status).length}</div>
                <div className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الطلبات</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان المهني</TableHead>
                  <TableHead>الخبرة</TableHead>
                  <TableHead>المهارات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ التقديم</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>
                )}
                {visible.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{application.headline}</TableCell>
                    <TableCell>{application.experience_years} سنوات</TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">{application.skills.join("، ") || "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLOR[application.status]}>{STATUS_LABEL[application.status]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {noteDraftId === application.id ? (
                        <div className="space-y-2 w-56">
                          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={noteDraftAction === "rejected" ? "سبب الرفض (اختياري)" : "سبب التعليق (اختياري)"} className="rounded-xl text-xs min-h-16" />
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" onClick={() => act(application, noteDraftAction, noteDraft || null)}>
                              {noteDraftAction === "rejected" ? "تأكيد الرفض" : "تأكيد التعليق"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setNoteDraftId(null)}>إلغاء</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {application.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => act(application, "approved", null)}>
                                <CheckCircle className="me-1 h-3 w-3" aria-hidden="true" />قبول
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => openNoteDraft(application.id, "rejected")}>
                                <XCircle className="me-1 h-3 w-3" aria-hidden="true" />رفض
                              </Button>
                            </>
                          )}
                          {application.status === "approved" && (
                            <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => openNoteDraft(application.id, "suspended")}>
                              <Ban className="me-1 h-3 w-3" aria-hidden="true" />تعليق
                            </Button>
                          )}
                          {(application.status === "rejected" || application.status === "suspended") && (
                            <Button size="sm" variant="ghost" onClick={() => act(application, "pending", null)}>
                              <RotateCcw className="me-1 h-3 w-3" aria-hidden="true" />إعادة فتح
                            </Button>
                          )}
                        </div>
                      )}
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
