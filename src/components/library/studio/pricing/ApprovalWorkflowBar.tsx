import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import type { LibraryPublishStatus } from "@/lib/types/library-studio";

interface ApprovalWorkflowBarProps {
  status: LibraryPublishStatus;
  reviewNote: string | null;
  onTransition: (status: LibraryPublishStatus, opts?: { reviewNote?: string; scheduledPublishAt?: string }) => Promise<void>;
}

const STATUS_VARIANT: Record<LibraryPublishStatus, "default" | "outline" | "secondary" | "destructive"> = {
  draft: "outline",
  review: "secondary",
  approved: "secondary",
  published: "default",
  scheduled: "secondary",
  archived: "outline",
  rejected: "destructive",
};

/**
 * Draft → Review → Approved → Published/Scheduled, or → Rejected/Archived.
 * The buttons shown here are just the affordance — the actual authorization
 * (only the owner or an owner-role collaborator may approve/publish/reject/
 * archive) is enforced server-side by guard_library_publish_status_
 * transition(), so a narrower-role collaborator clicking one of these will
 * get a clear error toast rather than silently succeeding.
 */
export function ApprovalWorkflowBar({ status, reviewNote, onTransition }: ApprovalWorkflowBarProps) {
  const { t } = useLanguage();
  const [scheduleDate, setScheduleDate] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const transition = async (next: LibraryPublishStatus, opts?: { reviewNote?: string; scheduledPublishAt?: string }) => {
    setIsBusy(true);
    try {
      await onTransition(next, opts);
      toast({ title: t(`library.studio.workflow.${next}`) });
    } catch (err) {
      toast({ title: t("library.studio.workflow.transitionFailed"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <Badge variant={STATUS_VARIANT[status]}>{t(`library.studio.workflow.${status}`)}</Badge>
      {status === "rejected" && reviewNote && <span className="text-xs text-muted-foreground">{reviewNote}</span>}

      <div className="ms-auto flex flex-wrap gap-2">
        {status === "draft" && (
          <Button size="sm" disabled={isBusy} onClick={() => void transition("review")}>{t("library.studio.workflow.action.submitForReview")}</Button>
        )}
        {status === "review" && (
          <>
            <Button size="sm" disabled={isBusy} onClick={() => void transition("approved")}>{t("library.studio.workflow.action.approve")}</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={isBusy}>{t("library.studio.workflow.action.reject")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.studio.workflow.action.reject")}</DialogTitle></DialogHeader>
                <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t("library.studio.workflow.rejectNotePlaceholder")} rows={3} />
                <DialogFooter>
                  <Button variant="destructive" onClick={() => void transition("rejected", { reviewNote: rejectNote })}>{t("library.studio.workflow.action.reject")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {status === "approved" && (
          <>
            <Button size="sm" disabled={isBusy} onClick={() => void transition("published")}>{t("library.studio.workflow.action.publishNow")}</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isBusy}>{t("library.studio.workflow.action.schedule")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.studio.workflow.action.schedule")}</DialogTitle></DialogHeader>
                <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                <DialogFooter>
                  <Button disabled={!scheduleDate} onClick={() => void transition("scheduled", { scheduledPublishAt: new Date(scheduleDate).toISOString() })}>{t("library.studio.workflow.action.confirmSchedule")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {status === "published" && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void transition("archived")}>{t("library.studio.workflow.action.archive")}</Button>
        )}
        {(status === "rejected" || status === "archived") && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void transition("draft")}>{t("library.studio.workflow.action.backToDraft")}</Button>
        )}
      </div>
    </div>
  );
}
