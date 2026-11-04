// Summarising a document on Visionex's own server, before any provider is asked.
//
// ── Where this sits ─────────────────────────────────────────────────────────
//
// In front of the provider chain for a document's text. It costs nothing per
// call; when it is off, busy, slow or unreadable the caller asks the chain as it
// always did, so a failure here is a slower answer and never a missing one.
//
// ── Off by default, in two places ───────────────────────────────────────────
//
// `LOCAL_SUMMARIZE` must be `on` in the function's environment, and the vision
// describer's container must be running (`deploy-vision-describer.yml`), since
// it is that model that reads the text. Either missing is a quiet failure.
//
// The document is somebody else's words, and the answer is a model's text about
// them: the answer is stripped of invisible characters and bounded, and never
// fed into another prompt.

import { boundText, describeError, stripInvisible } from "./whatsappSafety.ts";
import { processorConfig, type EnvReader, type ProcessorConfig } from "./whatsappProcessor.ts";

/** The service allows its whole job 95 seconds; this stops just short of a minute more. */
export const LOCAL_SUMMARIZE_TIMEOUT_MS = 100_000;
export const MIN_SUMMARIZE_CHARS = 40;
/** The service reads at most about three pieces; sending more only wastes the upload. */
export const MAX_SUMMARIZE_SEND_CHARS = 14_000;
export const MAX_SUMMARY_ANSWER_CHARS = 3_000;

export type LocalSummarizeFailure =
  | "disabled"
  | "not_configured"
  | "language_unsupported"
  | "too_short"
  | "busy"
  | "timeout"
  | "unreadable"
  | "bad_response"
  | "error";

export type LocalSummarizeResult =
  | { ok: true; text: string; truncated: boolean; ms: number }
  | { ok: false; reason: LocalSummarizeFailure };

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/** The switch. Anything but the exact word `on` leaves the feature off. */
export const localSummarizeEnabled = (read: EnvReader = denoEnv): boolean =>
  (read("LOCAL_SUMMARIZE") ?? "").trim().toLowerCase() === "on";

/** The site's twenty locales; the service answers in these and nothing else. */
export const LOCAL_SUMMARIZE_LANGUAGES: readonly string[] = [
  "en", "ar", "bn", "de", "es", "fa", "fr", "hi", "id", "it",
  "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh",
];

/** The service's answer, checked field by field before anyone reads it. */
export function readSummarizePayload(payload: unknown): LocalSummarizeResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) {
    return { ok: false, reason: body.reason === "busy" ? "busy" : body.reason === "unreadable" ? "unreadable" : "error" };
  }
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };

  const text = stripInvisible(body.text).trim();
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 12) return { ok: false, reason: "unreadable" };

  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_SUMMARY_ANSWER_CHARS), truncated: body.truncated === true, ms };
}

/**
 * Summarise `text` (or answer `task` about it) on the server's own model.
 *
 * `fetchImpl`, `config` and `read` are injected so the tests can drive every
 * state without a network or an environment. The webhook passes none of them.
 */
export async function summarizeLocally(params: {
  text: string;
  language: string;
  /** The sender's question, when they asked something specific. */
  task?: string;
  config?: ProcessorConfig | null;
  read?: EnvReader;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LocalSummarizeResult> {
  const read = params.read ?? denoEnv;
  if (!localSummarizeEnabled(read)) return { ok: false, reason: "disabled" };
  if (!LOCAL_SUMMARIZE_LANGUAGES.includes(params.language)) return { ok: false, reason: "language_unsupported" };
  if (params.text.replace(/\s+/g, " ").trim().length < MIN_SUMMARIZE_CHARS) return { ok: false, reason: "too_short" };

  const config = params.config === undefined ? processorConfig(read) : params.config;
  if (!config) return { ok: false, reason: "not_configured" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? LOCAL_SUMMARIZE_TIMEOUT_MS);

  try {
    const response = await doFetch(`${config.url}/summarize`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        text: params.text.slice(0, MAX_SUMMARIZE_SEND_CHARS),
        lang: params.language,
        task: params.task ?? "",
      }),
      signal: controller.signal,
    });
    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };
    return readSummarizePayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) return { ok: false, reason: "timeout" };
    // A code, never the message: it can quote a URL and a token header.
    console.error("[whatsapp-local-summarize] failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
