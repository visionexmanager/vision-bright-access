// The words inside a document, and nothing else.
//
// ── Why this is not `understandDocument` ────────────────────────────────────
//
// That function reads a document *and answers a question about it*: it picks a
// provider, builds a prompt, and returns what a model said. That is the right
// shape for "summarise this" and the wrong one for "translate this", where the
// model must be handed the sender's own words rather than a summary of them.
//
// So this is the extraction half on its own, composed from the same three
// extractors `understandDocument` already uses — two of which are entirely
// local. A PDF's text comes out of `npm:pdf-parse` in this runtime; a `.docx`
// is unzipped on Visionex's own server. Only a scanned page has no local path,
// and that is answered honestly rather than guessed at.

// ── Why the two extractors are handed in ────────────────────────────────────
//
// `whatsappPdfText.ts` imports `npm:pdf-parse`, which is a Deno specifier Vite
// cannot resolve — so any module that imports it becomes unloadable under
// Vitest, and `whatsappUnderstand.ts` is exactly that. Its own suite says so:
// "asserted against the source, not the module".
//
// Importing it here would make this module untestable in the same way, for a
// dependency it needs on one of three paths. So both readers are parameters,
// the webhook supplies the real ones, and the suite drives this with neither —
// the same arrangement `runMediaJob` uses, for the same reason.

/** What either extractor answers. Deliberately the loosest shape that fits. */
export interface ExtractorResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

export type PdfReader = (bytes: Uint8Array) => Promise<ExtractorResult>;
export type OfficeReader = (bytes: Uint8Array, mimeType: string) => Promise<ExtractorResult>;

/** What a document turned out to contain, or why it did not. */
export interface DocumentTextResult {
  ok: boolean;
  text?: string;
  /**
   * `scanned_pdf` is the one worth acting on differently: the file is fine,
   * there is simply no text layer in it, and the sender should be told to
   * photograph the page — which this assistant reads well — rather than to send
   * a different file.
   */
  reason?: "unsupported_format" | "empty" | "scanned_pdf" | "encrypted_pdf" | "extract_failed";
}

/** Plain text, including the subtitle formats, which are text files. */
const TEXT_MIMES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/vtt",
  "application/x-subrip",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
];

/** Word and PowerPoint, which the local service unpacks. */
const OFFICE_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/**
 * What kind of extraction a file needs.
 *
 * The filename is consulted only for the two subtitle extensions, and only
 * because WhatsApp routinely hands over an `.srt` as `application/octet-stream`
 * — a MIME type that says nothing. Everywhere else the declared type decides,
 * and a type this does not know is refused rather than guessed at.
 */
export function documentShape(
  mimeType: string,
  filename?: string,
): "text" | "pdf" | "office" | null {
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (OFFICE_MIMES.includes(mime)) return "office";
  if (TEXT_MIMES.includes(mime) || mime.startsWith("text/")) return "text";

  const name = (filename ?? "").toLowerCase();
  if (/\.(srt|vtt|txt|md|csv)$/.test(name)) return "text";
  return null;
}

/** How much of one document is read. Past this it is not a message any more. */
export const MAX_DOCUMENT_TEXT_CHARS = 120_000;

/**
 * Pull the text out of a document.
 *
 * Never throws: every caller is deciding what to say to somebody about a file
 * they sent, and an exception is not something to say.
 */
export async function extractDocumentText(params: {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
  readPdf?: PdfReader;
  readOffice?: OfficeReader;
}): Promise<DocumentTextResult> {
  const shape = documentShape(params.mimeType, params.filename);
  if (!shape) return { ok: false, reason: "unsupported_format" };

  const finish = (text: string): DocumentTextResult => {
    const trimmed = text.slice(0, MAX_DOCUMENT_TEXT_CHARS).trim();
    return trimmed ? { ok: true, text: trimmed } : { ok: false, reason: "empty" };
  };

  try {
    if (shape === "text") {
      // `fatal: false` on purpose: a document with one bad byte in it should
      // lose that character rather than the whole file.
      return finish(new TextDecoder("utf-8", { fatal: false }).decode(params.bytes));
    }


    if (shape === "pdf") {
      if (!params.readPdf) return { ok: false, reason: "unsupported_format" };
      const pdf = await params.readPdf(params.bytes);
      if (!pdf.ok) {
        return {
          ok: false,
          reason: pdf.reason === "encrypted" ? "encrypted_pdf"
            : pdf.reason === "scanned" ? "scanned_pdf"
            : pdf.reason === "empty" ? "empty"
            : "extract_failed",
        };
      }
      return finish(pdf.text ?? "");
    }

    if (!params.readOffice) return { ok: false, reason: "unsupported_format" };
    const office = await params.readOffice(params.bytes, params.mimeType);
    if (!office.ok) return { ok: false, reason: "extract_failed" };
    return finish(office.text ?? "");
  } catch {
    // A code, never the exception: an extractor quotes the file it was given.
    return { ok: false, reason: "extract_failed" };
  }
}
