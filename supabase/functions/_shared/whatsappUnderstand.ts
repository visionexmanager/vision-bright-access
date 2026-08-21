// Reading a customer's image or document with a model.
//
// The decisions that need no provider — encoding, which formats are readable,
// the schema, the wording — live in `whatsappAttachments.ts` so the test suite
// can import them under Node. This module is only the model calls.
//
// Both go through the project's existing `structuredCompletionWithFallback`,
// which already carries an image as a `data:` URL across OpenAI, Anthropic and
// Gemini — so this adds no provider, no key and no second model configuration.
// A PDF is the exception, and deliberately so: rather than needing a provider
// that accepts `application/pdf`, its text layer is extracted locally in
// `whatsappPdfText.ts` and travels as text. That removed the single-vendor
// dependency that had PDF reading switched off entirely.

import { structuredCompletionWithFallback, type ProviderTarget } from "./aiProvider.ts";
import { extractPdfText } from "./whatsappPdfText.ts";
import {
  ATTACHMENT_ANSWER_SCHEMA,
  attachmentSystemPrompt,
  classifyDocument,
  DOCUMENT_TEXT_BUDGET,
  toDataUrl,
} from "./whatsappAttachments.ts";

/**
 * Vision-capable targets.
 *
 * Gemini is cheaper per image and led this list until the account's state was
 * confirmed: it has no credit (2026-08-11), which is why `gemini` is absent
 * from `DEFAULT_PROVIDER_ORDER` in `careerAiOrchestrator.ts`. Leading with it
 * bought a guaranteed failed round trip on every photo a customer sends, so the
 * funded key goes first and Gemini stays as the fallback it can be again the
 * day the account is topped up — at which point swapping these two lines back
 * restores the cheaper ordering.
 */
export const VISION_TARGETS: ProviderTarget[] = [
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "gemini", model: "gemini-flash-latest" },
];

/**
 * PDFs no longer need a provider that can take a PDF.
 *
 * They used to be Gemini-or-nothing — `structuredOpenAICompatible` sends a
 * `data:` URL as `image_url` and OpenAI rejects `application/pdf` there — and
 * with the Gemini account unfunded this chain was empty, so every PDF was
 * declined before the call. The fix was not a second vendor: `extractPdfText`
 * pulls the text layer out locally with the `pdf-parse` already running in
 * `library-import-book`, which turns a PDF into text and lets it ride the same
 * fallback chain a `.txt` does.
 *
 * A PDF with no text layer is a stack of photographs, and it is answered as one
 * — see the `scanned_pdf` reason — rather than summarised from fragments.
 */
export const DOCUMENT_TARGETS: ProviderTarget[] = VISION_TARGETS;

/**
 * Video is Gemini-only for the same reason a PDF is — it goes as `inline_data`
 * and no other provider in this layer takes it — and is empty for the same
 * reason too. The webhook checks this before downloading the clip, so an
 * unwatchable video does not also cost the bandwidth.
 */
export const VIDEO_TARGETS: ProviderTarget[] = [];

/** Whether a video can be watched at all right now. Read by the webhook. */
export const VIDEO_READING_AVAILABLE = VIDEO_TARGETS.length > 0;

/**
 * A text document is decoded here and travels as text, so it carries no image
 * and any chat model can read it.
 *
 * Sending it down the PDF chain gave the one attachment path that needs no
 * vision the *only* chain with no fallback: a single Gemini outage — or an
 * unfunded key, which is why `gemini` is absent from `DEFAULT_PROVIDER_ORDER`
 * in `careerAiOrchestrator.ts` — turned a plain `.txt` into "I couldn't read
 * that file", a message that then blames the customer's format. Same targets
 * as an image, for the same reason.
 */
export const DOCUMENT_TEXT_TARGETS: ProviderTarget[] = VISION_TARGETS;

export interface UnderstandResult {
  readable: boolean;
  answer: string;
}

function coerce(result: unknown): UnderstandResult | null {
  const parsed = result as Partial<UnderstandResult> | null;
  if (!parsed || typeof parsed.readable !== "boolean") return null;
  return { readable: parsed.readable, answer: (parsed.answer ?? "").trim() };
}

/** Ask a vision model about a customer's image. */
export async function understandImage(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  targets?: ProviderTarget[];
  /**
   * Overrides the general "read this attachment" instruction.
   *
   * The five visual-assistance modes each want a different shape of answer from
   * the same photo — words for `read_text`, a direction for `find_object`, an
   * expiry date for `product` — and a general prompt answers none of them well.
   * `whatsappVisionModes.ts` builds these; omitted, the general prompt stands.
   */
  systemPrompt?: string;
}): Promise<UnderstandResult | null> {
  try {
    const { result } = await structuredCompletionWithFallback({
      targets: params.targets ?? VISION_TARGETS,
      system: params.systemPrompt ?? attachmentSystemPrompt(params.languageName, "image"),
      userText: params.question || "What does this show, and what should the customer do about it?",
      image: toDataUrl(params.bytes, params.mimeType),
      schema: ATTACHMENT_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      toolName: "answer_from_image",
      maxTokens: 600,
    });
    return coerce(result);
  } catch (e) {
    console.error("[whatsapp-vision] image read failed:", e instanceof Error ? e.message : "error");
    return null;
  }
}

