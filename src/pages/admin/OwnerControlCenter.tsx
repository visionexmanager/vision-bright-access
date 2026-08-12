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
  CONTENT_APPROVAL_TYPE,
  type Approval,
  type ContentProposal,
  type Escalation,
  type EscalationState,
} from "@/hooks/useOwnerControl";

const WAITING_STATES: EscalationState[] = ["WAITING_FOR_OWNER", "OWNER_VIEWED"];

/**
 * Proposals the owner can still act on.
 *
 * Includes APPROVED, because an approved proposal still needs scheduling —
 * dropping it the moment it is approved would leave the schedule step with no
 * way to reach it. The section heading counts this same list, so the number
 * announced always matches the rows a screen-reader user can then tab through.
 */
const ACTIONABLE_PROPOSAL_STATES = ["PROPOSED", "EDITED", "APPROVED"];

/**
 * The eleven indexed sections, and nothing else.
 *
 * Mirrors CONTENT_SECTIONS in the generator registry. A section that
 * embed-content does not index cannot be discovered, so offering one in this
 * dropdown would only produce a refusal from the engine.
 */
const SECTIONS = [
  "products", "content_items", "academy_courses", "kids_games", "simulations",
  "tv_channels", "radio_stations", "communities", "events", "jobs", "services",
] as const;

const CONTENT_TYPES = ["post", "short_video", "reel", "story", "article", "carousel"] as const;

