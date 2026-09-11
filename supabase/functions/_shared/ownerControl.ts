// Owner control centre: identifying the owner, parsing their commands, and
// formatting what they are asked to decide.
//
// The security posture here is deliberately unforgiving. A WhatsApp message
// from a number that is not the configured owner is a customer message, full
// stop — it is never interpreted as a command, and no command is ever executed
// on the strength of message text alone.

export type OwnerCommandKind =
  | "approve"
  | "reject"
  | "take_over"
  | "return_to_ai"
  | "more_info"
  | "list_pending"
  | "help"
  | "unknown";

export interface OwnerCommand {
  kind: OwnerCommandKind;
  /** Reference the owner named, if any. Uppercased. */
  reference: string | null;
  /** Positional choice from a numbered prompt, if the reply was a bare digit. */
  choice: number | null;
  /** Free text after the command, e.g. a note or a question for the customer. */
  note: string | null;
}

/**
 * Reduce a phone number to comparable digits.
 *
 * WhatsApp reports a bare international number; an admin may type the same one
 * with a plus, spaces, or a `00` prefix. Comparing the raw strings would
 * silently reject the real owner, so both sides are normalised to digits and a
 * leading international dialling prefix is stripped.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  let digits = String(value).replace(/\D+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

/**
 * Is this sender the configured owner?
 *
 * Compares the trailing significant digits so a number written with or without
 * its country code still matches, while staying long enough that two different
 * subscribers cannot collide. Returns false for an unset owner number: an
 * unconfigured system must treat everyone as a customer, never as an owner.
 */
export function isOwner(senderPhone: string, configuredOwnerPhone: string | null | undefined): boolean {
  const sender = normalizePhone(senderPhone);
  const owner = normalizePhone(configuredOwnerPhone);
  if (!owner || owner.length < 8 || !sender) return false;
  const significant = Math.min(sender.length, owner.length, 12);
  if (significant < 8) return false;
  return sender.slice(-significant) === owner.slice(-significant);
}

const REFERENCE_PATTERN = /\b([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5})\b/i;

