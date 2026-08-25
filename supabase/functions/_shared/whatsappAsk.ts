// Asking the model, as one function with the provider handed to it.
//
// The webhook used to call `streamChatCompletionWithFallback` inline, which
// meant the only way to test any of it was to read the source and assert that
// the right strings appeared near each other. That is a test of the file, not
// of the behaviour: it passes just as happily when the branch it describes can
// never be reached.
//
// So the call moves here, and the provider arrives as an argument. Production
// passes the adapter in `whatsappAskProvider.ts`, which is the existing
// registry and the existing four-deep fallback chain, unchanged and unreordered.
// A test passes a function that returns whatever the case needs and records
// what it was given. Nothing in this file knows which of those it has, and
// there is no environment variable that switches between them — that is the
// whole point of an argument.
//
// This module deliberately imports **no** provider code. `aiProvider.ts` reads
// `Deno.env`, so importing it here — even as a type — would drag Deno's globals
// into the app's TypeScript project and break the build for everything else.
// The seam is structural instead: a provider is a function of this shape.

import { summaryPreamble, type Turn } from "./whatsapp.ts";
import {
  boundSystemPrompt,
  boundText,
  MAX_PROVIDER_RESPONSE_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_TURN_CHARS,
} from "./whatsappSafety.ts";

/** What a provider is given. Everything the model sees, and nothing else. */
export interface AskRequest {
  /** The full system configuration, already assembled by the caller. */
  readonly system: string;
  /** The replayed conversation, oldest first, already scoped and budgeted. */
  readonly messages: readonly Turn[];
  readonly maxTokens: number;
}

/** What a provider gives back. */
export interface AskResult {
  readonly text: string;
  /** For the log and nothing else: which provider answered, and which model. */
  readonly provider: string;
  readonly model: string;
}

/**
 * The seam.
 *
 * One function, one shape. The production implementation runs the registry's
 * fallback chain; a test's implementation runs nothing at all.
 */
export type AskProvider = (request: AskRequest) => Promise<AskResult>;

/**
 * How the ask ended.
 *
 * A failure carries a reason and, when the provider gave one, an HTTP status —
 * never a message, never a stack, never a body. A provider's error body can
 * quote the prompt back, and the prompt contains the customer's message.
 */
export type AskOutcome =
  | { status: "answered"; text: string; provider: string; model: string; ms: number }
  | { status: "empty"; provider: string; model: string; ms: number }
  | { status: "failed"; reason: "provider_error" | "timeout"; httpStatus: number; ms: number };

export interface AskInput {
  /** System prompt and its directives, in order. Empty parts are dropped. */
  systemParts: readonly (string | null | undefined)[];
  /** The rolling summary, if there is a current one. */
  summary?: string | null;
  /** Replayed turns, already scoped to the thread and budgeted. */
  turns?: readonly Turn[];
  /** This message. Used alone when there is no history to replay. */
  question: string;
  maxTokens?: number;
  /** Beyond this the ask is abandoned. See `DEFAULT_ASK_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Injected for tests; the default is the real clock. */
  now?: () => number;
}

export const DEFAULT_MAX_TOKENS = 700;

/**
 * How long to wait for a provider before giving up on it.
 *
 * Meta redelivers a webhook that does not answer promptly, and a redelivery is
 * a second copy of the same message — so waiting forever does not eventually
 * succeed, it multiplies. Thirty seconds is well inside that and well past a
 * normal answer.
 */
export const DEFAULT_ASK_TIMEOUT_MS = 30_000;

/**
 * Build exactly what the provider will be given. Pure, so a test can read it.
 *
 * ── Every field bounded, here, once ─────────────────────────────────────────
 *
 * This is the last place before the wire, which makes it the only place a bound
 * cannot be forgotten. Each part arrives already bounded by whoever built it —
 * the grounding has its own character budget, the persona is three short
 * fields, the history is budgeted by `budgetTurns` — and every one of those is
 * a bound somebody could remove without this file noticing. So each is applied
 * again, against a named ceiling, over the values that actually travel.
 *
 * The system parts keep their order, and the caller puts the rules first and
 * the retrieved material last: what a ceiling costs under pressure is then
 * reference material rather than a rule.
 */
export function buildRequest(input: AskInput): AskRequest {
  const turns = (input.turns ?? []).map((turn) => ({
    role: turn.role,
    content: boundText(turn.content, MAX_TURN_CHARS),
  })).filter((turn) => turn.content.length > 0);

  const summary = boundText(input.summary ?? "", MAX_SUMMARY_CHARS);
  const question = boundText(input.question, MAX_TURN_CHARS);

  return {
    system: boundSystemPrompt(input.systemParts),
    messages: [
      // The summary is reference material and says so in its own preamble; it
      // is not a turn anybody took.
      ...(summary ? [{ role: "user" as const, content: summaryPreamble(summary) }] : []),
      ...(turns.length > 0 ? turns : [{ role: "user" as const, content: question }]),
    ],
    maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}

/** An HTTP status if the error carried one, else 0. Never the message. */
function statusOf(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : 0;
}

/**
 * Ask, and say plainly how it ended.
 *
 * Every ending is a value: answered, empty, or failed with a reason. Nothing
 * throws out of here, because the caller's job on all three is the same shape —
 * leave the processing state, say something true to the customer — and a
 * function that sometimes throws and sometimes returns makes that harder to get
 * right, not easier.
 */
export async function askAssistant(input: AskInput, provider: AskProvider): Promise<AskOutcome> {
  const clock = input.now ?? Date.now;
  const startedAt = clock();
  const elapsed = () => clock() - startedAt;
  const request = buildRequest(input);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutMs = input.timeoutMs ?? DEFAULT_ASK_TIMEOUT_MS;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AskTimeout()), timeoutMs);
    });

    const result: AskResult = await Promise.race([provider(request), timeout]);
    // Bounded on the way back as well as on the way out. A provider that
    // ignores `maxTokens`, or returns a stream that does not stop, would
    // otherwise put an unbounded string through the splitter, the transcript
    // and the synthesiser. The cut is grapheme-safe, so what survives is whole
    // characters.
    const text = boundText(result?.text ?? "", MAX_PROVIDER_RESPONSE_CHARS);
    const provenance = { provider: result?.provider ?? "unknown", model: result?.model ?? "unknown" };

    // An empty answer is its own outcome, not a failure and not something to
    // send: WhatsApp rejects an empty message, and a blank bubble would be a
    // worse answer than an apology.
    if (!text) return { status: "empty", ...provenance, ms: elapsed() };
    return { status: "answered", text, ...provenance, ms: elapsed() };
  } catch (error) {
    if (error instanceof AskTimeout) {
      return { status: "failed", reason: "timeout", httpStatus: 0, ms: elapsed() };
    }
    return { status: "failed", reason: "provider_error", httpStatus: statusOf(error), ms: elapsed() };
  } finally {
    // The timer holds the isolate awake otherwise, which on an edge runtime is
    // billed time doing nothing.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Thrown only inside this file, and never seen outside it. */
class AskTimeout extends Error {
  constructor() {
    super("ask timed out");
    this.name = "AskTimeout";
  }
}
