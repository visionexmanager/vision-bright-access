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
import { describeError } from "./whatsappSafety.ts";
import {
  ATTACHMENT_ANSWER_SCHEMA,
  attachmentSystemPrompt,
  classifyDocument,
  DOCUMENT_TEXT_BUDGET,
  officeKind,
  toDataUrl,
} from "./whatsappAttachments.ts";
import { readOfficeLocally } from "./whatsappOffice.ts";
import {
  convertMediaLocally,
  processorAvailable,
  processorConfig,
  probeMediaLocally,
  type ProcessorConfig,
} from "./whatsappProcessor.ts";
import { transcribe } from "./voice/stt.ts";
import { denoEnv } from "./voice/providers/types.ts";

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
  // flash-latest is parked (PAUSED_MODELS); flash-lite keeps this chain two deep.
  { provider: "gemini", model: "gemini-flash-lite-latest" },
];

/**
 * Readers for a document that arrives as text — a PDF's text layer, DOC/DOCX,
 * TXT. No image is sent, so the chain need not be vision-capable, and it no
 * longer rests on two vendors: Luna answers when gpt-4o-mini alone is refused,
 * and Mistral when OpenAI and Gemini both are. Each passed this exact contract
 * (ATTACHMENT_ANSWER_SCHEMA, an Arabic question about a bilingual invoice) in
 * the live route contract probe (scripts/ai-eval/live-route-contract.ts).
 */
const TEXT_READERS: ProviderTarget[] = [
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "openai", model: "gpt-5.6-luna" },
  { provider: "gemini", model: "gemini-flash-latest" }, // parked (PAUSED_MODELS), kept as configuration
  { provider: "gemini", model: "gemini-flash-lite-latest" },
  { provider: "mistral", model: "ministral-14b-latest" },
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
export const DOCUMENT_TARGETS: ProviderTarget[] = TEXT_READERS;

/**
 * Providers that take a video whole, as `inline_data` (Gemini). Empty: the
 * account is unfunded. A video is read the other way instead — see
 * `understandVideo`: a sheet of frames for a vision model, and a transcript
 * of what is said, on the OpenAI models the rest of this file already uses.
 */
export const VIDEO_TARGETS: ProviderTarget[] = [];

/**
 * Whether a video can be read at all right now. Read by the webhook before it
 * downloads the clip, so an unreadable video does not also cost the bandwidth.
 * The frames route needs the media processor; the transcript alone needs only
 * an STT key. Either is enough to say something true about a clip.
 */
export const VIDEO_READING_AVAILABLE = VIDEO_TARGETS.length > 0 || processorAvailable() ||
  !!(denoEnv("OPENAI_API_KEY")?.trim() || denoEnv("GROQ_API_KEY")?.trim());

/** Frames on a contact sheet: 3 × 2, as the media processor tiles them. */
export const VIDEO_SHEET_FRAMES = 6;
/** Spoken words handed to the model, at most. A support clip says far less. */
export const VIDEO_TRANSCRIPT_BUDGET = 4_000;

/** Seconds between frames, so six of them span the whole clip. */
export function sheetInterval(durationSeconds: number | null): string {
  const seconds = durationSeconds && durationSeconds > 0 ? durationSeconds : 12;
  const interval = Math.min(600, Math.max(0.5, Math.round((seconds / VIDEO_SHEET_FRAMES) * 10) / 10));
  return String(interval);
}

/**
 * A text document is decoded here and travels as text, so it carries no image
 * and any chat model can read it.
 *
 * Sending it down the PDF chain gave the one attachment path that needs no
 * vision the *only* chain with no fallback: a single Gemini outage — or an
 * unfunded key, which is why `gemini` is absent from `DEFAULT_PROVIDER_ORDER`
 * in `careerAiOrchestrator.ts` — turned a plain `.txt` into "I couldn't read
 * that file", a message that then blames the customer's format. Same targets
 * readers as a PDF, which since the local text-layer extraction travels as text too.
 */
export const DOCUMENT_TEXT_TARGETS: ProviderTarget[] = TEXT_READERS;

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
    // A normalised code, never the model's message: a vision provider's
    // error quotes what it was asked to read, and what it was asked to read
    // is a photograph or a document somebody sent in.
    console.error("[whatsapp-vision] image read failed:", describeError(e));
    return null;
  }
}

