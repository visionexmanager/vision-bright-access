// Translating text on Visionex's own server, before any provider is asked.
//
// ── Where this sits ─────────────────────────────────────────────────────────
//
// In front of the provider chain, for text that is translated once and kept
// (a news article is written back into its row). It costs nothing per call, so
// there is no reason to pay for the same sentence twice; and when the model is
// off, busy or unreachable the caller simply asks the chain as it always did.
//
// ── Off by default, in two places ───────────────────────────────────────────
//
// `LOCAL_TRANSLATE` must be `on` in the function's environment, and the model
// container must be running (`deploy-translator.yml`). Either missing is a
// quiet failure and nothing changes for the sender.
//
// ── Languages ───────────────────────────────────────────────────────────────
//
// The site's twenty locales; the list must match the media processor's
// (a test compares them). The answer is a model's text about somebody else's
// article, so it is stripped of invisible characters and bounded before it is
// stored or sent, and never fed into another prompt.

import { boundText, describeError, stripInvisible } from "./whatsappSafety.ts";
import { processorConfig, type EnvReader, type ProcessorConfig } from "./whatsappProcessor.ts";

/** The service allows its model 100 seconds; this stops just short of it. */
export const LOCAL_TRANSLATE_TIMEOUT_MS = 105_000;
export const MAX_TRANSLATE_INPUT_CHARS = 6_000;
export const MAX_TRANSLATE_OUTPUT_CHARS = 9_000;

export type LocalTranslateFailure =
  | "disabled"
  | "not_configured"
  | "language_unsupported"
  | "too_long"
  | "busy"
  | "timeout"
  | "unreadable"
  | "bad_response"
  | "error";

export type LocalTranslateResult =
  | { ok: true; text: string; ms: number }
  | { ok: false; reason: LocalTranslateFailure };

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/** The switch. Anything but the exact word `on` leaves the feature off. */
export const localTranslateEnabled = (read: EnvReader = denoEnv): boolean =>
  (read("LOCAL_TRANSLATE") ?? "").trim().toLowerCase() === "on";

export const LOCAL_TRANSLATE_LANGUAGES: readonly string[] = [
  "en", "ar", "bn", "de", "es", "fa", "fr", "hi", "id", "it",
  "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh",
];

/** The service's answer, checked field by field before anyone reads it. */
export function readTranslatePayload(payload: unknown): LocalTranslateResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) return { ok: false, reason: body.reason === "busy" ? "busy" : "error" };
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };

  const text = stripInvisible(body.text).trim();
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return { ok: false, reason: "unreadable" };

  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_TRANSLATE_OUTPUT_CHARS), ms };
}

/**
 * Translate `text` into `language` on the server's own model.
 *
 * `fetchImpl`, `config` and `read` are injected so the tests can drive every
 * state without a network or an environment. The webhook passes none of them.
 */
export async function translateLocally(params: {
  text: string;
  language: string;
  config?: ProcessorConfig | null;
  read?: EnvReader;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LocalTranslateResult> {
  const read = params.read ?? denoEnv;
  if (!localTranslateEnabled(read)) return { ok: false, reason: "disabled" };
  if (!LOCAL_TRANSLATE_LANGUAGES.includes(params.language)) return { ok: false, reason: "language_unsupported" };
  if (params.text.length > MAX_TRANSLATE_INPUT_CHARS) return { ok: false, reason: "too_long" };

  const config = params.config === undefined ? processorConfig(read) : params.config;
  if (!config) return { ok: false, reason: "not_configured" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? LOCAL_TRANSLATE_TIMEOUT_MS);

  try {
    const response = await doFetch(`${config.url}/translate`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: params.text, target: params.language }),
      signal: controller.signal,
    });
    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };
    return readTranslatePayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) return { ok: false, reason: "timeout" };
    // A code, never the message: it can quote a URL and a token header.
    console.error("[whatsapp-local-translate] failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
