import { useState } from "react";
import { ShieldCheck, BookOpen, Users2, Headphones, Quote, Flag } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/library/EmptyState";
import { useBookCatalog } from "@/hooks/library/useBookCatalog";
import { useAuthors } from "@/hooks/library/useAuthors";
import { useAudiobooks } from "@/hooks/library/useAudiobooks";
import { useAuditLogs, useBackgroundJobs } from "@/hooks/library/useAuditLog";
import { useModerationDashboard } from "@/hooks/library/useModeration";
import { resolveContentAuthor } from "@/services/library/moderation";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryModerationAction } from "@/services/library/moderation";

const JOB_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

export default function LibraryAdmin() {
  const { t } = useLanguage();
  const { books } = useBookCatalog();
  const { authors } = useAuthors();
  const { audiobooks } = useAudiobooks();
  const { logs, isLoading: logsLoading } = useAuditLogs();
  const { jobs, isLoading: jobsLoading } = useBackgroundJobs();
  const { reports, isLoading: reportsLoading, resolve, takeAction } = useModerationDashboard();
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<LibraryModerationAction>("warning");
  const [actionReason, setActionReason] = useState("");

  const stats = [
    { label: t("library.nav.categories"), value: books.length, icon: BookOpen },
    { label: t("library.nav.authors"), value: authors.length, icon: Users2 },
    { label: t("library.nav.audiobooks"), value: audiobooks.length, icon: Headphones },
    { label: t("library.nav.quotes"), value: 0, icon: Quote },
  ];

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.admin")} breadcrumb={[{ label: t("library.nav.admin") }]}>
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p>{t("library.admin.phase1Notice")}</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t("library.admin.tab.overview")}</TabsTrigger>
            <TabsTrigger value="auditLog">{t("library.admin.tab.auditLog")}</TabsTrigger>
            <TabsTrigger value="backgroundJobs">{t("library.admin.tab.backgroundJobs")}</TabsTrigger>
            <TabsTrigger value="reports">{t("library.admin.tab.reports")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="auditLog">
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("library.admin.auditLog.action")}</TableHead>
                    <TableHead>{t("library.admin.auditLog.entity")}</TableHead>
                    <TableHead>{t("library.admin.auditLog.when")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!logsLoading && logs.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("library.admin.auditLog.empty")}</TableCell></TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell className="text-muted-foreground">{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="backgroundJobs">
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("library.admin.jobs.type")}</TableHead>
                    <TableHead>{t("library.admin.jobs.status")}</TableHead>
                    <TableHead>{t("library.admin.jobs.attempts")}</TableHead>
                    <TableHead>{t("library.admin.jobs.when")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!jobsLoading && jobs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("library.admin.jobs.empty")}</TableCell></TableRow>
                  )}
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.job_type}</TableCell>
                      <TableCell><Badge variant={JOB_STATUS_VARIANT[job.status] ?? "outline"}>{job.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{job.attempts}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(job.updated_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            {!reportsLoading && reports.length === 0 ? (
              <EmptyState icon={<Flag className="h-8 w-8" />} title={t("library.admin.reports.empty")} className="py-8" />
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <Card key={report.id} className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{report.content_type} · {report.reason}</p>
                        {report.details && <p className="mt-0.5 text-sm text-muted-foreground">{report.details}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Dialog open={actionUserId === report.id} onOpenChange={(open) => { if (!open) setActionUserId(null); }}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const authorId = await resolveContentAuthor(report.content_type, report.content_id);
                                if (!authorId) {
                                  toast({ title: "Couldn't identify a user to act against for this content type", variant: "destructive" });
                                  return;
                                }
                                setActionUserId(report.id);
                                setActionReason(report.reason);
                              }}
                            >
                              {t("library.admin.reports.takeAction")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{t("library.admin.reports.takeAction")}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <Select value={actionType} onValueChange={(v) => setActionType(v as LibraryModerationAction)}>
                                <SelectTrigger aria-label={t("library.admin.reports.actionTypeLabel")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="warning">{t("library.admin.reports.warning")}</SelectItem>
                                  <SelectItem value="mute">{t("library.admin.reports.mute")}</SelectItem>
                                  <SelectItem value="ban">{t("library.admin.reports.ban")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={2} />
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={async () => {
                                  const authorId = await resolveContentAuthor(report.content_type, report.content_id);
                                  if (authorId) {
                                    await takeAction(authorId, actionType, actionReason, null);
                                    await resolve(report.id, "actioned");
                                  }
                                  setActionUserId(null);
                                }}
                              >
                                {t("library.common.save")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="ghost" onClick={() => void resolve(report.id, "dismissed")}>{t("library.admin.reports.dismiss")}</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </LibraryLayout>
    </Layout>
  );
}