/**
 * Watch a short video.
 *
 * With a provider that takes video whole (`VIDEO_TARGETS`, Gemini), the clip
 * goes to it as `inline_data`. With none — today — it is read the way a person
 * with the clip muted and then unmuted would: the media processor tiles six
 * frames spread across it into one picture, the STT chain (Groq, then OpenAI
 * Whisper, which both take an MP4 as it is) transcribes what is said, and a
 * vision model answers from the two together. Either half alone still says
 * something true; neither is a guess from the filename. When both fail the
 * answer is "I couldn't watch it".
 */
export async function understandVideo(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  targets?: ProviderTarget[];
  /** For tests: the processor configuration, fetch, and the transcriber. */
  processor?: ProcessorConfig | null;
  fetchImpl?: typeof fetch;
  transcribeImpl?: typeof transcribe;
}): Promise<UnderstandResult | null> {
  const targets = params.targets ?? VIDEO_TARGETS;
  if (targets.length === 0) return await understandVideoFromFramesAndSpeech(params);
  return await understandVideoWhole({ ...params, targets });
}

/** A clip read as a sheet of frames plus a transcript. Null when neither could be had. */
async function understandVideoFromFramesAndSpeech(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  processor?: ProcessorConfig | null;
  fetchImpl?: typeof fetch;
  transcribeImpl?: typeof transcribe;
}): Promise<UnderstandResult | null> {
  const config = params.processor === undefined ? processorConfig() : params.processor;
  const probed = config
    ? await probeMediaLocally({ bytes: params.bytes, config, fetchImpl: params.fetchImpl })
    : { ok: false as const, code: "not_configured" };
  const interval = sheetInterval(probed.ok ? probed.durationSeconds : null);
  const [sheet, heard] = await Promise.all([
    config
      ? convertMediaLocally({ bytes: params.bytes, query: `to=jpg&sheet=${interval}&quality=balanced`, config, fetchImpl: params.fetchImpl })
      : Promise.resolve({ ok: false as const, code: "not_configured" }),
    (params.transcribeImpl ?? transcribe)({ bytes: params.bytes, mimeType: params.mimeType }).catch(() => null),
  ]);
  const frames = sheet.ok && sheet.bytes ? sheet.bytes : null;
  const transcript = heard && heard.outcome === "transcript" ? heard.text.trim().slice(0, VIDEO_TRANSCRIPT_BUDGET) : "";
  // Codes and sizes only: the frames and the words are somebody's private clip.
  console.info(`[whatsapp-video] frames=${frames ? "yes" : `no:${sheet.ok ? "empty" : sheet.code}`} speech=${transcript ? `${transcript.length}ch` : "none"} interval=${interval}s`);
  if (!frames && !transcript) return null;

  const userText = [
    params.question || "What happens in this clip, and what should the customer do about it?",
    frames
      ? `The picture is a sheet of up to ${VIDEO_SHEET_FRAMES} frames from the clip, in order from left to right and top to bottom, one every ${interval} seconds.`
      : "No frames could be taken from the clip: answer only from what is said in it, and say that you could not see it.",
    transcript
      ? `What is said in the clip (a machine transcript; it may contain mistakes):\n"""\n${transcript}\n"""`
      : "Nothing said in the clip could be transcribed: answer only from what the frames show.",
  ].join("\n\n");

  try {
    const { result } = await structuredCompletionWithFallback({
      targets: frames ? VISION_TARGETS : TEXT_READERS,
      system: attachmentSystemPrompt(params.languageName, "video"),
      userText,
      ...(frames ? { image: toDataUrl(frames, "image/jpeg") } : {}),
      schema: ATTACHMENT_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      toolName: "answer_from_video",
      maxTokens: 600,
    });
    return coerce(result);
  } catch (e) {
    console.error("[whatsapp-vision] video read failed:", describeError(e));
    return null;
  }
}

