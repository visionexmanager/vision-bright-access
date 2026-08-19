// Attachment decisions that need no provider.
//
// Deliberately free of any import that touches `Deno` or the AI provider layer:
// the Vitest suite runs under Node and imports this directly, so keeping the
// encoding, the format policy and the user-facing wording here is what makes
// them testable at all. `whatsappUnderstand.ts` holds the model calls and
// imports these.

/** Plain-text formats decoded locally rather than sent to a model as bytes. */
export const PLAIN_TEXT_MIME = ["text/plain", "text/csv", "text/markdown"];

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
 * How a document should be read.
 *
 * `text` is decoded here — sending a text file to a vision model is paying for
 * OCR that is not needed. `pdf` goes to Gemini as a PDF, which reads it
 * natively. Word files are zip containers and would need an unpacker, so they
 * are declined rather than half-read.
 */
export function classifyDocument(mimeType: string): "text" | "pdf" | "unsupported" {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  if (PLAIN_TEXT_MIME.includes(mime)) return "text";
  if (mime === "application/pdf") return "pdf";
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

export function attachmentSystemPrompt(languageName: string, kind: "image" | "document"): string {
  return [
    `You are the Visionex support assistant reading a customer's ${kind}.`,
    "Answer only from what the attachment actually contains.",
    "If it is blurry, empty, cropped, password-protected or simply not about the question, set readable to false and leave answer empty — do not guess and do not describe what you imagine it might be.",
    "Never invent order numbers, prices, dates, names or policies that are not visible.",
    `Write the answer in ${languageName}.`,
  ].join(" ");
}

/** Told to the user when an attachment could not be read. Never a guess. */
export function unreadableNotice(language: "ar" | "en", kind: "image" | "document"): string {
  if (language === "ar") {
    return kind === "image"
      ? "لم أتمكن من قراءة الصورة بوضوح كافٍ للإجابة. جرّب صورة أوضح، أو اكتب لي ما تريد معرفته."
      : "لم أتمكن من قراءة هذا الملف. جرّب PDF أو ملفاً نصياً، أو اكتب لي المحتوى.";
  }
  return kind === "image"
    ? "I couldn't read that image clearly enough to answer. Try a sharper photo, or tell me what you'd like to know."
    : "I couldn't read that file. A PDF or a text file works best, or you can type the details.";
}

/** Told to the user when the format itself is one this assistant will not open. */
export function unsupportedDocumentNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "لا أستطيع فتح ملفات Word حالياً. أرسله بصيغة PDF أو انسخ النص في رسالة."
    : "I can't open Word files yet. Send it as a PDF, or paste the text into a message.";
}
