/**
 * Word documents in the browser. The writer itself is shared with the WhatsApp
 * assistant (supabase/functions/_shared/docxDocument.ts); what lives here needs
 * a browser — reading an HTML page's structure, and handing the file over as
 * a download.
 */
import { DOCX_MIME, blocksFromPlainText, buildDocx, type DocxBlock, type DocxDocument } from "../../../supabase/functions/_shared/docxDocument.ts";

export * from "../../../supabase/functions/_shared/docxDocument.ts";

/** An HTML page's headings, list items and paragraphs, in document order. */
export function blocksFromHtml(html: string): DocxBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: DocxBlock[] = [];
  const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  for (const el of doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6, li, p, pre, blockquote")) {
    // A paragraph inside a list item is already that item.
    if (el.tagName !== "LI" && el.closest("li")) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) blocks.push({ type: "heading", level: tag === "h1" ? 1 : 2, text: text(el) });
    else if (tag === "li") blocks.push({ type: "bullet", text: text(el) });
    else if (tag === "pre") blocks.push({ type: "paragraph", text: el.textContent ?? "" });
    else blocks.push({ type: "paragraph", text: text(el) });
  }
  // A page with no block elements is still text.
  if (blocks.length === 0) return blocksFromPlainText(doc.body.textContent ?? "");
  return blocks;
}

/** Build the .docx and hand it to the browser as a download. */
export async function downloadDocx(doc: DocxDocument, filename: string): Promise<void> {
  const bytes = await buildDocx(doc);
  // Cast as archives.ts does: newer TypeScript types a ZIP's bytes as backed by
  // ArrayBufferLike, which Blob's declaration does not accept.
  const blob = new Blob([bytes as unknown as BlobPart], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
