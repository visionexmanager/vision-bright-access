// Reading a customer's image or document with a model.
//
// The decisions that need no provider — encoding, which formats are readable,
// the schema, the wording — live in `whatsappAttachments.ts` so the test suite
// can import them under Node. This module is only the model calls.
//
// Both go through the project's existing `structuredCompletionWithFallback`,
// which already carries an image as a `data:` URL across OpenAI, Anthropic and
// Gemini — so this adds no provider, no key and no second model configuration.
// Gemini passes the MIME type straight through to `inline_data`, which is why a
// PDF needs no parser here: it is sent as a PDF and read as one.

import { structuredCompletionWithFallback, type ProviderTarget } from "./aiProvider.ts";
import {
  ATTACHMENT_ANSWER_SCHEMA,
  attachmentSystemPrompt,
  classifyDocument,
  DOCUMENT_TEXT_BUDGET,
  toDataUrl,
} from "./whatsappAttachments.ts";

/** Vision-capable targets, cheapest first. */
export const VISION_TARGETS: ProviderTarget[] = [
  { provider: "gemini", model: "gemini-flash-latest" },
  { provider: "openai", model: "gpt-4o-mini" },
];

/**
 * PDFs lean on Gemini, which reads them natively.
 *
 * Gemini alone, because it is the only provider in this project's layer that
 * takes a PDF at all: `structuredOpenAICompatible` sends a `data:` URL as
 * `image_url`, and OpenAI rejects `application/pdf` there. So a PDF is
 * Gemini-or-nothing, and "nothing" is `unreadableNotice` rather than a guess.
 */
export const DOCUMENT_TARGETS: ProviderTarget[] = [
  { provider: "gemini", model: "gemini-flash-latest" },
];

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
}): Promise<UnderstandResult | null> {
  try {
    const { result } = await structuredCompletionWithFallback({
      targets: params.targets ?? VISION_TARGETS,
      system: attachmentSystemPrompt(params.languageName, "image"),
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
 * "I couldn't watch it", not a guess from the filename.
 */
export async function understandVideo(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  targets?: ProviderTarget[];
}): Promise<UnderstandResult | null> {
  try {
    const { result } = await structuredCompletionWithFallback({
      targets: params.targets ?? DOCUMENT_TARGETS,
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

export type DocumentFailure = "unreadable_format" | "empty" | "provider_error";

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

  let userText = params.question || "Summarise this document and answer any obvious question it raises.";
  let image: string | undefined;

  if (shape === "text") {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(params.bytes)
      .slice(0, DOCUMENT_TEXT_BUDGET)
      .trim();
    if (!text) return { ok: false, reason: "empty" };
    userText = `${userText}\n\nDocument${params.filename ? ` (${params.filename})` : ""}:\n${text}`;
  } else {
    image = toDataUrl(params.bytes, "application/pdf");
  }

  try {
    const { result } = await structuredCompletionWithFallback({
      targets: params.targets ?? (shape === "text" ? DOCUMENT_TEXT_TARGETS : DOCUMENT_TARGETS),
      system: attachmentSystemPrompt(params.languageName, "document"),
      userText,
      image,
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