const APPROVE_WORDS = [/\b(approve|approved|accept|yes|ok|confirm)\b/i, /(وافق|موافق|موافقة|نعم|أوافق|اوافق|تم)/];
const REJECT_WORDS = [/\b(reject|rejected|decline|deny|no|cancel)\b/i, /(ارفض|رفض|مرفوض|لا|إلغاء|الغاء)/];
const TAKEOVER_WORDS = [/\b(take ?over|i(?:'| a)?ll handle|handle it)\b/i, /(أتولى|اتولى|بتولى|سأرد|سارد|أنا أرد|انا ارد)/];
const RETURN_WORDS = [/\b(return to ai|back to ai|resume ai|ai resume)\b/i, /^(return|resume)$/i, /(أرجع للذكاء|ارجع للذكاء|رجّع للمساعد|رجع للمساعد|كمّل الذكاء)/];
const MORE_INFO_WORDS = [/\b(more info|details|show me more|explain)\b/i, /^info$/i, /(تفاصيل|معلومات أكثر|معلومات اكثر|وضّح|وضح)/];
const HELP_WORDS = [/^(help|commands|\?|h)$/i, /^(مساعدة|المساعدة|الأوامر|اوامر)$/];
const LIST_WORDS = [/\b(pending|list|what.?s waiting|show pending)\b/i, /(المعلّق|المعلق|القائمة|شو في|ما ينتظر)/];

/**
 * Numbered replies map to the prompt Visionex sent, so the numbering is fixed
 * and documented rather than inferred per message.
 */
const CHOICE_TO_KIND: Record<number, OwnerCommandKind> = {
  1: "take_over",
  2: "approve",
  3: "reject",
  4: "more_info",
};

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * The prefix that separates a command from a sentence.
 *
 * Without it the owner cannot use their own assistant. "ok", "no", "لا",
 * "القائمة" and a bare "2" are ordinary things to send, and every one of
 * them used to be swallowed by the control centre, so the one number that most
 * needs to check what customers see was the one number that could not. A slash
 * makes the two modes explicit: `/approve` decides, `approve` is just a word.
 */
export const OWNER_COMMAND_PREFIX = "/";

/** Never a command: returned for every message that carries no prefix. */
const NOT_A_COMMAND: OwnerCommand = { kind: "unknown", reference: null, choice: null, note: null };

/**
 * The command text inside a message, or null when it is an ordinary message.
 *
 * Null and empty are different answers: a bare "/" is a command attempt with
 * nothing after it, which is a request for the list, while null is a sentence
 * that belongs to the customer assistant.
 */
export function ownerCommandBody(input: string | null | undefined): string | null {
  const text = (input ?? "").trim();
  if (!text.startsWith(OWNER_COMMAND_PREFIX)) return null;
  return text.slice(OWNER_COMMAND_PREFIX.length).trim();
}

/**
 * Parse an owner reply.
 *
 * Only a prefixed message is read at all; anything else is a sentence and is
 * reported as unknown with no reference, which is what lets the caller hand it
 * to the ordinary assistant untouched.
 *
 * A bare digit is only a *choice*; it carries no reference. The caller must
 * resolve it against exactly one pending approval and refuse when that is
 * ambiguous — this function never guesses which action a "2" refers to.
 */
export function parseOwnerCommand(input: string): OwnerCommand {
  const body = ownerCommandBody(input);
  if (body === null) return { ...NOT_A_COMMAND };
  // "/" on its own, and every spelling of help, answer with the list.
  if (!body || matches(body, HELP_WORDS)) {
    return { kind: "help", reference: null, choice: null, note: null };
  }

  const text = body;
  const referenceMatch = text.match(REFERENCE_PATTERN);
  const reference = referenceMatch ? referenceMatch[1].toUpperCase() : null;

  const bareDigit = /^\s*([1-9])\s*$/.exec(text);
  if (bareDigit) {
    const choice = Number(bareDigit[1]);
    return { kind: CHOICE_TO_KIND[choice] ?? "unknown", reference: null, choice, note: null };
  }

  const stripped = reference ? text.replace(REFERENCE_PATTERN, " ") : text;

  let kind: OwnerCommandKind = "unknown";
  // Order matters: "return to ai" contains no approve word, but "take over"
  // must beat the generic words, and an explicit reject must beat "no" inside
  // a longer sentence.
  if (matches(stripped, TAKEOVER_WORDS)) kind = "take_over";
  else if (matches(stripped, RETURN_WORDS)) kind = "return_to_ai";
  else if (matches(stripped, REJECT_WORDS)) kind = "reject";
  else if (matches(stripped, APPROVE_WORDS)) kind = "approve";
  else if (matches(stripped, MORE_INFO_WORDS)) kind = "more_info";
  else if (matches(stripped, LIST_WORDS)) kind = "list_pending";

  const note = stripped
    .replace(APPROVE_WORDS[0], " ").replace(REJECT_WORDS[0], " ")
    .replace(TAKEOVER_WORDS[0], " ").replace(RETURN_WORDS[0], " ")
    .replace(/\s+/g, " ")
    .trim();

  return { kind, reference, choice: null, note: note || null };
}

export interface PendingApproval {
  reference: string;
  action_type: string;
  title: string;
  summary: string | null;
}

/**
 * The notification the owner receives.
 *
 * The reference is stated twice — in the header and in the instruction —
 * because a bare number is only safe when exactly one item is pending, and the
 * owner should always have the unambiguous form to hand.
 */
export function formatOwnerNotification(params: {
  reference: string;
  headline: string;
  customer: string;
  channel: string;
  request: string;
  aiSummary?: string | null;
  suggestedAction?: string | null;
}): string {
  const lines = [
    `*${params.headline}*  [${params.reference}]`,
    "",
    `*Customer:* ${params.customer}`,
    `*Channel:* ${params.channel}`,
    `*Request:* ${params.request}`,
  ];

  if (params.aiSummary) lines.push("", `*AI summary:* ${params.aiSummary}`);
  if (params.suggestedAction) lines.push("", `*Suggested action:* ${params.suggestedAction}`);

  lines.push(
    "",
    "/1  Take over",
    "/2  Approve",
    "/3  Reject",
    "/4  Ask AI for more information",
    "",
    `Reply with /1 to /4, or "/approve ${params.reference}" / "/reject ${params.reference}".`,
    "Commands start with a slash; anything else you send is answered as a customer.",
  );

  return lines.join("\n");
}

/**
 * The list of commands, and the one sentence that explains the prefix.
 *
 * Answered for "/help" and for any prefixed message that parses to nothing:
 * a slash is always a command attempt, so a mistyped one belongs here rather
 * than in the customer assistant, where it would be answered as a question.
 */
export function formatOwnerHelp(): string {
  return [
    "*Owner commands*",
    "",
    "Anything you send *without* a slash is answered exactly as a customer would",
    "see it, so this number can be used to test the assistant.",
    "",
    "/1 … /4 — answer a numbered prompt",
    "/approve AB2CD — approve a decision",
    "/reject AB2CD — reject a decision, optionally with a note",
    "/takeover — reply to the customer yourself",
    "/return — hand the conversation back to the AI",
    "/info — ask the AI for more detail",
    "/pending — list what is waiting for you",
    "/help — this list",
  ].join("\n");
}

/** Sent when a bare number cannot be attributed to a single pending action. */
export function formatAmbiguityPrompt(pending: PendingApproval[]): string {
  const lines = [
    "*Which one?* More than one decision is waiting, so a bare number is ambiguous.",
    "",
    ...pending.slice(0, 10).map((item) => `• [${item.reference}] ${item.title}`),
    "",
    'Reply with the reference, for example "/approve ' + (pending[0]?.reference ?? "AB2CD") + '".',
  ];
  return lines.join("\n");
}

export function formatPendingList(pending: PendingApproval[]): string {
  if (pending.length === 0) return "Nothing is waiting for you right now.";
  return [
    `*${pending.length} waiting for you*`,
    "",
    ...pending.slice(0, 10).map((item) => `• [${item.reference}] ${item.title}`),
  ].join("\n");
}
