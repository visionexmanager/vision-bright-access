import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Loader2, Sparkles, Copy, Plus, X, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationAnalytics } from "@/hooks/library/useOrganizationAnalytics";
import { useOrganizationAiAdmin } from "@/hooks/library/useOrganizationAiAdmin";
import { useOrganizationScheduledReports } from "@/hooks/library/useOrganizationScheduledReports";
import { downloadOrganizationReport, ORGANIZATION_REPORT_FORMATS, type OrganizationReportFormat } from "@/lib/library/organizationReports";
import type { OrganizationReportCadence } from "@/services/library/organizationScheduledReports";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

export default function LibraryOrganizationAnalytics() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.analytics") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <AnalyticsBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function AnalyticsBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const organization = ctx.organization!;
  const orgId = organization.id;
  const { departmentActivity, memberEngagement, trainingCompletion, isLoading } = useOrganizationAnalytics(orgId);
  const { isLoading: isAiLoading, duplicates, recommendations, runDuplicateDetection, runContentRecommendations } = useOrganizationAiAdmin(orgId);
  const { scheduledReports, create: createScheduledReport, remove: removeScheduledReport, toggle: toggleScheduledReport } = useOrganizationScheduledReports(orgId);

  const [exportFormat, setExportFormat] = useState<OrganizationReportFormat>("pdf");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [cadence, setCadence] = useState<OrganizationReportCadence>("weekly");
  const [recipientsText, setRecipientsText] = useState("");

  const handleExport = () => {
    downloadOrganizationReport({
      organizationName: organization.name,
      reportTitle: t("library.enterprise.analytics.reportTitle"),
      generatedAt: new Date().toLocaleString(),
      tables: [
        {
          title: t("library.enterprise.analytics.departmentActivity"),
          columns: ["Department", "Members", "Reading Minutes"],
          rows: departmentActivity.map((d) => [d.department_name, d.member_count, d.total_reading_minutes]),
        },
        {
          title: t("library.enterprise.analytics.trainingCompletion"),
          columns: ["Assignment", "Assigned", "Completed"],
          rows: trainingCompletion.map((tr) => [tr.title, tr.assigned_count, tr.completed_count]),
        },
      ],
    }, exportFormat);
  };

  if (!ctx.isAdmin) {
    return <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.enterprise.permissions.adminOnly")} className="py-12" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("library.enterprise.analytics.title")}</h2>
        <div className="flex items-center gap-2">
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as OrganizationReportFormat)}>
            <SelectTrigger className="w-28" aria-label={t("library.enterprise.analytics.exportFormat")}><SelectValue /></SelectTrigger>
            <SelectContent>{ORGANIZATION_REPORT_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.analytics.export")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-sm font-medium">{t("library.enterprise.analytics.departmentActivity")}</h3>
            {departmentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("library.enterprise.dashboard.noData")}</p>
            ) : (
              <div className="space-y-2">
                {departmentActivity.map((d) => (
                  <Card key={d.department_id} className="p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{d.department_name}</span>
                      <span className="text-xs text-muted-foreground">{d.member_count} members, {d.total_reading_minutes} min</span>
                    </div>
                    <Progress value={Math.min((d.total_reading_minutes / 1000) * 100, 100)} className="h-1.5" />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">{t("library.enterprise.analytics.trainingCompletion")}</h3>
            {trainingCompletion.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("library.enterprise.dashboard.noData")}</p>
            ) : (
              <div className="space-y-2">
                {trainingCompletion.map((tr) => (
                  <Card key={tr.assignment_id} className="p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{tr.title}</span>
                      <span className="text-xs text-muted-foreground">{tr.completed_count}/{tr.assigned_count}</span>
                    </div>
                    <Progress value={tr.assigned_count > 0 ? (tr.completed_count / tr.assigned_count) * 100 : 0} className="h-1.5" />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">{t("library.enterprise.analytics.memberEngagement")}</h3>
            {memberEngagement.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("library.enterprise.dashboard.noData")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {memberEngagement.slice(0, 12).map((m) => (
                  <Card key={m.user_id} className="p-3 text-sm">
                    <p className="mb-1 font-medium">{m.display_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{t("library.enterprise.analytics.booksCompleted").replace("{count}", String(m.books_completed))}</p>
                    <p className="text-xs text-muted-foreground">{t("library.enterprise.analytics.assignmentsCompleted").replace("{count}", String(m.assignments_completed))}</p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.analytics.aiFeatures")}</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={isAiLoading} onClick={() => void runDuplicateDetection()}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.analytics.detectDuplicates")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={isAiLoading} onClick={() => void runContentRecommendations()}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.analytics.contentRecommendations")}
          </Button>
        </div>
        {duplicates && (
          <Card className="p-3">
            {duplicates.duplicate_groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("library.enterprise.analytics.noDuplicates")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {duplicates.duplicate_groups.map((group, i) => (
                  <li key={i}>{group.map((r) => r.title).join(" ≈ ")}</li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {recommendations && (
          <Card className="space-y-2 p-3">
            <p className="text-sm">{recommendations.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {recommendations.suggested_topics.map((topic, i) => <Badge key={i} variant="secondary">{topic}</Badge>)}
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium"><Mail className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.analytics.scheduledReports")}</h3>
          <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.analytics.newSchedule")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.analytics.newSchedule")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="report-name">{t("library.enterprise.analytics.reportName")}</Label>
                  <Input id="report-name" value={reportName} onChange={(e) => setReportName(e.target.value)} />
                </div>
                <div>
                  <Label>{t("library.enterprise.analytics.cadence")}</Label>
                  <Select value={cadence} onValueChange={(v) => setCadence(v as OrganizationReportCadence)}>
                    <SelectTrigger aria-label={t("library.enterprise.analytics.cadence")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">{t("library.enterprise.analytics.weekly")}</SelectItem>
                      <SelectItem value="monthly">{t("library.enterprise.analytics.monthly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recipients">{t("library.enterprise.analytics.recipients")}</Label>
                  <Input id="recipients" value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} placeholder="admin@org.com, dean@org.com" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!reportName.trim() || !recipientsText.trim()}
                  onClick={async () => {
                    const emails = recipientsText.split(",").map((e) => e.trim()).filter(Boolean);
                    await createScheduledReport(reportName.trim(), cadence, emails);
                    setIsScheduleOpen(false); setReportName(""); setRecipientsText("");
                  }}
                >
                  {t("library.enterprise.analytics.newSchedule")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {scheduledReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("library.enterprise.analytics.noScheduledReports")}</p>
        ) : (
          <div className="space-y-2">
            {scheduledReports.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium">{r.report_name}</p>
                  <p className="text-xs text-muted-foreground">{t(`library.enterprise.analytics.${r.cadence}`)} — {r.recipient_emails.join(", ")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void toggleScheduledReport(r.id, !r.is_active)}>
                    {r.is_active ? t("library.enterprise.analytics.pause") : t("library.enterprise.analytics.resume")}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void removeScheduledReport(r.id)} aria-label={t("library.reviews.delete")}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