/**
 * Watch a short video.
 *
 * Gemini only: it takes video as `inline_data` the same way it takes a PDF, so
 * this needs no frame extraction, no ffmpeg and no second pipeline. There is no
 * fallback provider on purpose — if Gemini is unavailable the honest answer is
 * "I couldn't watch it", not a guess from the filename. With `VIDEO_TARGETS`
 * empty the caller should not reach here at all; the guard below is the
 * backstop for a caller that passes its own empty list.
 */
export async function understandVideo(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  targets?: ProviderTarget[];
}): Promise<UnderstandResult | null> {
  const targets = params.targets ?? VIDEO_TARGETS;
  if (targets.length === 0) return null;

  try {
    const { result } = await structuredCompletionWithFallback({
      targets,
      system: attachmentSystemPrompt(params.languageName, "video"),
      userText: params.question || "What happens in this clip, and what should the customer do about it?",
      image: toDataUrl(params.bytes, params.mimeType),
      schema: ATTACHMENT_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      toolName: "answer_from_video",
      maxTokens: 600,
    });
    return coerce(result);
  } catch (e) {
    console.error("[whatsapp-vision] video read failed:", e instanceof Error ? e.message : "error");
    return null;
  }
}

/**
 * `no_reader` is distinct from `unreadable_format` on purpose: the format is
 * one this assistant knows how to read, and there is simply no provider funded
 * to read it today. The two deserve different wording, because only one of them
 * is fixed by the customer sending a different file.
 */
export type DocumentFailure =
  | "unreadable_format"
  | "no_reader"
  | "empty"
  | "scanned_pdf"
  | "encrypted_pdf"
  | "provider_error";

export type DocumentResult =
  | { ok: true; value: UnderstandResult }
  | { ok: false; reason: DocumentFailure };

/** Read a customer's document. Format policy lives in `classifyDocument`. */
export async function understandDocument(params: {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
  question: string;
  languageName: string;
  targets?: ProviderTarget[];
}): Promise<DocumentResult> {
  const shape = classifyDocument(params.mimeType);
  if (shape === "unsupported") return { ok: false, reason: "unreadable_format" };

  const targets = params.targets ?? (shape === "text" ? DOCUMENT_TEXT_TARGETS : DOCUMENT_TARGETS);
  if (targets.length === 0) return { ok: false, reason: "no_reader" };

  let userText = params.question || "Summarise this document and answer any obvious question it raises.";

  if (shape === "text") {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(params.bytes)
      .slice(0, DOCUMENT_TEXT_BUDGET)
      .trim();
    if (!text) return { ok: false, reason: "empty" };
    userText = `${userText}\n\nDocument${params.filename ? ` (${params.filename})` : ""}:\n${text}`;
  } else {
    // Read locally, then travel as text. The alternative — a `data:` URL of
    // several megabytes of PDF on every turn — costs a provider that accepts
    // PDFs and pays image-token rates for pages that are mostly prose.
    const extracted = await extractPdfText(params.bytes);
    if (!extracted.ok) {
      return {
        ok: false,
        reason: extracted.reason === "scanned"
          ? "scanned_pdf"
          : extracted.reason === "encrypted"
            ? "encrypted_pdf"
            : extracted.reason === "empty"
              ? "empty"
              : "provider_error",
      };
    }
    // The page count is given to the model because "page 3 of 40" is a
    // different answer from "page 3 of 3", and it cannot see the pagination.
    const label = [params.filename, extracted.title].filter(Boolean).join(" — ");
    userText = [
      userText,
      "",
      `PDF${label ? ` (${label})` : ""}${extracted.pages ? `, ${extracted.pages} page(s)` : ""}:`,
      extracted.text,
    ].join("\n");
  }

  try {
    const { result } = await structuredCompletionWithFallback({
      targets,
      system: attachmentSystemPrompt(params.languageName, "document"),
      userText,
      schema: ATTACHMENT_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      toolName: "answer_from_document",
      maxTokens: 700,
    });
    const value = coerce(result);
    return value ? { ok: true, value } : { ok: false, reason: "provider_error" };
  } catch (e) {
    console.error("[whatsapp-vision] document read failed:", e instanceof Error ? e.message : "error");
    return { ok: false, reason: "provider_error" };
  }
}
