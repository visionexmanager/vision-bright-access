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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
