// The PDF half of `ocr-scan`.
//
// The OCR page has always offered a "PDF Scan" package and accepted PDF files,
// then sent them to the vision model as if they were images — which it rejects
// — after the VX had already been spent. A PDF with a text layer does not need
// a vision model at all: its text is in the file. `extractPdfText` (the
// WhatsApp assistant's, pdf-parse, already a dependency) reads it locally, so
// a PDF scan makes no provider call and costs Visionex nothing.
//
// A scanned PDF — photographs of pages with no text layer — has nothing to
// extract, and is answered with a code the page turns into advice: upload the
// pages as photos, which the image path reads.
//
// Pure: no imports, no Deno. Decoding and shaping only.

/** The page's own ceiling for an upload. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const PDF_DATA_URL = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/;

export function isPdfDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:application/pdf;");
}

export type PdfUpload =
  | { outcome: "ok"; bytes: Uint8Array }
  | { outcome: "refused"; status: 400 | 413; error: string };

/** A bounded, well-formed inline PDF, decoded — or the refusal to send. */
export function decodePdfDataUrl(value: unknown): PdfUpload {
  const match = typeof value === "string" ? PDF_DATA_URL.exec(value) : null;
  if (!match) return { outcome: "refused", status: 400, error: "Send the PDF as a file upload." };
  const b64 = match[1].replace(/\s/g, "");
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  if (Math.floor((b64.length * 3) / 4) - padding > MAX_PDF_BYTES) {
    return { outcome: "refused", status: 413, error: "The PDF is too large. Please use one under 20 MB." };
  }
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return { outcome: "refused", status: 400, error: "Send the PDF as a file upload." };
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // Every PDF starts with this; anything else is a mislabelled file.
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return { outcome: "refused", status: 400, error: "That file is not a PDF." };
  }
  return { outcome: "ok", bytes };
}

/** The code the page reads to show "this PDF has no text; send photos". */
export const PDF_NO_TEXT_CODE = "pdf_no_text";
export const PDF_NO_TEXT_MESSAGE =
  "This PDF has no readable text. It may be a scan or password-protected; upload photos of its pages instead.";

/** An ISO code as an English language name, e.g. "ar" → "Arabic". */
export function languageName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? "Unknown";
  } catch {
    return "Unknown";
  }
}

/** The same shape the image path's model returns, so the page needs no second renderer. */
export interface OcrResult {
  extracted_text: string;
  detected_language: string;
  confidence: "High" | "Medium" | "Low";
  word_count: number;
  has_handwriting: boolean;
}

export function pdfScanResult(text: string, languageCode: string | null): OcrResult {
  return {
    extracted_text: text,
    detected_language: languageName(languageCode),
    // The text layer is the document's own text, not a reading of pixels.
    confidence: "High",
    word_count: text.split(/\s+/).filter(Boolean).length,
    has_handwriting: false,
  };
}
