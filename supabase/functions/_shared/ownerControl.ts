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
  /**
   * Whether the owner wrote a slash in front of it.
   *
   * This is the difference between "I am giving an instruction" and "I am
   * talking". The words this file matches — "ok", "no", «تم», «لا» — are among
   * the most common things anybody says, and the owner is a person who also has
   * ordinary conversations with their own assistant. Before the slash existed,
   * every «تم» in one of those conversations was parsed as an approval, wrote an
   * audit row, spent a slot of the hourly rate limit, and came back as "Nothing
   * is waiting for a decision right now."
   *
   * So: a slash is always a command. Without one, the words still work — but
   * only while a decision is actually waiting, which is the only time they are
   * unambiguous. The caller enforces that half; this flag is what lets it.
   */
  explicit: boolean;
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
const RETURN_WORDS = [/\b(return to ai|back to ai|resume ai|ai resume)\b/i, /(أرجع للذكاء|ارجع للذكاء|رجّع للمساعد|رجع للمساعد|كمّل الذكاء)/];
const MORE_INFO_WORDS = [/\b(more info|details|show me more|explain)\b/i, /(تفاصيل|معلومات أكثر|معلومات اكثر|وضّح|وضح)/];
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

/**
 * The command names, for a message that began with a slash.
 *
 * Deliberately separate from the natural-language lists below rather than
 * folded into them. `/ai` has to mean "hand the conversation back", and adding
 * a bare "ai" to `RETURN_WORDS` would make "do you have AI?" mean it too. An
 * explicit vocabulary can be short and exact because the slash already said
 * that an instruction was intended.
 */
const SLASH_COMMANDS: Readonly<Record<string, OwnerCommandKind>> = {
  approve: "approve",
  ok: "approve",
  yes: "approve",
  reject: "reject",
  no: "reject",
  takeover: "take_over",
  take: "take_over",
  ai: "return_to_ai",
  resume: "return_to_ai",
  info: "more_info",
  details: "more_info",
  pending: "list_pending",
  list: "list_pending",
  help: "help",
  commands: "help",
};

/** A leading slash, with any spaces around it. */
const SLASH = /^\s*\/\s*/;

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Parse an owner reply.
 *
 * A bare digit is only a *choice*; it carries no reference. The caller must
 * resolve it against exactly one pending approval and refuse when that is
 * ambiguous — this function never guesses which action a "2" refers to.
 */
export function parseOwnerCommand(input: string): OwnerCommand {
  const raw = input ?? "";
  const explicit = SLASH.test(raw);
  // Everything below reads the message with the slash removed, so `/approve`
  // and "approve" parse through exactly the same code. The slash decides how
  // the *caller* treats the result, not how it is read.
  const text = raw.replace(SLASH, "").trim();

  const referenceMatch = text.match(REFERENCE_PATTERN);
  const reference = referenceMatch ? referenceMatch[1].toUpperCase() : null;

  const bareDigit = /^\s*([1-9])\s*$/.exec(text);
  if (bareDigit) {
    const choice = Number(bareDigit[1]);
    return { kind: CHOICE_TO_KIND[choice] ?? "unknown", reference: null, choice, note: null, explicit };
  }

  // An explicit command name wins outright, before any natural-language
  // matching: `/no` is a rejection and never the "no" inside a sentence.
  if (explicit) {
    const [first, ...rest] = text.split(/\s+/);
    const named = SLASH_COMMANDS[first?.toLowerCase() ?? ""];
    if (named) {
      const remainder = rest.join(" ").replace(REFERENCE_PATTERN, " ").replace(/\s+/g, " ").trim();
      return { kind: named, reference, choice: null, note: remainder || null, explicit };
    }
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

  return { kind, reference, choice: null, note: note || null, explicit };
}

/**
 * The commands, as the owner sees them.
 *
 * Written out because the slash made this a vocabulary somebody has to know
 * rather than words they happened to use. `/help` is the one command whose job
 * is to make the other seven discoverable.
 */
export function formatOwnerHelp(): string {
  return [
    "*Owner commands*",
    "",
    "A message starting with / is always a command. Anything else is an",
    "ordinary conversation — the words below only act on their own while a",
    "decision is actually waiting.",
    "",
    "/pending — what is waiting for you",
    "/approve [ref] [note] — approve it",
    "/reject [ref] [note] — reject it",
    "/takeover — answer this customer yourself",
    "/ai — hand the conversation back to the assistant",
    "/info — ask the assistant to explain the case",
    "/1 /2 /3 /4 — the numbered choices on a notification",
    "/help — this list",
  ].join("\n");
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
    "1. Take over",
    "2. Approve",
    "3. Reject",
    "4. Ask AI for more information",
    "",
    `Reply with a number, or "approve ${params.reference}" / "reject ${params.reference}".`,
  );

  return lines.join("\n");
}

/** Sent when a bare number cannot be attributed to a single pending action. */
export function formatAmbiguityPrompt(pending: PendingApproval[]): string {
  const lines = [
    "*Which one?* More than one decision is waiting, so a bare number is ambiguous.",
    "",
    ...pending.slice(0, 10).map((item) => `• [${item.reference}] ${item.title}`),
    "",
    'Reply with the reference, for example "approve ' + (pending[0]?.reference ?? "AB2CD") + '".',
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
