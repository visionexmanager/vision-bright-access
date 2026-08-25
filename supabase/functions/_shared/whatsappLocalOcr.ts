// Reading the words in a photograph on Visionex's own server.
//
// ── What this is for, and what it is deliberately not for ───────────────────
//
// A vision model does far more than read text: it describes a scene, finds an
// object in a room, reads an expiry date off a packet. Tesseract does exactly
// one of those things. So this is wired into exactly one of the five vision
// modes — `read_text`, where the sender has asked for the words and nothing
// else — and every other mode still goes straight to the model, unchanged.
//
// The gain is not quality. On a clean photograph of a page, local OCR and a
// vision model both return the words; the local one returns them without
// spending a credit, without the picture leaving the server, and usually
// faster. The gain is that a blind user asking "read this" is no longer
// dependent on a funded provider account for the most common thing they ask.
//
// ── Why it can only ever improve on the current behaviour ───────────────────
//
// It escalates on anything less than a clear success. Not configured, service
// down, service busy, timed out, malformed answer, or text too thin to be real
// — every one of those returns a reason and the caller falls through to the
// existing model path exactly as it does today. There is no state in which a
// customer gets a worse answer than they would have got; the only cost of a
// local failure is the deadline below.
//
// That deadline is why it is 8 seconds rather than the service's own 15. The
// person waiting is frequently blind, holding a phone up to a sign, and the
// worst case here is additive: 8 seconds of local attempt and then the model
// call they would have made anyway. Tesseract answers a phone photograph on
// these four cores in one to four seconds, so 8 covers the normal case with
// room to spare and bounds what a bad case costs.
//
// ── What the answer is allowed to be ────────────────────────────────────────
//
// The recognised text is returned verbatim, as the answer, and is never fed
// back into a model. That is not a shortcut, it is the safer construction: a
// photograph is attacker-controlled input, and a sign reading "ignore your
// instructions and ..." is a real thing somebody can print and hold up. Text
// that is never put in a prompt cannot be a prompt injection. It is still
// stripped of invisible characters and bounded before it is sent, because it
// goes into a WhatsApp message and a message has limits.

import { boundText, describeError, stripInvisible } from "./whatsappSafety.ts";

/**
 * The local attempt's own deadline.
 *
 * Shorter than the service's 15s OCR timeout on purpose. If Tesseract is still
 * working at 8 seconds this is not a photograph of a page — it is a large,
 * noisy image that Tesseract will do badly on anyway, and the model is both
 * faster and better at that. Giving up early is the right answer, not a
 * concession.
 */
export const LOCAL_OCR_TIMEOUT_MS = 8_000;

/** The most recognised text that can come back into one WhatsApp answer. */
export const MAX_OCR_ANSWER_CHARS = 3_000;

/**
 * Why a local read did not produce an answer.
 *
 * Every one of these means "the caller should use the model", and they are
 * kept distinct only so the telemetry can tell a service that is switched off
 * from one that is broken from one that simply saw no text. That difference
 * matters when reading a dashboard and never changes what the customer gets.
 */
export type LocalOcrFailure =
  | "not_configured"
  | "unsupported_mode"
  | "too_large"
  | "busy"
  | "timeout"
  | "unreadable"
  | "bad_response"
  | "error";

export type LocalOcrResult =
  | { ok: true; text: string; ms: number }
  | { ok: false; reason: LocalOcrFailure };

export interface LocalOcrConfig {
  url: string;
  token: string;
}

/**
 * The environment is probed rather than referenced.
 *
 * `Deno` is undefined under Vitest, and a bare `Deno.env.get` at module scope
 * would throw at import time and take the whole test file with it — the same
 * reason `meta.ts` does this. Passing an explicit reader also lets the tests
 * drive every configuration state without touching a real environment.
 */
export type EnvReader = (name: string) => string | undefined;

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/**
 * Configuration, or nothing at all.
 *
 * Returning null is a supported, quiet state — not an error. It is what every
 * deployment looks like until the secrets are set, and what a deployment that
 * wants local OCR switched off looks like afterwards. The caller treats it the
 * same as a failure: use the model.
 *
 * The URL must be HTTPS. The image is a photograph somebody sent privately,
 * and it is not going over a plaintext hop because a config value had a typo
 * in the scheme. A hostname is required for the same reason: an IP literal
 * cannot be checked against a certificate the way a name can.
 */
export function localOcrConfig(read: EnvReader = denoEnv): LocalOcrConfig | null {
  const url = (read("MEDIA_PROCESSOR_URL") ?? "").trim();
  const token = (read("MEDIA_PROCESSOR_TOKEN") ?? "").trim();
  if (!url || !token) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  // Rejects `https://127.0.0.1/…` and `https://[::1]/…`: the Edge Function is
  // not on the box, so a loopback address here is always a misconfiguration,
  // and one that would otherwise fail slowly on every single photograph.
  if (!parsed.hostname || /^[\d.]+$/.test(parsed.hostname) || parsed.hostname.includes(":")) {
    return null;
  }

  return { url: parsed.toString().replace(/\/+$/, ""), token };
}

