// The AI Assistant, as a feature of the navigation engine.
//
// This file holds the parts of the feature that are decisions rather than
// I/O: which state the sender is in, what each state says, how long an input
// may be, how a long answer is cut into messages, and how a thread is scoped.
// The model call itself is not here and is not new — the webhook has answered
// questions through `aiProvider.ts` since long before this engine existed, with
// retrieval, a rolling summary, a provider fallback chain and an escalation
// path. Rebuilding any of that inside a "feature" would have been the worst
// possible outcome of this phase.
//
// So what the AI Assistant *adds* is the part that was missing: a place to
// stand. A sender who chooses "Ask AI" is in a state where the next thing they
// send is a question — not a weather lookup that happens to start with "الطقس",
// not a photo command — and stays there, turn after turn, until they leave.
//
// Pure and provider-free: no `Deno`, no fetch, no database.

import { localized, type Language } from "./whatsappCatalog.ts";
import { UI_STRINGS } from "./whatsappStrings.ts";

/**
 * The states the assistant puts a sender in.
 *
 * Stored in `current_step`, so they survive a delivery, and cleared by the
 * navigation engine's own rules — `0`, `00`, `#` and the session timeout all
 * clear a step without this feature implementing any of them again.
 *
 *   AI_MENU          - looking at the assistant's three options
 *   AI_TEXT_INPUT    - the next typed message is a question
 *   AI_VOICE_INPUT   - the next voice note is a question
 *   AI_PROCESSING    - a provider is being waited on, right now
 *   AI_CONVERSATION  - answered at least once; still the assistant's floor
 *   AI_NEW_CONVERSATION - the moment a thread was reset
 *
 * `AI_PROCESSING` is the one that earns its keep. It is written before the
 * provider call and overwritten whichever way that call ends, so a sender is
 * never left standing in it: a state you can enter and not leave is worse than
 * no state at all, and this one is entered on every single question.
 */
export const AI_MENU = "ai_menu";
export const AI_TEXT_INPUT = "ai_text_input";
export const AI_VOICE_INPUT = "ai_voice_input";
export const AI_PROCESSING = "ai_processing";
export const AI_CONVERSATION = "ai_conversation";
export const AI_NEW_CONVERSATION = "ai_new_conversation";

export const AI_STATES = [
  AI_MENU,
  AI_TEXT_INPUT,
  AI_VOICE_INPUT,
  AI_PROCESSING,
  AI_CONVERSATION,
  AI_NEW_CONVERSATION,
] as const;

export type AssistantStep = (typeof AI_STATES)[number];

/** Whether a step is one of this feature's, whatever wrote it. */
export const isAssistantStep = (step: string | null | undefined): step is AssistantStep =>
  !!step && (AI_STATES as readonly string[]).includes(step);

/**
 * Where a sender goes back to when they cancel.
 *
 * Cancelling mid-question returns to the assistant's own menu rather than to
 * the top of the tree: `#` means "stop this", not "forget where I was".
 */
export const stepAfterCancel = (step: string | null | undefined): AssistantStep | null =>
  isAssistantStep(step) ? AI_MENU : null;


/** Whether a node id belongs to this feature. */
export const isAssistantNode = (id: string | null | undefined): boolean =>
  !!id && (id === "assistant" || id.startsWith("assistant."));

/**
 * Whether the assistant currently owns whatever the sender sends next.
 *
 * When it does, the capability parsers upstream — weather, the camera modes,
 * the bazaar — are skipped. Somebody who chose "Ask AI" and then typed «الطقس»
 * asked the assistant about the weather; answering with a forecast card would
 * be a different feature interrupting a conversation it was not part of.
 */
export const assistantOwnsInput = (feature: string | null | undefined): boolean =>
  feature === "assistant.ask" || feature === "assistant.voice";

// ── Limits ────────────────────────────────────────────────────────────────
//
// Every one of these is a named constant with an environment override. A
// number written inline in three places is a number that will disagree with
// itself the first time somebody changes two of them.

/** Longest question accepted. Beyond this the sender is asked to shorten it. */
export const DEFAULT_MAX_QUESTION_CHARS = 2_000;

/** WhatsApp's own ceiling is 4096; this leaves room for a part marker. */
export const DEFAULT_MAX_MESSAGE_CHARS = 3_500;

/** How many messages one answer may be split into. */
export const DEFAULT_MAX_REPLY_PARTS = 3;

/**
 * How long an answer has to look like before it is worth saying "working on it".
 *
 * A processing notice on a question that answers in two seconds is noise, and
 * on this channel it is noise that costs a notification sound. Length of the
 * question is the only signal available before the model is called.
 */
export const DEFAULT_SLOW_QUESTION_CHARS = 120;

export interface AssistantLimits {
  maxQuestionChars: number;
  maxMessageChars: number;
  maxReplyParts: number;
  slowQuestionChars: number;
}

const readNumber = (
  read: (name: string) => string | undefined,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const raw = Number(read(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), min), max);
};

