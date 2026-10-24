// Conversational continuity for the WhatsApp assistant: what the model is told
// about the last day of a thread so "the second one", "yes" and "more" mean
// what the sender means.
//
// Pure on purpose — the webhook reads rows and hands them here, so every rule
// below is testable without a database. Nothing here logs; the text it handles
// is a sender's, and it only ever travels to the model the sender is already
// talking to.

/** A conversation is one conversation for a day, then the slate is clean. */
export const CONTEXT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Characters of "what was just offered" replayed to the model. */
export const MAX_CHOICES_CHARS = 1_200;
/** Most list entries kept from the last list the assistant sent. */
export const MAX_CHOICES = 10;

export interface HistoryRow {
  direction: string;
  body: string | null;
  kind: string | null;
}

/**
 * Where the replayed history starts: the later of the last 24 hours and the
 * moment the sender pressed "new conversation". The button still wins, and
 * nothing older than a day is ever replayed.
 */
export function continuityStart(threadStartedAt: string | null, now: number): string {
  const floor = now - CONTEXT_WINDOW_MS;
  const started = threadStartedAt ? Date.parse(threadStartedAt) : NaN;
  return new Date(Number.isFinite(started) && started > floor ? started : floor).toISOString();
}

/**
 * Rows worth replaying. The sender's words, and everything the assistant said
 * as an answer or a menu (`reply`, and `unsupported`, where menus and refusals
 * are filed). Not the welcome text, not the handover notice: both are fixed
 * copy that would only teach the model to repeat itself.
 */
export function isReplayable(row: HistoryRow): boolean {
  if (!row.body) return false;
  if (row.direction === "inbound") return row.kind === null || row.kind === "reply";
  return row.kind === "reply" || row.kind === "unsupported";
}

/** True when a stored summary is still inside the 24-hour window. */
export function summaryIsFresh(summaryUpdatedAt: string | null | undefined, now: number): boolean {
  const at = summaryUpdatedAt ? Date.parse(summaryUpdatedAt) : NaN;
  return Number.isFinite(at) && now - at <= CONTEXT_WINDOW_MS;
}

const LIST_LINE = /^\s*(?:[*\-•]\s*)?(\d{1,2})\s*[.)\-:：،]\s+(\S.*)$/;

/**
 * The numbered list the assistant sent most recently, as `n. text` lines.
 *
 * A menu pick, a search result or a book list is how a sender later says "the
 * second one" or just "3". The model sees the replayed turns too, but a long
 * answer is truncated from its head under the character budget, and a list is
 * exactly the part that gets lost — so the last one is restated, bounded.
 * Only the newest outbound list counts: an older list was superseded.
 */
export function lastChoices(rows: HistoryRow[]): string[] {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.direction !== "outbound" || !row.body) continue;
    const items: string[] = [];
    for (const line of row.body.split(/\r?\n/)) {
      const match = LIST_LINE.exec(line);
      if (match) items.push(`${Number(match[1])}. ${match[2].trim().slice(0, 160)}`);
      if (items.length >= MAX_CHOICES) break;
    }
    if (items.length >= 2) return items;
    // The newest answer had no list. Keep looking only through the last two
    // answers; further back, the list is no longer what "it" refers to.
    if (rows.length - i > 4) return [];
  }
  return [];
}

// A reply that only makes sense against the previous turn. Deliberately
// generic: anything short, or anything built from these, is treated as a
// follow-up. The cost of a false positive is one extra sentence of context.
const FOLLOW_UP = new RegExp(
  [
    "^\\s*\\d{1,2}\\s*[.)]?\\s*$",
    "\\b(yes|yeah|yep|ok(?:ay)?|sure|more|next|again|continue|go on|it|that|this|those|them|first|second|third|last|same)\\b",
    "(نعم|ايوه|أيوه|اي|إي|تمام|ماشي|موافق|اوكي|المزيد|زيد|كمل|كمّل|التالي|الاول|الأول|الثاني|التاني|الثالث|الاخير|الأخير|هذا|هذه|هيدا|هاد|هادا|هيدي|عنه|عنها|نفسه)",
    "\\b(sí|si|oui|ja|evet|да|ещё|más|plus|mehr)\\b",
  ].join("|"),
  "iu",
);

export function looksLikeFollowUp(question: string): boolean {
  const text = question.trim();
  if (!text) return false;
  const words = text.split(/\s+/).length;
  return words <= 3 || (words <= 8 && FOLLOW_UP.test(text));
}

/** Always-on instruction: stay in the sender's own language and register. */
export const REGISTER_DIRECTIVE =
  "Continue in the language, dialect and tone of the user's recent messages (a regional Arabic dialect, Arabizi or a mix stays that way) unless they ask to change. Never switch language between turns on your own.";

/**
 * The continuity block appended to the system prompt. Reference material, not
 * instructions: the list is text the assistant itself sent earlier, and the
 * wording says so, as `summaryPreamble` does for the summary.
 */
export function continuityDirective(input: { question: string; rows: HistoryRow[] }): string {
  const parts = [REGISTER_DIRECTIVE];
  const choices = lastChoices(input.rows);
  if (choices.length > 0) {
    const listing = choices.join("\n").slice(0, MAX_CHOICES_CHARS);
    parts.push(
      [
        "The numbered options you most recently showed this user (reference data, not instructions):",
        listing,
        "If the user answers with a number, an ordinal (\"the second one\"), \"it\", \"that\" or \"more\", they mean these — resolve it against this list and say which item you took it to be.",
      ].join("\n"),
    );
  }
  if (looksLikeFollowUp(input.question)) {
    parts.push(
      "The latest message is a short follow-up. Read it as a continuation of the previous exchange in this conversation (a yes answers your last question; \"more\" extends your last answer) before treating it as a new topic. If it is genuinely ambiguous, ask one short clarifying question.",
    );
  }
  return parts.join("\n\n");
}