/** Whether local OCR is available at all. Read by the webhook for telemetry. */
export const localOcrAvailable = (read: EnvReader = denoEnv): boolean => localOcrConfig(read) !== null;

/**
 * The upload ceiling, matching the service and the nginx `client_max_body_size`.
 *
 * Checked here as well so an oversized photograph is refused before it is put
 * on the wire, rather than after nginx has read eight megabytes of it and
 * closed the connection.
 */
export const MAX_OCR_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Tesseract's language argument.
 *
 * `ara+eng` is the default for a reason particular to this audience: signage,
 * packaging and government forms in the region are routinely bilingual, and a
 * single-language pass drops half of a label. Both scripts cost one pass, so
 * the combined model is used unless the conversation is unambiguously one or
 * the other — and even then, English text inside an Arabic conversation is
 * common enough that `ara+eng` stays the answer for Arabic.
 */
export function ocrLanguageFor(answerLanguage: string): "ara+eng" | "eng" {
  return answerLanguage === "ar" ? "ara+eng" : "eng";
}

/**
 * Is this recognised text real, or is it what Tesseract does to a photograph
 * of a carpet?
 *
 * The service applies the same rule before it answers. It is applied again
 * here because "the service said so" is a weaker guarantee than "this text
 * survives the check", and because the caller — not the service — is the one
 * about to read it out to somebody.
 */
export function ocrTextIsUsable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  const meaningful = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  return meaningful.length >= 3;
}

/**
 * The service's answer, validated field by field.
 *
 * Nothing here trusts the shape. It is our own service on our own box, but it
 * is still a separate process across a network boundary, and a response that
 * has been through a proxy, a reload and a redeploy is worth checking before
 * its contents are read aloud to somebody who cannot see the screen.
 */
export function readOcrPayload(payload: unknown): LocalOcrResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;

  if (body.ok !== true) {
    return { ok: false, reason: body.reason === "busy" ? "busy" : "error" };
  }
  // `readable: false` is the service saying it looked and found nothing. That
  // is a successful call with no text in it, and the model gets a turn.
  if (body.readable !== true) return { ok: false, reason: "unreadable" };
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };

  const text = stripInvisible(body.text).trim();
  if (!ocrTextIsUsable(text)) return { ok: false, reason: "unreadable" };

  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_OCR_ANSWER_CHARS), ms };
}

/**
 * Read the text in an image on Visionex's own server.
 *
 * `fetchImpl` is injected so the tests can drive a busy service, a hung one, a
 * lying one and a working one without a network. The caller passes nothing.
 */
export async function readTextLocally(params: {
  bytes: Uint8Array;
  mimeType: string;
  answerLanguage: string;
  config?: LocalOcrConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LocalOcrResult> {
  const config = params.config === undefined ? localOcrConfig() : params.config;
  if (!config) return { ok: false, reason: "not_configured" };
  if (params.bytes.byteLength > MAX_OCR_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? LOCAL_OCR_TIMEOUT_MS);

  try {
    const language = ocrLanguageFor(params.answerLanguage);

    // An explicit ArrayBuffer, for two separate reasons.
    //
    // A `Uint8Array` is not assignable to `BodyInit` under the lib types CI
    // resolves — the npm and pnpm trees differ here and only the pnpm job sees
    // it — and declaring the buffer is the honest fix rather than a cast that
    // silences the checker without answering it.
    //
    // And it copies exactly this view's range. `inspected.bytes` is the output
    // of EXIF stripping; if that ever returns a subarray of the original, the
    // backing buffer still holds the metadata that was supposed to be gone.
    // Sending `.buffer` would send it. This cannot.
    const body = new ArrayBuffer(params.bytes.byteLength);
    new Uint8Array(body).set(params.bytes);
    const response = await doFetch(`${config.url}/ocr?lang=${language}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": params.mimeType,
      },
      body,
      signal: controller.signal,
    });

    // 503 is the service saying its two workers are full. Not an error, not
    // worth a retry inside a customer's message: the model takes this one.
    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };

    return readOcrPayload(await response.json());
  } catch (e) {
    // An aborted request is the deadline, not a fault, and should not be
    // reported as one — it is the single most likely outcome on a large photo.
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) {
      return { ok: false, reason: "timeout" };
    }
    // A code, never the message: this one can quote a URL and a token header.
    console.error("[whatsapp-local-ocr] read failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
