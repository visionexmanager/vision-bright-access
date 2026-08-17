import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EscalationState =
  | "WAITING_FOR_OWNER" | "OWNER_VIEWED" | "OWNER_APPROVED" | "OWNER_REJECTED"
  | "OWNER_RESPONDED" | "RETURNED_TO_AI" | "RESOLVED" | "FAILED";

export type ApprovalState =
  | "WAITING_FOR_APPROVAL" | "APPROVED" | "REJECTED" | "PROCESSING"
  | "COMPLETED" | "FAILED" | "EXPIRED";

export interface Escalation {
  id: string;
  customer_name: string | null;
  customer_ref: string | null;
  channel: string;
  reason: string;
  customer_request: string;
  ai_summary: string | null;
  suggested_action: string | null;
  subject_type: string | null;
  subject_id: string | null;
  state: EscalationState;
  created_at: string;
  transcript: unknown;
}

export interface Approval {
  id: string;
  reference: string;
  action_type: string;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  state: ApprovalState;
  escalation_id: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  decided_via: string | null;
  decision_note: string | null;
}

/**
 * The `owner_approvals.action_type` a content proposal creates.
 *
 * Content proposals are decided through `decide_proposal`, which updates the
 * proposal and its approval together. Deciding one through the generic
 * `decide_approval` path would answer the approval alone and strand the
 * proposal, so this type is filtered out of the generic approvals surface and
 * refused server-side.
 */
export const CONTENT_APPROVAL_TYPE = "content_publish";

export type ProposalState =
  | "PROPOSED" | "EDITED" | "APPROVED" | "SCHEDULED"
  | "REJECTED" | "SUPERSEDED" | "PUBLISHED";

/**
 * A drafted content proposal awaiting an owner decision.
 *
 * `PUBLISHED` appears in the union because the database vocabulary contains it,
 * not because anything in this phase can reach it — no transition leads there.
 */
export interface ContentProposal {
  id: string;
  proposal_ref: string;
  content_type: string;
  section: string;
  platform: string;
  topic: string;
  hook: string;
  body: string;
  hashtags: string[];
  rationale: string;
  target_audience: string | null;
  language: string;
  /** Which indexed rows the draft was grounded in. */
  source_refs: { source_table: string; source_id: string }[];
  proposed_publish_at: string | null;
  state: ProposalState;
  revision: number;
  rejection_reason: string | null;
  owner_notes: string | null;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  created_at: string;
}

export interface CalendarSlot {
  id: string;
  proposal_id: string;
  scheduled_for: string;
  platform: string;
  slot_state: string;
  note: string | null;
}

export interface FeedbackEvent {
  id: string;
  event_type: string;
  channel: string;
  subject_type: string | null;
  subject_id: string | null;
  summary: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}

export interface ControlledConversation {
  id: string;
  wa_phone: string;
  control: string;
  escalated: boolean;
  escalation_reason: string | null;
  control_changed_at: string | null;
  last_message_at: string;
}

/** Reflects what is actually configured, never an aspiration. */
export type WhatsAppStatus = "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTED" | "REQUIRES_REVIEW" | "ERROR";

interface ActionResult {
  ok: boolean;
  /** Set when the action failed for a reason the owner should see. */
  reason?: string;
  /** Extra context on a refusal, e.g. which earlier proposal was too similar. */
  detail?: string;
  /** Set when a content proposal was created. */
  proposal_ref?: string;
}

/**
 * Reads the control-centre data and performs owner actions.
 *
 * Reads go straight to the tables — RLS already restricts them to admins, so
 * the policy is the authority rather than a check in this file. Writes go
 * through the `owner-control` edge function, because the engine functions are
 * service-role only and a browser must never be able to authorize a decision.
 */
