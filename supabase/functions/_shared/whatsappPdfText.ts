// Getting the words out of a PDF, locally.
//
// This module exists to remove a vendor dependency rather than add one. PDF
// reading was Gemini-only — `structuredOpenAICompatible` sends a `data:` URL as
// `image_url` and OpenAI rejects `application/pdf` — so an unfunded Gemini
// account meant every PDF a customer sent was declined, however ordinary it
// was. Extracting the text here turns a PDF into the one attachment shape that
// needs no vision at all, and it then rides the same fallback chain as a `.txt`.
//
// `npm:pdf-parse@1.1.1` is not a new dependency on this project: it is already
// pinned and running in `library-import-book/index.ts` in this same runtime.
//
// The policy — how much text counts as text, how much the model sees, what to
// say about a scan — lives in `whatsappAttachments.ts` so the suite can test it
// without importing this file's npm specifier.

// deno-lint-ignore no-explicit-any
import pdfParse from "npm:pdf-parse@1.1.1";
import { PDF_TEXT_BUDGET, pdfTextIsUsable } from "./whatsappAttachments.ts";

/**
 * `scanned` is separate from `empty` and from `failed` on purpose.
 *
 * They need different things from the sender: a scan needs a photograph of the
 * page, an empty file needs a different file, and a failure needs nothing at
 * all because it was not their fault. Collapsing them into one message means
 * two thirds of the people who read it are told to do something that cannot
 * work.
 */
export type PdfTextFailure = "scanned" | "empty" | "encrypted" | "failed";

export type PdfTextResult =
  | { ok: true; text: string; pages: number | null; title: string | null }
  | { ok: false; reason: PdfTextFailure };

/** Collapse the runs of whitespace a PDF text layer is full of. */
function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract a PDF's text layer.
 *
 * Never throws: a malformed or encrypted file is a normal thing for a customer
 * to send, and it is answered with a reason rather than a stack trace.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  let parsed: { text?: string; numpages?: number; info?: Record<string, unknown> };
  try {
    parsed = await pdfParse(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // pdf-parse surfaces a password-protected file as a message, not a type.
    const encrypted = /password|encrypt/i.test(message);
    // The reason, never the parser's message: it quotes the file it choked on,
    // and that file is a document somebody photographed and sent in.
    console.error(`[whatsapp-pdf] extraction failed: ${encrypted ? "encrypted" : "unreadable"}`);
    return { ok: false, reason: encrypted ? "encrypted" : "failed" };
  }

  const pages = typeof parsed.numpages === "number" ? parsed.numpages : null;
  const text = tidy(parsed.text ?? "");

  if (!text) return { ok: false, reason: pages && pages > 0 ? "scanned" : "empty" };
  if (!pdfTextIsUsable(text, pages)) return { ok: false, reason: "scanned" };

  const rawTitle = parsed.info?.Title;
  return {
    ok: true,
    text: text.slice(0, PDF_TEXT_BUDGET),
    pages,
    title: typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : null,
  };
}
