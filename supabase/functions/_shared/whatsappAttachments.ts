// Attachment decisions that need no provider.
//
// Deliberately free of any import that touches `Deno` or the AI provider layer:
// the Vitest suite runs under Node and imports this directly, so keeping the
// encoding, the format policy and the user-facing wording here is what makes
// them testable at all. `whatsappUnderstand.ts` holds the model calls and
// imports these.

// The wording itself now lives one file over, in `whatsappStrings.ts`, with the
// rest of the interface's vocabulary — which is what took these refusals from
// two languages to twenty. The *decisions* about which refusal applies are
// still here, and are still what the suite tests.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Plain-text formats decoded locally rather than sent to a model as bytes. */
export const PLAIN_TEXT_MIME = ["text/plain", "text/csv", "text/markdown"];

export type OfficeKind = "docx" | "pptx";

/**
 * The Office formats Visionex's own processing service unpacks.
 *
 * `.xlsx` is deliberately absent, and this is the reason. A spreadsheet keeps
 * its text in a shared-string table and its numbers in the sheets, so pulling
 * the strings out returns a price list with every product name and no prices,
 * an invoice with every line item and no amounts. For somebody who cannot see
 * the file, a confident half-answer is worse than a refusal — the same
 * judgement `whatsappLocalOcr.ts` makes when it declines to read the English
 * half of a bilingual sign. Excel is still declined, by name.
 *
 * `.doc` is absent for a duller reason: it is a pre-2007 binary container, not
 * a ZIP, and nothing here can open one.
 *
 * The map lives in this module rather than beside the client, because this is
 * where format policy lives and because `classifyDocument` below has to agree
 * with it. Two places deciding what a `.docx` is would be one place too many.
 */
export const OFFICE_MIME: Record<string, OfficeKind> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** The format, or null for anything the service does not read. */
export function officeKind(mimeType: string): OfficeKind | null {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  return OFFICE_MIME[mime] ?? null;
}

/** Characters of a text document handed to the model. */
export const DOCUMENT_TEXT_BUDGET = 24_000;

/** Base64 for a byte array, chunked so a large file cannot blow the stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType.split(";")[0].trim()};base64,${toBase64(bytes)}`;
}

/**
 * A `Blob` from a byte view.
 *
 * `new Blob([someUint8Array])` does not typecheck under the lib TypeScript 5.7
 * ships: a `Uint8Array` is `ArrayBufferLike`, which may be a `SharedArrayBuffer`,
 * and `BlobPart` requires a plain `ArrayBuffer`. Copying the exact window the
 * view covers produces one, and respects `byteOffset` — which `bytes.buffer`
 * alone would silently ignore for a subarray.
 */
export function toBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([copy], { type: mimeType });
}

/**
 * How a document should be read.
 *
 * `text` is decoded here — sending a text file to a vision model is paying for
 * OCR that is not needed. `pdf` has its text extracted locally by `pdf-parse`
 * and then travels as text. `office` is unpacked by Visionex's own processing
 * service and then travels as text too: a `.docx` and a `.pptx` are ZIP
 * archives full of XML, and the unpacker the original version of this comment
 * said they would need now exists.
 *
 * Everything else is still declined rather than half-read. That list is
 * shorter than it was but it is not empty, and two entries on it are
 * deliberate: `.doc` is a pre-2007 binary format that is not a ZIP at all, and
 * `.xlsx` keeps its text and its numbers in different places, so extracting the
 * text alone returns an invoice with every line item and no amounts.
 */
export function classifyDocument(mimeType: string): "text" | "pdf" | "office" | "unsupported" {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  if (PLAIN_TEXT_MIME.includes(mime)) return "text";
  if (mime === "application/pdf") return "pdf";
  if (officeKind(mime)) return "office";
  return "unsupported";
}

/**
 * The schema is the anti-hallucination measure. A model asked for prose about
 * an unreadable photo will write prose; a model asked whether it could read the
 * attachment has to answer that first, and the caller can act on the answer.
 */
export const ATTACHMENT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "answer"],
  properties: {
    readable: {
      type: "boolean",
      description: "Whether the attachment could actually be read well enough to answer.",
    },
    answer: {
      type: "string",
      description: "The answer, based only on what the attachment actually shows. Empty when not readable.",
    },
  },
} as const;

/**
 * Videos are capped far below the media limit.
 *
 * A model reads a video by sampling frames, and the cost climbs with length.
 * Support questions are answered by a few seconds of screen recording; anything
 * longer is a different kind of request and is declined with a reason.
 */
export const MAX_VIDEO_BYTES = 6 * 1024 * 1024;

export function videoTooLongNotice(language: Language): string {
  return say("noticeVideoTooLong", language);
}

export function attachmentSystemPrompt(languageName: string, kind: "image" | "document" | "video"): string {
  return [
    `You are the Visionex support assistant reading a customer's ${kind}.`,
    "Answer only from what the attachment actually contains.",
    "If it is blurry, empty, cropped, password-protected or simply not about the question, set readable to false and leave answer empty — do not guess and do not describe what you imagine it might be.",
    "Never invent order numbers, prices, dates, names or policies that are not visible.",
    `Write the answer in ${languageName}.`,
  ].join(" ");
}

