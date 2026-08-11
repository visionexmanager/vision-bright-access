import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import {
  useOwnerControl,
  type Approval,
  type Escalation,
  type EscalationState,
} from "@/hooks/useOwnerControl";

const WAITING_STATES: EscalationState[] = ["WAITING_FOR_OWNER", "OWNER_VIEWED"];

/** How long a case has been waiting, in words rather than a coloured dot. */
function waitedFor(iso: string, t: (k: string) => string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return t("owner.waitedMinutes").replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("owner.waitedHours").replace("{n}", String(hours));
  return t("owner.waitedDays").replace("{n}", String(Math.round(hours / 24)));
}

/**
 * Owner Control Centre.
 *
 * Every action here goes through the `owner-control` edge function and the
 * Phase 4 engines. Nothing on this page authorizes anything — it asks, and the
 * database decides. A 409 means somebody else decided first, which is reported
 * as information rather than as a failure to retry.
 *
 * Built to be operated without sight: real tables with column headers, state
 * as words, dialogs replaced by inline expandable regions with managed focus,
 * and every change announced through a live region.
 */
export default function OwnerControlCenter() {
  const { t, dir } = useLanguage();
  const control = useOwnerControl();
  const [openEscalation, setOpenEscalation] = useState<string | null>(null);
  const [openApproval, setOpenApproval] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const detailRef = useRef<HTMLHeadingElement>(null);

  const waiting = useMemo(
    () => control.escalations.filter((e) => WAITING_STATES.includes(e.state)),
    [control.escalations],
  );
  const pending = useMemo(
    () => control.approvals.filter((a) => a.state === "WAITING_FOR_APPROVAL"),
    [control.approvals],
  );
  const humanControlled = useMemo(
    () => control.conversations.filter((c) => c.control === "human"),
    [control.conversations],
  );
  const failed = useMemo(
    () => control.approvals.filter((a) => a.state === "FAILED")
      .concat(control.escalations.filter((e) => e.state === "FAILED") as unknown as Approval[]),
    [control.approvals, control.escalations],
  );

  const announce = (message: string) => {
    setAnnouncement(message);
    toast({ title: message });
  };

  const focusDetail = () => requestAnimationFrame(() => detailRef.current?.focus());

  const handleDecision = async (approval: Approval, approve: boolean) => {
    const result = await control.decideApproval(approval.reference, approve, note || undefined);
    if (result.ok) {
      announce(t(approve ? "owner.approved" : "owner.rejected").replace("{ref}", approval.reference));
      setOpenApproval(null);
      setNote("");
    } else {
      // Concurrency: another session decided first. Not an error to retry.
      announce(t("owner.alreadyDecided").replace("{ref}", approval.reference));
    }
  };

  const handleTransition = async (escalation: Escalation, next: EscalationState) => {
    const result = await control.transitionEscalation(escalation.id, next, note || undefined);
    announce(result.ok
      ? t("owner.escalationMoved").replace("{state}", t(`owner.state.${next}`))
      : t("owner.transitionRefused"));
    if (result.ok) setNote("");
  };

  const openEscalationDetail = async (escalation: Escalation) => {
    setOpenEscalation(escalation.id === openEscalation ? null : escalation.id);
    if (escalation.state === "WAITING_FOR_OWNER") await control.markViewed(escalation.id);
    focusDetail();
  };

  const escalationDetail = control.escalations.find((e) => e.id === openEscalation);
  const approvalDetail = control.approvals.find((a) => a.id === openApproval);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10" dir={dir} aria-labelledby="owner-control-heading">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin" aria-label={t("nav.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <h1 id="owner-control-heading" className="text-3xl font-bold">{t("owner.title")}</h1>
        </div>

        {/* Every change is announced, whether it came from a button here or a
            refresh. aria-atomic so the sentence is read whole. */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>

        {/* Status is a word, never a coloured pill on its own. */}
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span><strong>{t("owner.whatsappStatus")}:</strong>{" "}{t(`owner.wa.${control.whatsappStatus}`)}</span>
            <span><strong>{t("owner.waitingCount")}:</strong> {waiting.length}</span>
            <span><strong>{t("owner.pendingCount")}:</strong> {pending.length}</span>
            <span><strong>{t("owner.humanControlledCount")}:</strong> {humanControlled.length}</span>
            <Button variant="outline" size="sm" onClick={() => void control.reload()}>{t("owner.refresh")}</Button>
          </CardContent>
        </Card>

        {control.loading && <p role="status">{t("owner.loading")}</p>}
        {control.error && <p role="alert" className="text-destructive">{control.error}</p>}

        {/* ── Escalations ─────────────────────────────────────────────── */}
        <section aria-labelledby="owner-escalations-heading" className="mb-8">
          <h2 id="owner-escalations-heading" className="mb-3 text-xl font-bold">
            {t("owner.escalations")} ({waiting.length})
          </h2>
          {waiting.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("owner.noEscalations")}</p>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <caption className="sr-only">{t("owner.escalationsCaption")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("owner.customer")}</TableHead>
                    <TableHead scope="col">{t("owner.channel")}</TableHead>
                    <TableHead scope="col">{t("owner.reason")}</TableHead>
                    <TableHead scope="col">{t("owner.waiting")}</TableHead>
                    <TableHead scope="col">{t("owner.status")}</TableHead>
                    <TableHead scope="col">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waiting.map((escalation) => (
                    <TableRow key={escalation.id}>
                      <TableCell className="font-medium">{escalation.customer_name ?? escalation.customer_ref ?? "—"}</TableCell>
                      <TableCell>{escalation.channel}</TableCell>
                      <TableCell>{t(`owner.reason.${escalation.reason}`)}</TableCell>
                      <TableCell>{waitedFor(escalation.created_at, t)}</TableCell>
                      <TableCell>{t(`owner.state.${escalation.state}`)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => void openEscalationDetail(escalation)}
                          aria-expanded={openEscalation === escalation.id}
                          aria-controls="owner-escalation-detail"
                        >
                          {t("owner.open")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}

          {escalationDetail && (
            <Card id="owner-escalation-detail" className="mt-3">
              <CardContent className="p-4">
                <h3 ref={detailRef} tabIndex={-1} className="mb-2 font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {t("owner.caseDetail")}
                </h3>
                <dl className="grid gap-2 text-sm">
                  <div><dt className="inline font-medium">{t("owner.request")}: </dt><dd className="inline">{escalationDetail.customer_request}</dd></div>
                  {escalationDetail.ai_summary && (
                    <div><dt className="inline font-medium">{t("owner.aiSummary")}: </dt><dd className="inline">{escalationDetail.ai_summary}</dd></div>
                  )}
                  {escalationDetail.suggested_action && (
                    <div><dt className="inline font-medium">{t("owner.suggestedAction")}: </dt><dd className="inline">{escalationDetail.suggested_action}</dd></div>
                  )}
                  {escalationDetail.subject_type && (
                    <div><dt className="inline font-medium">{t("owner.subject")}: </dt><dd className="inline">{escalationDetail.subject_type} {escalationDetail.subject_id}</dd></div>
                  )}
                </dl>

                <div className="mt-3">
                  <label htmlFor="owner-note" className="text-sm font-medium">{t("owner.note")}</label>
                  <Textarea id="owner-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleTransition(escalationDetail, "OWNER_RESPONDED")}>{t("owner.takeOver")}</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleTransition(escalationDetail, "RETURNED_TO_AI")}>{t("owner.returnToAi")}</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleTransition(escalationDetail, "RESOLVED")}>{t("owner.resolve")}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Approvals ───────────────────────────────────────────────── */}
        <section aria-labelledby="owner-approvals-heading" className="mb-8">
          <h2 id="owner-approvals-heading" className="mb-3 text-xl font-bold">
            {t("owner.approvals")} ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("owner.noApprovals")}</p>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <caption className="sr-only">{t("owner.approvalsCaption")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("owner.reference")}</TableHead>
                    <TableHead scope="col">{t("owner.actionType")}</TableHead>
                    <TableHead scope="col">{t("owner.whatAiWants")}</TableHead>
                    <TableHead scope="col">{t("owner.waiting")}</TableHead>
                    <TableHead scope="col">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell className="font-mono">{approval.reference}</TableCell>
                      <TableCell>{t(`owner.action.${approval.action_type}`)}</TableCell>
                      <TableCell>{approval.title}</TableCell>
                      <TableCell>{waitedFor(approval.created_at, t)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setOpenApproval(approval.id === openApproval ? null : approval.id); focusDetail(); }}
                          aria-expanded={openApproval === approval.id}
                          aria-controls="owner-approval-detail"
                        >
                          {t("owner.review")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}

          {approvalDetail && (
            <Card id="owner-approval-detail" className="mt-3">
              <CardContent className="p-4">
                <h3 ref={detailRef} tabIndex={-1} className="mb-1 font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {t("owner.aiProposes")}
                </h3>
                {/* The framing is deliberate: the AI proposes, the human
                    authorizes. It must not read as the system announcing a
                    decision already taken. */}
                <p className="mb-3 text-xs text-muted-foreground">{t("owner.youAuthorize")}</p>

                <dl className="grid gap-2 text-sm">
                  <div><dt className="inline font-medium">{t("owner.whatAiWants")}: </dt><dd className="inline">{approvalDetail.title}</dd></div>
                  {approvalDetail.summary && (
                    <div><dt className="inline font-medium">{t("owner.why")}: </dt><dd className="inline">{approvalDetail.summary}</dd></div>
                  )}
                  <div><dt className="inline font-medium">{t("owner.reference")}: </dt><dd className="inline font-mono">{approvalDetail.reference}</dd></div>
                  <div><dt className="inline font-medium">{t("owner.expires")}: </dt><dd className="inline">{new Date(approvalDetail.expires_at).toLocaleString()}</dd></div>
                </dl>

                {/* Internal sourcing detail — supplier, source price, margin.
                    Admin-only by RLS and deliberately absent from anything a
                    customer sees. */}
                {Object.keys(approvalDetail.payload ?? {}).length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">{t("owner.internalDetail")}</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs" tabIndex={0}>
                      {JSON.stringify(approvalDetail.payload, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="mt-3">
                  <label htmlFor="owner-approval-note" className="text-sm font-medium">{t("owner.note")}</label>
                  <Textarea id="owner-approval-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleDecision(approvalDetail, true)}>{t("owner.approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleDecision(approvalDetail, false)}>{t("owner.reject")}</Button>
                  <Button size="sm" variant="outline" onClick={() => announce(t("owner.moreInfoRequested"))}>{t("owner.requestMoreInfo")}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Human-controlled conversations ──────────────────────────── */}
        <section aria-labelledby="owner-control-state-heading" className="mb-8">
          <h2 id="owner-control-state-heading" className="mb-3 text-xl font-bold">{t("owner.conversations")}</h2>
          {control.conversations.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("owner.noConversations")}</p>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <caption className="sr-only">{t("owner.conversationsCaption")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("owner.conversation")}</TableHead>
                    <TableHead scope="col">{t("owner.controlState")}</TableHead>
                    <TableHead scope="col">{t("owner.lastMessage")}</TableHead>
                    <TableHead scope="col">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {control.conversations.map((conversation) => (
                    <TableRow key={conversation.id}>
                      {/* Never render a full phone number in a list a browser
                          may cache or a screen may be shared from. */}
                      <TableCell className="font-mono">•••{conversation.wa_phone.slice(-4)}</TableCell>
                      <TableCell>
                        {t(conversation.control === "human" ? "owner.humanControlled" : "owner.aiControlled")}
                      </TableCell>
                      <TableCell>{new Date(conversation.last_message_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline"
                          onClick={async () => {
                            const next = conversation.control === "human" ? "ai" : "human";
                            const result = await control.setConversationControl(conversation.wa_phone, next);
                            announce(result.ok
                              ? t(next === "human" ? "owner.nowHumanControlled" : "owner.aiResumed")
                              : t("owner.transitionRefused"));
                          }}
                        >
                          {t(conversation.control === "human" ? "owner.returnToAi" : "owner.takeOver")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </section>

        {/* ── Agent activity ──────────────────────────────────────────── */}
        <section aria-labelledby="owner-activity-heading" className="mb-8">
          <h2 id="owner-activity-heading" className="mb-3 text-xl font-bold">{t("owner.activity")}</h2>
          <Card><CardContent className="p-0">
            <Table>
              <caption className="sr-only">{t("owner.activityCaption")}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("owner.when")}</TableHead>
                  <TableHead scope="col">{t("owner.whatHappened")}</TableHead>
                  <TableHead scope="col">{t("owner.relatedTo")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.activity.slice(0, 25).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.entity_type ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </section>

        {/* ── Feedback ────────────────────────────────────────────────── */}
        <section aria-labelledby="owner-feedback-heading">
          <h2 id="owner-feedback-heading" className="mb-3 text-xl font-bold">{t("owner.feedback")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("owner.feedbackNote")}</p>
          <Card><CardContent className="p-0">
            <Table>
              <caption className="sr-only">{t("owner.feedbackCaption")}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("owner.when")}</TableHead>
                  <TableHead scope="col">{t("owner.event")}</TableHead>
                  <TableHead scope="col">{t("owner.summary")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.feedback.slice(0, 25).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                    <TableCell>{t(`owner.feedbackType.${event.event_type}`)}</TableCell>
                    <TableCell>{event.summary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
          {failed.length > 0 && (
            <p role="status" className="mt-3 text-sm">
              {t("owner.failedCount").replace("{n}", String(failed.length))}
            </p>
          )}
        </section>
      </section>
    </Layout>
  );
}