export function useOwnerControl() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEvent[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [conversations, setConversations] = useState<ControlledConversation[]>([]);
  const [proposals, setProposals] = useState<ContentProposal[]>([]);
  const [calendar, setCalendar] = useState<CalendarSlot[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>("NOT_CONFIGURED");
  const [ownerWhatsappNumber, setOwnerNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [esc, appr, fb, aud, conv, prop, cal, settings] = await Promise.all([
        supabase.from("support_escalations").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("owner_approvals").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("ai_feedback_events").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("whatsapp_conversations").select("*").order("last_message_at", { ascending: false }).limit(50),
        supabase.from("content_proposals").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("content_calendar").select("*").order("scheduled_for", { ascending: true }).limit(100),
        supabase.from("site_settings").select("value").eq("key", "owner_contact").maybeSingle(),
      ]);

      const firstError = esc.error ?? appr.error ?? fb.error ?? aud.error ?? conv.error ?? prop.error ?? cal.error;
      if (firstError) throw firstError;

      setEscalations((esc.data ?? []) as unknown as Escalation[]);
      setApprovals((appr.data ?? []) as unknown as Approval[]);
      setFeedback((fb.data ?? []) as unknown as FeedbackEvent[]);
      setActivity((aud.data ?? []) as unknown as AuditEntry[]);
      setConversations((conv.data ?? []) as unknown as ControlledConversation[]);
      setProposals((prop.data ?? []) as unknown as ContentProposal[]);
      setCalendar((cal.data ?? []) as unknown as CalendarSlot[]);

      // "Configured" means an owner number exists. It never says "connected":
      // that requires a verified Meta integration, which the browser cannot
      // observe anyway.
      //
      // The shape is checked rather than asserted. `owner_contact` is a jsonb
      // object, but a bad writer could have left a string there — in which case
      // there is no owner number, and reporting NOT_CONFIGURED is both true and
      // the thing that makes the damage visible on screen.
      const contact = settings.data?.value;
      const ownerNumber = (contact && typeof contact === "object" && !Array.isArray(contact))
        ? (contact as { whatsapp_number?: string | null }).whatsapp_number ?? null
        : null;
      setOwnerNumber(ownerNumber);
      setWhatsappStatus(ownerNumber ? "CONFIGURED" : "NOT_CONFIGURED");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the control centre");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invoke = useCallback(async (body: Record<string, unknown>): Promise<ActionResult> => {
    const { data, error: fnError } = await supabase.functions.invoke("owner-control", { body });
    if (fnError) {
      // A 409 is not a fault: someone else decided first. Surface it as such
      // rather than as an error the owner is asked to retry.
      const payload = (data ?? {}) as { reason?: string };
      return { ok: false, reason: payload.reason ?? fnError.message };
    }
    const result = (data ?? {}) as ActionResult;
    if (result.ok) await load();
    return result;
  }, [load]);

  return {
    escalations, approvals, feedback, activity, conversations, whatsappStatus,
    proposals, calendar, ownerWhatsappNumber,
    loading, error, reload: load,

    // Which handset owns this account. It goes through owner-control like every
    // other write here: the row also holds notification flags, and merging one
    // key into it is a read-modify-write that belongs on the server.
    setOwnerWhatsappNumber: (whatsappNumber: string) =>
      invoke({ action: "set_owner_contact", whatsapp_number: whatsappNumber }),

    // Phase 7. Every one of these goes through owner-control for the same
    // reason the decisions above do: the tables have no write policy, so the
    // browser cannot reach them even with an admin session.
    proposeContent: (section: string, contentType: string, platform: string, language: "en" | "ar") =>
      invoke({ action: "propose_content", section, content_type: contentType, platform, language }),

    decideProposal: (proposalRef: string, approve: boolean, note?: string) =>
      invoke({ action: "decide_proposal", proposal_ref: proposalRef, approve, note }),

    editProposal: (proposalRef: string, patch: {
      hook?: string; body?: string; hashtags?: string[]; proposed_publish_at?: string; note?: string;
    }) => invoke({ action: "edit_proposal", proposal_ref: proposalRef, ...patch }),

    /** Never edits the previous draft — it creates a linked replacement. */
    regenerateProposal: (proposalRef: string) =>
      invoke({ action: "regenerate_proposal", proposal_ref: proposalRef }),

    scheduleProposal: (proposalRef: string, scheduledFor: string, note?: string) =>
      invoke({ action: "schedule_proposal", proposal_ref: proposalRef, scheduled_for: scheduledFor, note }),

    decideApproval: (reference: string, approve: boolean, note?: string) =>
      invoke({ action: "decide_approval", reference, approve, note }),

    transitionEscalation: (escalationId: string, nextState: EscalationState, note?: string) =>
      invoke({ action: "transition_escalation", escalation_id: escalationId, next_state: nextState, note }),

    markViewed: (escalationId: string) =>
      invoke({ action: "mark_viewed", escalation_id: escalationId }),

    setConversationControl: (waPhone: string, control: "ai" | "human") =>
      invoke({ action: "set_conversation_control", wa_phone: waPhone, control }),
  };
}
