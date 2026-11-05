// Answering a conversation on Visionex's own server when every paid provider failed.
//
// ── Where this sits ─────────────────────────────────────────────────────────
//
// Behind the provider chain, never in front of it. `withLocalChat` wraps an
// `AskProvider`: the chain runs exactly as before, and only if it throws or
// returns nothing is the server's own model (Qwen3-4B-Instruct) asked. A
// sender who would have received "I could not answer" gets an answer, slower and
// plainer; a sender the chain answered never touches this module.
//
// ── Off by default, in two places ───────────────────────────────────────────
//
// `LOCAL_CHAT` must be `on` in the function's environment, and the model's
// container must be running (`deploy-local-chat.yml`). When the switch is off
// `withLocalChat` returns the provider it was given, unchanged, so the off state
// is the old code path rather than a new one that happens to do nothing.
//
// ── What is sent ────────────────────────────────────────────────────────────
//
// The model reads its prompt at only ~33 tokens a second on this CPU (measured),
// so the request is cut hard: the start of the system prompt (the caller puts
// rules first and retrieved reference material last) and the latest turns. The
// service enforces the same bounds again. The conversation goes to Visionex's
// own server over HTTPS and nowhere else.

import { describeError, stripInvisible, boundText } from "./whatsappSafety.ts";
import { processorConfig, type EnvReader, type ProcessorConfig } from "./whatsappProcessor.ts";
import type { AskProvider, AskRequest, AskResult } from "./whatsappAsk.ts";
import { localReferenceEnabled } from "./whatsappLocalReference.ts";
import { gatherSources, SOURCES_TIMEOUT_MS, type NewsItem } from "./whatsappLocalSources.ts";

/** Inside `askAssistant`'s thirty seconds; the service allows itself sixty. */
export const LOCAL_CHAT_TIMEOUT_MS = 25_000;
export const MAX_LOCAL_CHAT_ANSWER_CHARS = 3_000;
export const LOCAL_CHAT_PROVIDER = "local";
export const LOCAL_CHAT_MODEL = "qwen3-4b";

export type LocalChatFailure =
  | "disabled"
  | "not_configured"
  | "busy"
  | "timeout"
  | "unreadable"
  | "bad_response"
  | "error";

export type LocalChatResult =
  | { ok: true; text: string; ms: number }
  | { ok: false; reason: LocalChatFailure };

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/** The switch. Anything but the exact word `on` leaves the feature off. */
export const localChatEnabled = (read: EnvReader = denoEnv): boolean =>
  (read("LOCAL_CHAT") ?? "").trim().toLowerCase() === "on";

/**
 * Where the local model sits in the order.
 *
 *   fallback  (default)  the paid chain first; the local model only if it failed
 *   first                the local model first; the paid chain only if it failed
 *   only                 the local model alone; the paid chain is never called
 *
 * `LOCAL_CHAT` must still be `on`. Anything but the exact words `first` or
 * `only` is `fallback`, so a typo cannot move a paid provider out of the way.
 */
export type LocalChatMode = "fallback" | "first" | "only";
export const localChatMode = (read: EnvReader = denoEnv): LocalChatMode => {
  const value = (read("LOCAL_CHAT_MODE") ?? "").trim().toLowerCase();
  return value === "first" || value === "only" ? value : "fallback";
};

/** The service's answer, checked field by field before anyone reads it. */
export function readChatPayload(payload: unknown): LocalChatResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) {
    return { ok: false, reason: body.reason === "busy" ? "busy" : body.reason === "unreadable" ? "unreadable" : "error" };
  }
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };
  const text = stripInvisible(body.text).trim();
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 1) return { ok: false, reason: "unreadable" };
  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_LOCAL_CHAT_ANSWER_CHARS), ms };
}

/**
 * Ask the server's own model. `fetchImpl`, `config` and `read` are injected so
 * the tests can drive every state; the webhook passes none of them.
 */
