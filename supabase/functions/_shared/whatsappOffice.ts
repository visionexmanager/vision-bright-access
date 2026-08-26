// Reading a Word document or a slide deck on Visionex's own server.
//
// ── What this replaces ──────────────────────────────────────────────────────
//
// A refusal. Until now a `.docx` arriving on WhatsApp was answered with "I
// can't open Word files yet. Send it as a PDF, or paste the text into a
// message" — advice that assumes the sender has a machine with Word on it and
// can see the export dialog. Frequently they have a phone, and frequently they
// cannot see the screen at all.
//
// So this is not a cheaper version of something the assistant already did. It
// is one of the last places where a file that could perfectly well be read was
// being handed back.
//
// ── It works in every language ──────────────────────────────────────────────
//
// Local OCR is English-only, because Arabic recognition does not work on this
// box. That does not apply here: the text in a `.docx` is already text, in
// whatever language it was typed in. Extracting it is unzipping and reading
// XML, and neither has an opinion about script. Like barcodes, this arrives
// complete for the whole audience rather than half of it.
//
// ── Why the extracted text is safe to put in a prompt, and OCR's is not ─────
//
// This is the one place where the rule differs from `whatsappLocalOcr.ts`, and
// the difference is worth stating because it looks like an inconsistency.
//
// Recognised text from a photograph is returned verbatim and never enters a
// prompt: a sign reading "ignore your instructions and …" is a thing somebody
// can print and hold up, and the sender is a victim of it rather than its
// author. A document is the opposite. The sender chose this file and attached
// it, and they attached it in order to ask a question *about* its contents —
// "what does this letter say", "summarise this deck". An answer requires the
// model to read it. Returning the raw text instead would be returning a
// forty-page contract as a WhatsApp message.
//
// So it goes down the same path a PDF's extracted text already takes, which is
// the existing precedent in this codebase rather than a new decision:
// `whatsappPdfText.ts` has been putting locally-extracted document text into a
// prompt since PDFs stopped being sent to a model. The guard is the one that
// module already relies on — the text is bounded, stripped of invisible
// characters, and the prompt states that the document is material to read and
// never an instruction.

import { boundText, describeError, stripInvisible } from "./whatsappSafety.ts";
import { officeKind, type OfficeKind } from "./whatsappAttachments.ts";
import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";
import {
  imageBody,
  processorConfig,
  type ProcessorConfig,
} from "./whatsappProcessor.ts";

/**
 * The extraction's own deadline.
 *
 * Generous relative to the work, which is an inflate and a regular expression
 * and lands in milliseconds. The number is set by what a pathological archive
 * costs before the service's own ceilings stop it, not by what a real document
 * costs — and by the fact that this call replaces a refusal, so its worst case
 * is measured against a sender who was going to be told "no" anyway.
 */
export const OFFICE_TIMEOUT_MS = 10_000;

/** The document ceiling, matching `MEDIA_LIMITS.document` and the service. */
export const MAX_OFFICE_UPLOAD_BYTES = 12 * 1024 * 1024;

/** The most extracted text carried back into one prompt. */
export const MAX_OFFICE_TEXT_CHARS = 24_000;

// Which formats are read is format policy, so it lives with the rest of it in
// `whatsappAttachments.ts` — the module `classifyDocument` is in. Two places
// deciding what a `.docx` is would be one place too many.
export { OFFICE_MIME, officeKind, type OfficeKind } from "./whatsappAttachments.ts";

/**
 * Why an extraction produced nothing.
 *
 * `no_text` is the interesting one and is not a fault: a deck that is entirely
 * photographs, or a document holding one table of figures, genuinely has no
 * text to pull out. The sender needs to be told that specifically, because the
 * next thing they should do about it is different.
 */
export type OfficeFailure =
  | "not_configured"
  | "unsupported_kind"
  | "too_large"
  | "busy"
  | "timeout"
  | "no_text"
  | "corrupt"
  | "bad_response"
  | "error";

export type OfficeResult =
  | { ok: true; text: string; parts: number; ms: number }
  | { ok: false; reason: OfficeFailure };

