// Triage: what a message is about, and what a human needs to know.
//
// Classification is a label, not an answer, so it runs on the cheapest model
// available and never blocks the reply — an unclassified message is a normal
// state, not an error.
//
// The pure parts live here without a provider import so the routing rules and
// the wording can be tested under Node.

export const CATEGORIES = [
  "general", "technical", "billing", "account", "bazaar", "order",
  "complaint", "feedback", "media", "human_request",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);

/**
 * Obvious cases settled without a model call.
 *
 * Cost control starts here: a message that plainly asks for a person, or that
 * arrived as an attachment, does not need a classifier to say so.
 */
export function quickCategory(input: {
  text: string;
  askedForHuman: boolean;
  hasMedia: boolean;
}): Category | null {
  if (input.askedForHuman) return "human_request";
  if (input.hasMedia && !input.text.trim()) return "media";
  return null;
}

export const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category"],
  properties: {
    category: { type: "string", enum: [...CATEGORIES] },
  },
} as const;

export const CLASSIFY_INSTRUCTION = [
  "Label this customer message with exactly one category.",
  "general: greetings and anything that fits nothing else.",
  "technical: something is broken or does not work.",
  "billing: payments, prices, invoices, refunds, VX balance.",
  "account: login, password, profile, deletion, access.",
  "bazaar: browsing, products, shops, sellers.",
  "order: an existing purchase, delivery or its status.",
  "complaint: dissatisfaction or a grievance.",
  "feedback: praise or a suggestion.",
  "media: the message is mainly an attachment.",
  "human_request: asking for a person.",
  "Answer with the label only. It is a routing hint, never an answer to the customer.",
].join(" ");

/**
 * Reasons a conversation goes to a person.
 *
 * `low_confidence` and `repeated_failure` are the ones the assistant cannot
 * ask about — it has to notice.
 */
export type EscalationReason =
  | "user_request"
  | "assistant_handover"
  | "ai_unavailable"
  | "complaint"
  | "repeated_failure"
  | "sensitive";

/**
 * Whether this message should go to a human even though nobody asked.
 *
 * Deliberately conservative. Escalating a routine question wastes a person's
 * time; failing to escalate a complaint or a payment problem costs a customer.
 */
export function shouldEscalate(input: {
  category: Category | null;
  consecutiveDeclines: number;
  text: string;
}): EscalationReason | null {
  if (input.category === "human_request") return "user_request";
  if (input.category === "complaint") return "complaint";

  // Three unanswerable turns in a row is the assistant failing, not the user.
  if (input.consecutiveDeclines >= 3) return "repeated_failure";

  // Money and access problems that name a real failure, not a general question.
  const sensitive = /\b(fraud|stolen|unauthori[sz]ed|charged twice|double charged|hacked|scam|refund now|legal|lawyer)\b/i;
  const sensitiveAr = /(احتيال|نصب|سرقة|خصم مرتين|اخترق|محامي|قانوني|استرجاع فوري)/;
  if (sensitive.test(input.text) || sensitiveAr.test(input.text)) return "sensitive";

  return null;
}

// ── An outage is not a handover ─────────────────────────────────────────────
//
// `escalated` silences the assistant completely, and nothing in the product
// clears it. That is right for five of the six reasons above: somebody asked
// for a person, or complained, or said something about a payment — a person now
// owns the conversation and two voices in it would be worse than one.
//
// `ai_unavailable` is not like the other five. It is not a judgement about the
// conversation at all: the provider was unreachable for one message. The thread
// was then silenced for ever, so every question that sender asked afterwards
// was dropped without a word — one production conversation sat like that from
// 12:51 on 2026-09-06, and the only way back was a workflow somebody had to
// know to run.
//
// So a technical escalation stops silencing the assistant once the outage it
// describes is over. The person is still told — the handover message went out
// and the row is still flagged for whoever reads the queue — and the sender
// stops being ignored. Half an hour is long enough that a provider having a bad
// minute does not flap, and short enough that nobody is left waiting for a day.
//
// `control === "human"` is untouched. That is the owner deliberately taking a
// conversation, and only the owner hands it back.

/** Escalations that describe the infrastructure rather than the conversation. */
export const TECHNICAL_ESCALATIONS: readonly EscalationReason[] = ["ai_unavailable"];

export const TECHNICAL_ESCALATION_COOLDOWN_MS = 30 * 60 * 1000;

export const isTechnicalEscalation = (reason: unknown): boolean =>
  typeof reason === "string" && (TECHNICAL_ESCALATIONS as readonly string[]).includes(reason);

/**
 * Whether the assistant must stay quiet in this conversation.
 *
 * The one completely silent path in the webhook, so it is a pure function with
 * its own tests rather than a condition written twice in a long file.
 *
 * An escalation with no timestamp stays permanent. A row that cannot say when
 * it was escalated cannot say the outage is over either, and the safe direction
 * for an unreadable date is the one that keeps a person involved.
 */
export function assistantIsSilenced(
  row: {
    control?: unknown;
    escalated?: unknown;
    escalation_reason?: unknown;
    escalated_at?: unknown;
  } | null | undefined,
  nowMs: number,
): boolean {
  if (!row) return false;
  if (row.control === "human") return true;
  if (row.escalated !== true) return false;
  if (!isTechnicalEscalation(row.escalation_reason)) return true;

  const at = typeof row.escalated_at === "string" ? Date.parse(row.escalated_at) : NaN;
  if (!Number.isFinite(at)) return true;
  return nowMs - at < TECHNICAL_ESCALATION_COOLDOWN_MS;
}

/** The instruction used to brief a human taking over. */
export const HANDOFF_INSTRUCTION = [
  "Write a briefing for a support agent who is about to take over this conversation, in at most 120 words of English.",
  "Cover: what the customer wants, what has already been tried or answered, any facts they gave, and what is still open.",
  "Never include passwords, one-time codes, card numbers or tokens — omit them entirely.",
  "Do not address the customer and do not suggest a reply. Plain prose, no headings.",
].join(" ");

/** Shown to staff when no briefing could be generated. Never a blank field. */
export function fallbackBriefing(reason: EscalationReason, lastMessage: string): string {
  const why: Record<EscalationReason, string> = {
    user_request: "The customer asked to speak to a person.",
    assistant_handover: "The assistant could not answer and handed over.",
    ai_unavailable: "The AI provider was unreachable, so the message was not answered.",
    complaint: "The message was classified as a complaint.",
    repeated_failure: "The assistant failed to answer several times in a row.",
    sensitive: "The message mentions a payment or account problem that needs a person.",
  };
  return `${why[reason]} No automatic summary was available. Last message: ${lastMessage.slice(0, 400)}`;
}