/** Suggestion targets. Phase 7 dispatches to none of them. */
const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "website", "newsletter"] as const;

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

  // ── Phase 7 content proposals ──────────────────────────────────────────
  const [openProposal, setOpenProposal] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genSection, setGenSection] = useState<string>("products");
  const [genType, setGenType] = useState<string>("post");
  const [genPlatform, setGenPlatform] = useState<string>("website");
  const [genLanguage, setGenLanguage] = useState<"en" | "ar">("en");
  const [editHook, setEditHook] = useState("");
  const [editBody, setEditBody] = useState("");
  const proposalDetailRef = useRef<HTMLHeadingElement>(null);

  const waiting = useMemo(
    () => control.escalations.filter((e) => WAITING_STATES.includes(e.state)),
    [control.escalations],
  );
  // Content proposals also create an owner_approvals row, and deciding one from
  // here would update that row while leaving content_proposals.state behind —
  // after which the proposal can never be decided, because its own path asks
  // the same engine and is told the approval is already answered. They have
  // their own section below; this one lists everything else.
  const pending = useMemo(
    () => control.approvals.filter(
      (a) => a.state === "WAITING_FOR_APPROVAL" && a.action_type !== CONTENT_APPROVAL_TYPE,
    ),
    [control.approvals],
  );
  const humanControlled = useMemo(
    () => control.conversations.filter((c) => c.control === "human"),
    [control.conversations],
  );
  const actionableProposals = useMemo(
    () => control.proposals.filter((p) => ACTIONABLE_PROPOSAL_STATES.includes(p.state)),
    [control.proposals],
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
      // A content approval refused here is not a concurrency clash — it is the
      // owner being sent to the path that moves the proposal too.
      announce(result.reason === "use_content_proposals"
        ? t("owner.useContentProposals")
        : t("owner.alreadyDecided").replace("{ref}", approval.reference));
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
  const proposalDetail = control.proposals.find((p) => p.id === openProposal);

  const focusProposal = () => requestAnimationFrame(() => proposalDetailRef.current?.focus());

  const openProposalDetail = (proposal: ContentProposal) => {
    const next = proposal.id === openProposal ? null : proposal.id;
    setOpenProposal(next);
    // Seed the edit fields from the draft so "edit" starts from what the AI
    // wrote rather than from an empty box.
    if (next) {
      setEditHook(proposal.hook);
      setEditBody(proposal.body);
    }
    focusProposal();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    announce(t("content.generating"));
    const result = await control.proposeContent(genSection, genType, genPlatform, genLanguage);
    setGenerating(false);
    // A refusal is usually the engine doing its job — a duplicate topic, a
    // section on cooldown, a draft that named something confidential. Each gets
    // its own sentence, because "try again" is wrong advice for most of them.
    announce(result.ok
      ? t("content.generated").replace("{ref}", result.proposal_ref ?? "")
      : t(`content.refused.${result.reason ?? "unknown"}`));
  };

  const handleProposalDecision = async (proposal: ContentProposal, approve: boolean) => {
    const result = await control.decideProposal(proposal.proposal_ref, approve, note || undefined);
    if (result.ok) {
      announce(t(approve ? "content.approved" : "content.rejected").replace("{ref}", proposal.proposal_ref));
      setOpenProposal(null);
      setNote("");
    } else {
      announce(t("owner.alreadyDecided").replace("{ref}", proposal.proposal_ref));
    }
  };

  const handleProposalEdit = async (proposal: ContentProposal) => {
    const result = await control.editProposal(proposal.proposal_ref, {
      hook: editHook, body: editBody, note: note || undefined,
    });
    announce(result.ok ? t("content.edited").replace("{ref}", proposal.proposal_ref) : t("content.editRefused"));
    if (result.ok) setNote("");
  };

  const handleRegenerate = async (proposal: ContentProposal) => {
    setGenerating(true);
    const result = await control.regenerateProposal(proposal.proposal_ref);
    setGenerating(false);
    announce(result.ok
      ? t("content.regenerated").replace("{ref}", result.proposal_ref ?? "")
      : t(`content.refused.${result.reason ?? "unknown"}`));
    if (result.ok) setOpenProposal(null);
  };

  const handleSchedule = async (proposal: ContentProposal) => {
    const when = proposal.proposed_publish_at ?? new Date(Date.now() + 86_400_000).toISOString();
    const result = await control.scheduleProposal(proposal.proposal_ref, when, note || undefined);
    announce(result.ok
      ? t("content.scheduled").replace("{ref}", proposal.proposal_ref)
      : t("content.scheduleRefused"));
  };

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

        {/* ── Content proposals (Phase 7) ─────────────────────────────── */}
        <section aria-labelledby="owner-content-heading" className="mb-8">
          {/* Counts what the table below actually renders. A heading that says
              0 above a visible, actionable row is worse than useless to someone
              navigating by heading — it invites skipping the section entirely,
              and an approved proposal still waiting to be scheduled lives here. */}
          <h2 id="owner-content-heading" className="mb-3 text-xl font-bold">
            {t("content.proposals")} ({actionableProposals.length})
          </h2>

          {/* Generation form. Native selects: they are the most reliably
              announced control in every screen reader, and this page is
              operated without sight. */}
          <Card className="mb-3">
            <CardContent className="p-4">
              <h3 className="mb-2 text-sm font-bold">{t("content.askAi")}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="content-section" className="block text-sm font-medium">{t("content.section")}</label>
                  <select
                    id="content-section" value={genSection} onChange={(e) => setGenSection(e.target.value)}
                    className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    {SECTIONS.map((s) => <option key={s} value={s}>{t(`content.section.${s}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="content-type" className="block text-sm font-medium">{t("content.type")}</label>
                  <select
                    id="content-type" value={genType} onChange={(e) => setGenType(e.target.value)}
                    className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    {CONTENT_TYPES.map((c) => <option key={c} value={c}>{t(`content.type.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="content-platform" className="block text-sm font-medium">{t("content.platform")}</label>
                  <select
                    id="content-platform" value={genPlatform} onChange={(e) => setGenPlatform(e.target.value)}
                    className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                    aria-describedby="content-platform-hint"
                  >
                    {PLATFORMS.map((p) => <option key={p} value={p}>{t(`content.platform.${p}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="content-language" className="block text-sm font-medium">{t("content.language")}</label>
                  <select
                    id="content-language" value={genLanguage}
                    onChange={(e) => setGenLanguage(e.target.value === "ar" ? "ar" : "en")}
                    className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="en">{t("content.lang.en")}</option>
                    <option value="ar">{t("content.lang.ar")}</option>
                  </select>
                </div>
                <Button size="sm" onClick={() => void handleGenerate()} disabled={generating}>
                  {generating ? t("content.generating") : t("content.generate")}
                </Button>
              </div>
              {/* Says plainly that choosing a platform does not post anywhere. */}
              <p id="content-platform-hint" className="mt-2 text-xs text-muted-foreground">
                {t("content.noPublishNotice")}
              </p>
            </CardContent>
          </Card>

          {actionableProposals.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("content.noProposals")}</p>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <caption className="sr-only">{t("content.proposalsCaption")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("owner.reference")}</TableHead>
                    <TableHead scope="col">{t("content.type")}</TableHead>
                    <TableHead scope="col">{t("content.section")}</TableHead>
                    <TableHead scope="col">{t("content.topic")}</TableHead>
                    <TableHead scope="col">{t("content.platform")}</TableHead>
                    {/* State as a word, never a colour alone. */}
                    <TableHead scope="col">{t("owner.status")}</TableHead>
                    <TableHead scope="col">{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionableProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-mono">{proposal.proposal_ref}</TableCell>
                      <TableCell>{t(`content.type.${proposal.content_type}`)}</TableCell>
                      <TableCell>{t(`content.section.${proposal.section}`)}</TableCell>
                      <TableCell>{proposal.topic}</TableCell>
                      <TableCell>{t(`content.platform.${proposal.platform}`)}</TableCell>
                      <TableCell>{t(`content.state.${proposal.state}`)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => openProposalDetail(proposal)}
                          aria-expanded={openProposal === proposal.id}
                          aria-controls="owner-proposal-detail"
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

          {proposalDetail && (
            <Card id="owner-proposal-detail" className="mt-3">
              <CardContent className="p-4">
                <h3
                  ref={proposalDetailRef} tabIndex={-1}
                  className="mb-1 font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("content.aiProposes")}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">{t("owner.youAuthorize")}</p>

                <dl className="grid gap-2 text-sm">
                  <div><dt className="inline font-medium">{t("content.topic")}: </dt><dd className="inline">{proposalDetail.topic}</dd></div>
                  <div><dt className="inline font-medium">{t("content.hook")}: </dt><dd className="inline">{proposalDetail.hook}</dd></div>
                  <div><dt className="inline font-medium">{t("content.why")}: </dt><dd className="inline">{proposalDetail.rationale}</dd></div>
                  <div><dt className="inline font-medium">{t("content.audience")}: </dt><dd className="inline">{proposalDetail.target_audience ?? "—"}</dd></div>
                  <div><dt className="inline font-medium">{t("content.proposedTime")}: </dt><dd className="inline">
                    {proposalDetail.proposed_publish_at ? new Date(proposalDetail.proposed_publish_at).toLocaleString() : "—"}
                  </dd></div>
                  <div><dt className="inline font-medium">{t("owner.status")}: </dt><dd className="inline">{t(`content.state.${proposalDetail.state}`)}</dd></div>
                  <div><dt className="inline font-medium">{t("content.revision")}: </dt><dd className="inline">{proposalDetail.revision}</dd></div>
                </dl>

                <h4 className="mt-3 text-sm font-bold">{t("content.preview")}</h4>
                <p className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 text-sm">{proposalDetail.body}</p>
                {proposalDetail.hashtags.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{t("content.hashtags")}: </span>
                    {proposalDetail.hashtags.join(" ")}
                  </p>
                )}

                {/* Which indexed rows the draft was grounded in — this is what
                    makes "why did the AI propose this" answerable later. These
                    are internal record ids, and this page is admin-only. */}
                <h4 className="mt-3 text-sm font-bold">{t("content.sources")}</h4>
                {proposalDetail.source_refs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {proposalDetail.source_refs.map((ref) => (
                      <li key={`${ref.source_table}:${ref.source_id}`}>
                        {t(`content.section.${ref.source_table}`)} — <span className="font-mono text-xs">{ref.source_id}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 grid gap-2">
                  <div>
                    <label htmlFor="content-edit-hook" className="text-sm font-medium">{t("content.editHook")}</label>
                    <Textarea id="content-edit-hook" rows={2} value={editHook} onChange={(e) => setEditHook(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label htmlFor="content-edit-body" className="text-sm font-medium">{t("content.editBody")}</label>
                    <Textarea id="content-edit-body" rows={6} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label htmlFor="content-note" className="text-sm font-medium">{t("owner.note")}</label>
                    <Textarea id="content-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleProposalDecision(proposalDetail, true)}>{t("owner.approve")}</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleProposalEdit(proposalDetail)}>{t("content.saveEdit")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleProposalDecision(proposalDetail, false)}>{t("owner.reject")}</Button>
                  <Button size="sm" variant="outline" disabled={generating} onClick={() => void handleRegenerate(proposalDetail)}>
                    {t("content.regenerate")}
                  </Button>
                  {proposalDetail.state === "APPROVED" && (
                    <Button size="sm" variant="outline" onClick={() => void handleSchedule(proposalDetail)}>
                      {t("content.schedule")}
                    </Button>
                  )}
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
