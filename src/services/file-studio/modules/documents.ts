// ─── Document Converter Module ────────────────────────────────────────────────
//
// Browser-native: TXT↔HTML↔Markdown and CSV. PDF and Word are not here and are
// not "coming": writing them needs a document engine (LibreOffice, ~1 GB) that
// Visionex deliberately does not run, and the ffmpeg the other modules use has
// nothing to do with documents. The branch below therefore refuses by saying
// that, rather than by naming a phase — the page's menu never offers these
// pairs in the first place, so it is a safety net and not a message a visitor
// is expected to read.

import type {
  ConverterModule,
  ConversionResult,
  DocumentOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { DOCUMENT_FORMATS } from "@/lib/types/fileStudio";
import { ArchiveError } from "./archiveFormats";
import { isOfficeTextFormat, officeText } from "./officeText";

export const DocumentModule: ConverterModule = {
  moduleType: "document",
  supportedInputFormats: [...DOCUMENT_FORMATS],
  supportedOutputFormats: [...DOCUMENT_FORMATS],
  canHandleInBrowser: true,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as DocumentOptions;
    const start = Date.now();
    const inFmt = file.name.split(".").pop()?.toLowerCase() ?? "";

    // A .docx and a .pptx are ZIP archives, so `file.text()` below would read
    // compressed bytes as if they were prose. They are handled first, and by
    // their own reader.
    if (isOfficeTextFormat(inFmt)) {
      return await convertOfficeDocument(file, inFmt, opts.targetFormat, onProgress, start);
    }

    try {
      onProgress(10);
      const text = await file.text();
      onProgress(40);

      let resultBlob: Blob | null = null;

      // TXT → HTML
      if (inFmt === "txt" && opts.targetFormat === "html") {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(file.name)}</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
        resultBlob = new Blob([html], { type: "text/html" });
      }
      // HTML → TXT
      else if (inFmt === "html" && opts.targetFormat === "txt") {
        const doc = new DOMParser().parseFromString(text, "text/html");
        resultBlob = new Blob([doc.body.innerText], { type: "text/plain" });
      }
      // TXT → MD (trivial wrap)
      else if (inFmt === "txt" && opts.targetFormat === "md") {
        resultBlob = new Blob([text], { type: "text/markdown" });
      }
      // CSV → JSON (developer utility crossover)
      else if (inFmt === "csv" && opts.targetFormat === "txt") {
        resultBlob = new Blob([text], { type: "text/plain" });
      }
      else {
        onProgress(100);
        return {
          success: false,
          processingMs: Date.now() - start,
          error: `${inFmt.toUpperCase()} → ${opts.targetFormat.toUpperCase()} isn't a conversion Visionex performs. Text, HTML and Markdown convert here.`,
        };
      }

      onProgress(100);
      const url = URL.createObjectURL(resultBlob);
      return {
        success: true,
        resultUrl: url,
        resultBlob,
        resultSize: resultBlob.size,
        processingMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Document conversion failed",
      };
    }
  },
};

/**
 * The text of a Word document or a deck, as text or as HTML.
 *
 * Paragraphs become `<p>` rather than one `<pre>`: the extractor keeps the
 * document's paragraph breaks precisely because a screen reader needs them, and
 * a single preformatted block throws that away again.
 */
async function convertOfficeDocument(
  file: File,
  inFmt: string,
  targetFormat: string,
  onProgress: (pct: number) => void,
  start: number,
): Promise<ConversionResult> {
  try {
    onProgress(10);
    const text = await officeText(new Uint8Array(await file.arrayBuffer()), inFmt);
    onProgress(80);

    const resultBlob =
      targetFormat === "html"
        ? new Blob(
            [
              `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(file.name)}</title></head><body>` +
                text
                  .split(/\n{2,}/)
                  .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
                  .join("") +
                "</body></html>",
            ],
            { type: "text/html" },
          )
        : new Blob([text], { type: "text/plain" });

    onProgress(100);
    return {
      success: true,
      resultUrl: URL.createObjectURL(resultBlob),
      resultBlob,
      resultSize: resultBlob.size,
      processingMs: Date.now() - start,
      metadata: { characters: text.length },
    };
  } catch (err) {
    return {
      success: false,
      processingMs: Date.now() - start,
      error:
        err instanceof ArchiveError
          ? err.message
          : `This ${inFmt.toUpperCase()} couldn't be read. It may be damaged.`,
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