/** A clip sent whole to a provider that takes video (`VIDEO_TARGETS`). */
async function understandVideoWhole(params: {
  bytes: Uint8Array;
  mimeType: string;
  question: string;
  languageName: string;
  targets: ProviderTarget[];
}): Promise<UnderstandResult | null> {
  const targets = params.targets;
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
    // A normalised code, never the model's message: a vision provider's
    // error quotes what it was asked to read, and what it was asked to read
    // is a photograph or a document somebody sent in.
    console.error("[whatsapp-vision] video read failed:", describeError(e));
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
  // A `.docx` or `.pptx` that opened and had no words in it — a deck of
  // photographs, a sheet of figures. Distinct from `empty`, which is a file
  // with nothing in it at all, because the two need different advice.
  | "office_no_text"
  // A `.docx` or `.pptx` that would not open: truncated, not really a ZIP, or
  // an archive built to be expensive to unpack.
  | "office_corrupt"
  | "provider_error";

export type DocumentResult =
  | { ok: true; value: UnderstandResult }
  | { ok: false; reason: DocumentFailure };

/**
 * A PDF with no text layer, read by a model that reads PDFs as pages: OpenAI's
 * `file` part (and Gemini's inline data, when funded). The vision chain, since
 * it is the pages' images that carry the words. `scanned_pdf` — "send photos
 * instead" — is still the answer when no model can read it.
 */
export async function readScannedPdf(params: {
  bytes: Uint8Array;
  userText: string;
  languageName: string;
  targets?: ProviderTarget[];
}): Promise<DocumentResult> {
  const targets = (params.targets ?? VISION_TARGETS).filter((t) => t.provider === "openai" || t.provider === "gemini");
  if (targets.length === 0) return { ok: false, reason: "scanned_pdf" };
  try {
    const { result } = await structuredCompletionWithFallback({
      targets,
      system: attachmentSystemPrompt(params.languageName, "document"),
      userText: `${params.userText}\n\nThe PDF is a scan: read the words on its pages.`,
      pdf: toDataUrl(params.bytes, "application/pdf"),
      schema: ATTACHMENT_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      toolName: "answer_from_document",
      maxTokens: 700,
    });
    const value = coerce(result);
    return value ? { ok: true, value } : { ok: false, reason: "scanned_pdf" };
  } catch (e) {
    console.error("[whatsapp-vision] scanned PDF read failed:", describeError(e));
    return { ok: false, reason: "scanned_pdf" };
  }
}

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

  // `office` joins `text` on the text chain rather than the document chain. By
  // the time a model sees it there is no `.docx` left — the service returned
  // words — so requiring a provider that accepts documents would be asking for
  // a capability that is no longer needed, and would decline the file whenever
  // that narrower chain happened to be empty.
  const textShaped = shape === "text" || shape === "office";
  const targets = params.targets ?? (textShaped ? DOCUMENT_TEXT_TARGETS : DOCUMENT_TARGETS);
  if (targets.length === 0) return { ok: false, reason: "no_reader" };

  let userText = params.question || "Summarise this document and answer any obvious question it raises.";

  if (shape === "text") {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(params.bytes)
      .slice(0, DOCUMENT_TEXT_BUDGET)
      .trim();
    if (!text) return { ok: false, reason: "empty" };
    userText = `${userText}\n\nDocument${params.filename ? ` (${params.filename})` : ""}:\n${text}`;
  } else if (shape === "office") {
    // Unpacked on Visionex's own server and then travelling as text, which is
    // the same shape the PDF branch below already has. This replaces a refusal
    // rather than a provider call: a `.docx` used to be answered with "send it
    // as a PDF instead".
    const extracted = await readOfficeLocally({ bytes: params.bytes, mimeType: params.mimeType });
    if (!extracted.ok) {
      return {
        ok: false,
        reason: extracted.reason === "no_text"
          ? "office_no_text"
          : extracted.reason === "corrupt"
            ? "office_corrupt"
            : extracted.reason === "unsupported_kind"
              ? "unreadable_format"
              : extracted.reason === "not_configured"
                // The service is switched off, so the file cannot be read here
                // at all — which is what `no_reader` means, and it is the state
                // every deployment was in before this shipped.
                ? "no_reader"
                : "provider_error",
      };
    }
    // The part count is given to the model for the same reason the PDF branch
    // gives it a page count: "slide 3 of 40" is a different answer from "slide
    // 3 of 3", and it cannot see the deck.
    const kind = officeKind(params.mimeType);
    const label = params.filename ? ` (${params.filename})` : "";
    userText = [
      userText,
      "",
      kind === "pptx"
        ? `Presentation${label}, ${extracted.parts} slide(s):`
        : `Document${label}:`,
      extracted.text,
    ].join("\n");
  } else {
    // Read locally, then travel as text. The alternative — a `data:` URL of
    // several megabytes of PDF on every turn — costs a provider that accepts
    // PDFs and pays image-token rates for pages that are mostly prose.
    const extracted = await extractPdfText(params.bytes);
    // A scan has no text layer to extract. OpenAI reads the PDF itself — its
    // text and an image of every page — so the scan is read like a
    // photograph rather than refused with "send photos of the pages".
    if (!extracted.ok && extracted.reason === "scanned") {
      return await readScannedPdf({ ...params, userText });
    }
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
    // A normalised code, never the model's message: a vision provider's
    // error quotes what it was asked to read, and what it was asked to read
    // is a photograph or a document somebody sent in.
    console.error("[whatsapp-vision] document read failed:", describeError(e));
    return { ok: false, reason: "provider_error" };
  }
}