/** Told to the user when an attachment could not be read. Never a guess. */
export function unreadableNotice(language: Language, kind: "image" | "document" | "video"): string {
  if (kind === "video") return say("noticeUnreadableVideo", language);
  return say(kind === "image" ? "noticeUnreadableImage" : "noticeUnreadableDocument", language);
}

/**
 * Told to the user when the format is one this assistant *can* read but no
 * funded provider is available to read it.
 *
 * Deliberately not `unreadableNotice`, which says "a PDF or a text file works
 * best" — advice that is actively wrong for someone who just sent a PDF, and
 * that leaves them retrying a thing that cannot succeed. This says the capacity
 * is missing and names the two routes that do work right now.
 */
export function noReaderNotice(language: Language, kind: "document" | "video"): string {
  return say(kind === "video" ? "noticeNoReaderVideo" : "noticeNoReaderDocument", language);
}

/**
 * Told to the user when the format itself is one this assistant will not open.
 *
 * Reworded when Word and PowerPoint started working. The old line — "I can't
 * open Word files yet" — is now false, and a false refusal is worse than a
 * vague one: it sends somebody off to export a PDF they did not need to make.
 * What is left is Excel and the pre-2007 binary formats, and the advice differs
 * between them, so the sentence names the ones that do work instead of
 * listing the ones that do not.
 */
export function unsupportedDocumentNotice(language: Language): string {
  return say("noticeUnsupportedDocument", language);
}

// ── PDF ──────────────────────────────────────────────────────────────────
//
// A PDF used to be Gemini-or-nothing: `structuredOpenAICompatible` sends a
// `data:` URL as `image_url` and OpenAI rejects `application/pdf`, so with the
// Gemini account unfunded `DOCUMENT_TARGETS` was empty and every PDF was
// declined. The way out is not a second vendor — it is to stop sending the PDF
// to a model at all. `npm:pdf-parse` extracts the text locally (the same
// library `library-import-book` already runs in this runtime), and the text
// then travels down the ordinary text chain that any chat model can read.
//
// The decisions live here, provider-free, so the suite can test them: how much
// text is enough to count as extracted, how much of it the model sees, and what
// to say when a PDF turns out to be photographs of paper.

/**
 * Characters of extracted PDF text handed to the model.
 *
 * Larger than `DOCUMENT_TEXT_BUDGET` because a PDF is usually the longer
 * artefact — a contract, an invoice run, a manual — and the first 24 000
 * characters of one can be entirely front matter. Still bounded: this is a
 * support answer, not a document-processing service.
 */
export const PDF_TEXT_BUDGET = 40_000;

/**
 * Below this many characters, the extraction is treated as having failed.
 *
 * A scanned PDF is a stack of photographs with no text layer, and `pdf-parse`
 * returns page breaks and stray ligatures for one rather than an error. Handing
 * that fragment to a model produces a confident summary of nothing, which is
 * the exact failure the `readable` flag exists to prevent — so it is caught
 * here, before a model is ever asked.
 */
export const PDF_MIN_TEXT_CHARS = 120;

/** And below this many characters *per page*, for a long document of images. */
export const PDF_MIN_CHARS_PER_PAGE = 24;

/**
 * Whether extracted PDF text is worth sending to a model.
 *
 * Counts characters that carry meaning, not raw length: a scanned file often
 * comes back as hundreds of newlines and form feeds, which passes a naive
 * `length` check while containing nothing to read.
 */
export function pdfTextIsUsable(text: string, pageCount?: number | null): boolean {
  // `\s` already covers the form feeds a PDF text layer is full of, and the
  // non-breaking spaces, so spelling them out only puts a control character
  // into the source that ESLint is right to object to.
  const meaningful = text.replace(/\s+/g, " ").trim();
  if (meaningful.length < PDF_MIN_TEXT_CHARS) return false;
  if (pageCount && pageCount > 0 && meaningful.length / pageCount < PDF_MIN_CHARS_PER_PAGE) {
    return false;
  }
  return true;
}

/**
 * Told to the user when a PDF is a scan.
 *
 * Deliberately not `unreadableNotice`, which advises sending a PDF — advice
 * that cannot succeed for someone whose PDF is a photograph of a page. This
 * names the route that does work, and it is a route this assistant is
 * genuinely good at: the image path reads a photographed page well.
 */
export function scannedPdfNotice(language: Language): string {
  return say("noticeScannedPdf", language);
}

/** Told to the user when a PDF has pages but no words at all on them. */
export function emptyDocumentNotice(language: Language): string {
  return say("noticeEmptyDocument", language);
}

/** Told to the user when a PDF is password-protected. */
export function encryptedDocumentNotice(language: Language): string {
  return say("noticeEncryptedDocument", language);
}
