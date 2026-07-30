import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, FileClock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useReportQueue, useResolveReport, useApplyModerationAction, useAdminActionLog } from "@/features/visionkids/hooks/social/useModeration";

export default function ModerationPanel() {
  const { t } = useLanguage();
  const { isAdmin, loading } = useAdmin();
  const { data: reports = [], isLoading: reportsLoading } = useReportQueue("pending");
  const resolveReport = useResolveReport();
  const applyAction = useApplyModerationAction();
  const { data: actionLog = [] } = useAdminActionLog();

  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");

  useDocumentHead({ title: `${t("kids.social.moderation.title")} — VisionKids`, description: "", canonicalPath: "/kids/social/moderation" });

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.social.moderation.adminOnly")}</p>
        <Link to="/kids/social" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" /> {t("kids.social.moderation.title")}
      </h1>

      <Tabs defaultValue="reports" className="mt-6">
        <TabsList>
          <TabsTrigger value="reports">{t("kids.social.moderation.tabReports")}{reports.length > 0 ? ` (${reports.length})` : ""}</TabsTrigger>
          <TabsTrigger value="accounts">{t("kids.social.moderation.tabAccounts")}</TabsTrigger>
          <TabsTrigger value="log">{t("kids.social.moderation.tabLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          {reportsLoading ? (
            <div className="mt-4 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : reports.length === 0 ? (
            <p className="mt-6 text-center text-muted-foreground">{t("kids.social.moderation.noReports")}</p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {reports.map((r) => (
                <div key={r.id} className="rounded-2xl border-2 border-border bg-card p-4">
                  <p className="text-xs uppercase text-muted-foreground">{r.content_type}</p>
                  <p className="font-semibold">{t(`kids.social.report.reason.${r.reason}`)}</p>
                  {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{r.content_id}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveReport.mutate({ reportId: r.id, status: "dismissed" })}>{t("kids.social.moderation.dismiss")}</Button>
                    <Button size="sm" variant="destructive" onClick={() => resolveReport.mutate({ reportId: r.id, status: "actioned" })}>{t("kids.social.moderation.markActioned")}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts">
          <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4">
            <p className="flex items-center gap-2 font-semibold"><Ban className="h-4 w-4 text-destructive" aria-hidden="true" /> {t("kids.social.moderation.applyAction")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Input value={banUserId} onChange={(e) => setBanUserId(e.target.value)} placeholder={t("kids.social.moderation.userIdPlaceholder")} />
              <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder={t("kids.social.moderation.reasonPlaceholder")} />
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => banUserId && applyAction.mutate({ userId: banUserId, action: "warning", reason: banReason })}
                  disabled={!banUserId || applyAction.isPending}
                >
                  {t("kids.social.moderation.warn")}
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => banUserId && applyAction.mutate({ userId: banUserId, action: "mute", reason: banReason })}
                  disabled={!banUserId || applyAction.isPending}
                >
                  {t("kids.social.moderation.muteGlobal")}
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={() => banUserId && applyAction.mutate({ userId: banUserId, action: "ban", reason: banReason })}
                  disabled={!banUserId || applyAction.isPending}
                >
                  {t("kids.social.moderation.banGlobal")}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="log">
          <div className="mt-4 flex flex-col gap-2">
            {actionLog.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("kids.social.moderation.noLogEntries")}</p>}
            {actionLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                <FileClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.target_type} · {entry.target_id} · {new Date(entry.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