export async function chatLocally(params: {
  request: AskRequest;
  /** Passages looked up for this question, placed in the model's prompt. */
  reference?: string;
  /** Today, as YYYY-MM-DD, so the model does not assume its training year. */
  today?: string;
  config?: ProcessorConfig | null;
  read?: EnvReader;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LocalChatResult> {
  const read = params.read ?? denoEnv;
  if (!localChatEnabled(read)) return { ok: false, reason: "disabled" };
  const config = params.config === undefined ? processorConfig(read) : params.config;
  if (!config) return { ok: false, reason: "not_configured" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? LOCAL_CHAT_TIMEOUT_MS);
  try {
    const response = await doFetch(`${config.url}/chat`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        system: params.request.system,
        messages: params.request.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: Math.min(params.request.maxTokens, 320),
        ...(params.reference ? { reference: params.reference } : {}),
        ...(params.today ? { today: params.today } : {}),
      }),
      signal: controller.signal,
    });
    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };
    return readChatPayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) return { ok: false, reason: "timeout" };
    // A code, never the message: it can quote a URL and a token header.
    console.error("[whatsapp-local-chat] failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}

/**
 * The provider, with the server's own model behind it.
 *
 * Returns `primary` itself when the switch is off. When on, the chain's error
 * (or empty answer) is kept: if the local model cannot answer either, the caller
 * sees exactly what it would have seen without this module.
 */
export function withLocalChat(
  primary: AskProvider,
  options: {
    read?: EnvReader;
    fetchImpl?: typeof fetch;
    config?: ProcessorConfig | null;
    log?: (event: string, data: Record<string, unknown>) => void;
    /** The sender's language, so the lookup asks the right Wikipedia. */
    language?: string;
    /** For the lookup only; the default is the real network. */
    referenceFetch?: typeof fetch;
    now?: () => Date;
    /** The site's own latest articles in the sender's language; the webhook supplies it. */
    visionexNews?: () => Promise<NewsItem[]>;
  } = {},
): AskProvider {
  const read = options.read ?? denoEnv;
  if (!localChatEnabled(read)) return primary;

  const mode = localChatMode(read);

  return async (request: AskRequest): Promise<AskResult> => {
    let failure: unknown = null;
    if (mode === "first" || mode === "only") {
      // The local model leads. Under `first` a failure falls through to the chain
      // below; under `only` it is the end, and the caller sees an empty answer.
      const local = await askLocal(request);
      if (local) return local;
      if (mode === "only") return { text: "", provider: "unknown", model: "unknown" };
    }

    try {
      const result = await primary(request);
      if ((result?.text ?? "").trim()) return result;
    } catch (error) {
      failure = error;
    }

    if (mode === "fallback") {
      const local = await askLocal(request);
      if (local) return local;
    }

    if (failure !== null) throw failure;
    return { text: "", provider: "unknown", model: "unknown" };
  };

  async function askLocal(request: AskRequest): Promise<AskResult | null> {
    // Fresh facts, when the second switch is on: today's date always, and
    // labelled lines from the public sources that fit the question. None of it
    // can fail the answer; it only makes it better informed.
    const clock = options.now ?? (() => new Date());
    const today = clock().toISOString().slice(0, 10);
    let reference = "";
    let used: Record<string, number> = {};
    let spent = 0;
    if (localReferenceEnabled(read)) {
      const startedAt = Date.now();
      const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
      const found = lastUser
        ? await gatherSources({
          question: lastUser.content, language: options.language, fetchImpl: options.referenceFetch,
          read, now: clock, visionexNews: options.visionexNews,
        })
        : null;
      spent = Math.min(Date.now() - startedAt, SOURCES_TIMEOUT_MS);
      if (found) {
        reference = found.text;
        used = found.used;
      }
    }

    const local = await chatLocally({
      request, read, fetchImpl: options.fetchImpl, config: options.config,
      reference, today,
      // The ask as a whole has thirty seconds; the lookup already used some.
      timeoutMs: Math.max(10_000, LOCAL_CHAT_TIMEOUT_MS - spent),
    });
    // Counts and timings only, never the question or the passages.
    options.log?.("ai_local_chat", local.ok
      ? { ok: true, mode, ms: local.ms, chars: local.text.length, grounded: reference !== "", used }
      : { ok: false, mode, reason: "reason" in local ? local.reason : "error", grounded: reference !== "", used });
    return local.ok ? { text: local.text, provider: LOCAL_CHAT_PROVIDER, model: LOCAL_CHAT_MODEL } : null;
  }
}
