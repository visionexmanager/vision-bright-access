// ─── Document Converter Module ────────────────────────────────────────────────
//
// Browser-native: TXT↔HTML↔Markdown, CSV, a Word file from text, and the text
// out of a Word file or a deck. Everything that needs a real document engine —
// PDF to Word and back, Word/Excel/PowerPoint to PDF, spreadsheets and decks
// between their formats — is sent to the LibreOffice in the media-processor
// container (see `serverDocuments.ts`). Any pair neither path covers is refused
// by saying so; the page's menu never offers one.

import type {
  ConverterModule,
  ConversionResult,
  DocumentOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { DOCUMENT_FORMATS } from "@/lib/types/fileStudio";
import { convertOnServer } from "../serverConvert";
import { serverCanConvertDocument } from "../serverDocuments";
import { ArchiveError } from "./archiveFormats";
import { isOfficeTextFormat, officeText } from "./officeText";
import { DOCX_MIME, blocksFromHtml, blocksFromMarkdown, blocksFromPlainText, buildDocx, isRtlText } from "@/lib/documents/docx";

/**
 * What the tab can write by itself, by input format. `engine.ts` reads this
 * rather than repeating it, so the menu and the branch below cannot drift.
 */
export const BROWSER_DOCUMENT_TARGETS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Text, Markdown and HTML become a real Word document (src/lib/documents/docx.ts),
  // with their headings and lists as Word's own.
  txt:  ["html", "md", "docx"],
  md:   ["docx"],
  html: ["txt", "docx"],
  csv:  ["txt"],
  // A .docx is a ZIP of XML, so the archive reader opens it and the text comes out.
  docx: ["txt", "html"],
  pptx: ["txt", "html"],
});

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

    // The browser handles what it can without a request; the rest goes to the
    // document engine on Visionex's own server.
    if (!BROWSER_DOCUMENT_TARGETS[inFmt]?.includes(opts.targetFormat) && serverCanConvertDocument(inFmt, opts.targetFormat)) {
      return await convertOnServer({ file, target: opts.targetFormat, kind: "document", onProgress });
    }

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
      // TXT / Markdown / HTML → a real Word document, headings and lists kept
      else if (opts.targetFormat === "docx" && (inFmt === "txt" || inFmt === "md" || inFmt === "html")) {
        const blocks = inFmt === "md" ? blocksFromMarkdown(text) : inFmt === "html" ? blocksFromHtml(text) : blocksFromPlainText(text);
        const title = file.name.replace(/\.[^.]+$/, "") || file.name;
        const bytes = await buildDocx({ title, language: isRtlText(text) ? "ar" : undefined, blocks });
        resultBlob = new Blob([bytes as unknown as BlobPart], { type: DOCX_MIME });
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
