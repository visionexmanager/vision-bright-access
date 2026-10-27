// Describing a photograph on Visionex's own server, as the last resort.
//
// ── Where this sits ─────────────────────────────────────────────────────────
//
// Behind the paid chain, never in front of it. `DESCRIBE_TARGETS` (gpt-4.1, then
// gpt-4o-mini, then Gemini) answers first. Only when every one of them has
// failed or declined does the webhook ask the small model on the server, so the
// worst day for the providers (out of credit, rate-limited, down) ends in a
// description instead of "I couldn't read that". It is not a way to save money
// on a working chain: the 2026-10-27 benchmark put Qwen3-VL 4B at 0.88 on a
// crude score and 37 seconds a picture on three cores, which is a fallback's
// quality and a fallback's speed.
//
// ── Off by default, in two places ───────────────────────────────────────────
//
// `LOCAL_DESCRIBE` must be set to `on` in the function's environment, and the
// model container must be running on the server (see
// `deploy-vision-describer.yml`). Either missing is a quiet `not_configured`
// and the caller does exactly what it did before this file existed.
//
// ── Languages ───────────────────────────────────────────────────────────────
//
// English and Arabic: the two that were measured. Anything else is declined
// before a byte leaves the function.
//
// The answer is the model's own words about a photograph, so it is stripped of
// invisible characters and bounded like any other model output before it
// reaches a sender. It is never fed into another prompt.

import { boundText, describeError, stripInvisible } from "./whatsappSafety.ts";
import {
  MAX_PROCESSOR_UPLOAD_BYTES,
  imageBody,
  processorConfig,
  type EnvReader,
  type ProcessorConfig,
} from "./whatsappProcessor.ts";

/**
 * The attempt's own deadline.
 *
 * The service allows its model 85 seconds and the resize before it up to 20;
 * nginx waits 120. This stops just short of the service's worst case so the
 * function, not the proxy, is what gives up.
 */
export const LOCAL_DESCRIBE_TIMEOUT_MS = 100_000;

export const MAX_DESCRIBE_ANSWER_CHARS = 2_500;

export type LocalDescribeFailure =
  | "disabled"
  | "not_configured"
  | "language_unsupported"
  | "too_large"
  | "busy"
  | "timeout"
  | "unreadable"
  | "bad_response"
  | "error";

export type LocalDescribeResult =
  | { ok: true; text: string; ms: number }
  | { ok: false; reason: LocalDescribeFailure };

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/** The switch. Anything but the exact word `on` leaves the feature off. */
export const localDescribeEnabled = (read: EnvReader = denoEnv): boolean =>
  (read("LOCAL_DESCRIBE") ?? "").trim().toLowerCase() === "on";

/** The language codes the service will answer in. */
export function localDescribeLanguage(answerLanguage: string): "en" | "ar" | null {
  return answerLanguage === "en" || answerLanguage === "ar" ? answerLanguage : null;
}

/** The service's answer, checked field by field before anyone reads it aloud. */
export function readDescribePayload(payload: unknown): LocalDescribeResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;

  if (body.ok !== true) {
    return { ok: false, reason: body.reason === "busy" ? "busy" : "error" };
  }
  if (body.readable !== true) return { ok: false, reason: "unreadable" };
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };

  const text = stripInvisible(body.text).trim();
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 8) return { ok: false, reason: "unreadable" };

  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_DESCRIBE_ANSWER_CHARS), ms };
}

/**
 * Describe an image on the server's own model.
 *
 * `fetchImpl`, `config` and `read` are injected so the tests can drive every
 * state without a network or an environment. The webhook passes none of them.
 */
export async function describeLocally(params: {
  bytes: Uint8Array;
  mimeType: string;
  answerLanguage: string;
  config?: ProcessorConfig | null;
  read?: EnvReader;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LocalDescribeResult> {
  const read = params.read ?? denoEnv;
  if (!localDescribeEnabled(read)) return { ok: false, reason: "disabled" };

  const language = localDescribeLanguage(params.answerLanguage);
  if (!language) return { ok: false, reason: "language_unsupported" };

  const config = params.config === undefined ? processorConfig(read) : params.config;
  if (!config) return { ok: false, reason: "not_configured" };
  if (params.bytes.byteLength > MAX_PROCESSOR_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? LOCAL_DESCRIBE_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({ lang: language });
    const response = await doFetch(`${config.url}/describe?${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": params.mimeType,
      },
      body: imageBody(params.bytes),
      signal: controller.signal,
    });

    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };

    // `not_configured` from a service with no model running reads as `error`
    // here, which is the same outcome: the caller has nothing to add.
    return readDescribePayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) {
      return { ok: false, reason: "timeout" };
    }
    // A code, never the message: it can quote a URL and a token header.
    console.error("[whatsapp-local-describe] failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