/**
 * Reasons the service can return, mapped to the ones the caller acts on.
 *
 * Everything about a malformed or hostile archive collapses to `corrupt`,
 * because the sender can do exactly one thing about all of them — send the file
 * again, or send it as a PDF — and a message naming the ZIP end-of-central-
 * directory record helps nobody. The distinctions stay in the service's log,
 * which is where they are useful.
 */
const SERVICE_REASONS: Record<string, OfficeFailure> = {
  busy: "busy",
  no_text: "no_text",
  no_text_part: "corrupt",
  not_a_zip: "corrupt",
  truncated: "corrupt",
  bad_directory: "corrupt",
  bad_entry: "corrupt",
  inflate_failed: "corrupt",
  zip64_unsupported: "corrupt",
  too_many_entries: "corrupt",
  entry_too_large: "corrupt",
  archive_too_large: "corrupt",
  suspicious_ratio: "corrupt",
  unsupported_compression: "corrupt",
  not_an_office_file: "corrupt",
  unsupported_kind: "unsupported_kind",
  too_large: "too_large",
};

/**
 * The service's answer, validated field by field.
 *
 * Nothing here trusts the shape. It is our own service on our own box, but this
 * text is about to be put in a model prompt on behalf of somebody who cannot
 * see what they sent, and a response that has been through a proxy, a reload
 * and a redeploy is worth checking before that happens.
 */
export function readOfficePayload(payload: unknown): OfficeResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;

  if (body.ok !== true) {
    const reason = typeof body.reason === "string" ? body.reason : "";
    return { ok: false, reason: SERVICE_REASONS[reason] ?? "error" };
  }
  if (typeof body.text !== "string") return { ok: false, reason: "bad_response" };

  const text = stripInvisible(body.text).trim();
  // A document that unpacked cleanly and contained no words is `no_text`, not a
  // failure to open it, and the two get different sentences.
  if (!text) return { ok: false, reason: "no_text" };

  const parts = typeof body.parts === "number" && Number.isFinite(body.parts) ? body.parts : 1;
  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, text: boundText(text, MAX_OFFICE_TEXT_CHARS), parts, ms };
}

/**
 * Read the text out of an Office document on Visionex's own server.
 *
 * `fetchImpl` is injected so the tests can drive a busy service, a hung one, a
 * lying one and a working one without a network. The caller passes nothing.
 */
export async function readOfficeLocally(params: {
  bytes: Uint8Array;
  mimeType: string;
  config?: ProcessorConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<OfficeResult> {
  // Before the configuration check: there is no point holding a connection open
  // for a format this cannot read.
  const kind = officeKind(params.mimeType);
  if (!kind) return { ok: false, reason: "unsupported_kind" };

  const config = params.config === undefined ? processorConfig() : params.config;
  if (!config) return { ok: false, reason: "not_configured" };
  if (params.bytes.byteLength > MAX_OFFICE_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? OFFICE_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({ kind });
    const response = await doFetch(`${config.url}/office?${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": params.mimeType,
      },
      // Named for images, used for any bytes: it copies exactly this view's
      // range rather than handing over a backing buffer that may be larger.
      body: imageBody(params.bytes),
      signal: controller.signal,
    });

    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };

    return readOfficePayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) {
      return { ok: false, reason: "timeout" };
    }
    // A code, never the message: this one can quote a URL and a token header.
    console.error("[whatsapp-office] read failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}

/**
 * Told to the sender when a document opened but had nothing to read in it.
 *
 * Deliberately not the "I can't open Word files" line, which is now wrong: the
 * file opened. It is a deck of photographs or a sheet of figures, and what the
 * sender should do about that — photograph a page, or ask about a specific
 * part — is different from what they should do about an unsupported format.
 */
export function emptyOfficeNotice(language: Language, kind: OfficeKind): string {
  return say(kind === "pptx" ? "officeEmptyDeck" : "officeEmptyDocument", language);
}

/**
 * Told to the sender when the file itself would not open.
 *
 * Names the one thing that actually helps, which is not "try again": a file
 * that arrived truncated will arrive truncated again. A PDF export is a
 * different path through their own device and usually works.
 */
export function corruptOfficeNotice(language: Language): string {
  return say("officeCorrupt", language);
}