/** The limits, with every one overridable and every override bounded. */
export function assistantLimits(
  read: (name: string) => string | undefined = defaultEnv,
): AssistantLimits {
  return {
    maxQuestionChars: readNumber(read, "WHATSAPP_AI_MAX_QUESTION_CHARS", DEFAULT_MAX_QUESTION_CHARS, 200, 12_000),
    // Never above WhatsApp's own limit, whatever the environment says.
    maxMessageChars: readNumber(read, "WHATSAPP_AI_MAX_MESSAGE_CHARS", DEFAULT_MAX_MESSAGE_CHARS, 500, 4_000),
    maxReplyParts: readNumber(read, "WHATSAPP_AI_MAX_REPLY_PARTS", DEFAULT_MAX_REPLY_PARTS, 1, 5),
    slowQuestionChars: readNumber(read, "WHATSAPP_AI_SLOW_QUESTION_CHARS", DEFAULT_SLOW_QUESTION_CHARS, 0, 4_000),
  };
}

function defaultEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno;
  return deno?.env?.get(name);
}

// ── Input ─────────────────────────────────────────────────────────────────

export type QuestionProblem = "empty" | "too_long";

export type QuestionCheck =
  | { ok: true; question: string }
  | { ok: false; problem: QuestionProblem };

/**
 * Normalise and check a question before a provider is paid to read it.
 *
 * Control characters are stripped because they carry nothing a person typed
 * and are a favourite way to hide instructions in text; whitespace is
 * collapsed at the ends only, so a deliberately formatted question survives.
 */
export function checkQuestion(raw: string | null | undefined, limits: AssistantLimits): QuestionCheck {
  const cleaned = (raw ?? "")
    // Control characters carry nothing a person typed and are a favourite way
    // to hide instructions inside text. Tabs and newlines are kept: a
    // deliberately formatted question is still a question.
    // eslint-disable-next-line no-control-regex -- stripping them is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!cleaned) return { ok: false, problem: "empty" };
  if (cleaned.length > limits.maxQuestionChars) return { ok: false, problem: "too_long" };
  return { ok: true, question: cleaned };
}

// ── Splitting a long answer ───────────────────────────────────────────────

/**
 * Cut an answer into messages that each end somewhere a reader can stop.
 *
 * Paragraph first, then sentence, then — only if a single sentence is longer
 * than a whole message — a space. Never mid-word, and never mid-list-item: a
 * numbered list broken across the boundary keeps its numbers with their text,
 * because "3." arriving alone at the end of a message is worse than a slightly
 * shorter message.
 *
 * Anything past the last part is dropped rather than sent as a fourth message
 * nobody asked for, and the model is told to be brief in the first place, so
 * reaching that is a bug in the prompt rather than the normal case.
 */
export function splitAnswer(text: string, limits: AssistantLimits): string[] {
  const body = (text ?? "").trim();
  if (!body) return [];
  if (body.length <= limits.maxMessageChars) return [body];

  const parts: string[] = [];
  let rest = body;

  while (rest.length > 0 && parts.length < limits.maxReplyParts) {
    if (rest.length <= limits.maxMessageChars) {
      parts.push(rest);
      break;
    }

    const window = rest.slice(0, limits.maxMessageChars);
    const cut = bestCut(window);
    parts.push(window.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  return parts.filter(Boolean);
}

/** The latest boundary in the window that a reader would recognise as one. */
function bestCut(window: string): number {
  const floor = Math.floor(window.length * 0.5);

  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph > floor) return paragraph;

  // A line break in front of a numbered or bulleted item is a real boundary:
  // "3." arriving alone at the end of a message is worse than a short message.
  const listItem = lastListBreak(window);
  if (listItem > floor) return listItem;

  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("؟ "),
    window.lastIndexOf("۔ "),
    window.lastIndexOf(".\n"),
  );
  if (sentence > floor) return sentence + 1;

  const space = window.lastIndexOf(" ");
  return space > floor ? space : window.length;
}

// ── What the feature says ─────────────────────────────────────────────────
//
// Both languages, always. A string this file cannot say in the sender's
// language is a string this file may not send.


/** The last line break that starts a list item, or -1. */
function lastListBreak(window: string): number {
  const pattern = /\n[ \t]*(?:[0-9]{1,2}[.)]|[-\u2022*])\s/g;
  let last = -1;
  for (const match of window.matchAll(pattern)) last = match.index ?? last;
  return last;
}

// Every one of these now lives in `whatsappStrings.ts`, with the rest of what a
// sender reads, and is translated by the same table. They were moved rather
// than copied: two of them used to end in "or 0 to go back", and the numeric
// interface teaching itself inside the feature people use most is exactly the
// kind of thing that survives a redesign when the words live off to one side.
const STRINGS = {
  askForQuestion: UI_STRINGS.askForQuestion,
  askForVoice: UI_STRINGS.askForVoice,
  emptyQuestion: UI_STRINGS.emptyQuestion,
  tooLong: UI_STRINGS.tooLong,
  working: UI_STRINGS.processing,
  newThread: UI_STRINGS.newThread,
  voiceExpected: UI_STRINGS.voiceExpected,
} as const;

export type AssistantString = keyof typeof STRINGS;

export const assistantSays = (key: AssistantString, language: Language): string =>
  localized(STRINGS[key], language);

/**
 * Whether to warn that this one will take a moment.
 *
 * One notice, never two: the caller sends it once before the model call and
 * never inside a retry, because two "working on it" messages read as the
 * assistant being stuck rather than busy.
 */
export const shouldAnnounceWork = (question: string, limits: AssistantLimits): boolean =>
  question.length >= limits.slowQuestionChars && limits.slowQuestionChars > 0;
