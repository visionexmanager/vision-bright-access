/**
 * Real Word documents (.docx), written in the browser.
 *
 * Until now "DOCX" on this site meant an HTML file saved as .doc, which Word
 * opens in compatibility mode and screen readers meet as a web page. A .docx
 * is a ZIP of XML, and the site already writes ZIPs (File Studio's
 * writeZip), so this needs no new dependency: it writes the parts a word
 * processor needs and nothing else.
 *
 * What it gives a reader:
 *  - real structure — Title, Subtitle, Heading 1/2 and a bulleted list are
 *    Word styles and a numbering definition, so a screen reader navigates by
 *    heading and hears "list, 3 items" instead of a row of "•" characters;
 *  - Arabic and other right-to-left text as a right-to-left paragraph
 *    (`w:bidi`, `w:rtl`), decided per paragraph by its first strong letter,
 *    so a mixed document reads correctly — Word does its own shaping, so no
 *    font or shaping step is needed, unlike PDF;
 *  - the document title and language in its properties, which assistive
 *    technology reads.
 */
import { writeZip } from "@/services/file-studio/modules/archiveFormats";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocxBlock =
  | { type: "heading"; text: string; level?: 1 | 2 }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string };

export interface DocxDocument {
  title: string;
  subtitle?: string;
  /** BCP 47 language of the content, e.g. "ar" or "en". */
  language?: string;
  blocks: DocxBlock[];
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const RTL_LANGUAGES = new Set(["ar", "fa", "ur", "he", "ps", "sd", "ug", "yi"]);

/** Right-to-left scripts: Hebrew, Arabic and its supplements, and their presentation forms. */
function isRtlLetter(code: number): boolean {
  return (code >= 0x0590 && code <= 0x08ff) || (code >= 0xfb1d && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff);
}

function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch);
}

/** The direction of a paragraph, from its first strong letter; the document's language breaks a tie. */
export function isRtlText(text: string, fallbackRtl = false): boolean {
  for (const ch of text) {
    if (!isLetter(ch)) continue;
    return isRtlLetter(ch.codePointAt(0)!);
  }
  return fallbackRtl;
}

/**
 * Text that is safe inside XML 1.0: escaped, and without the control
 * characters and lone surrogates that make Word refuse the whole file.
 */
export function xmlText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const allowed = code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code < 0xd800) || (code > 0xdfff && code !== 0xfffe && code !== 0xffff);
    if (!allowed) continue;
    out += ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : ch;
  }
  return out;
}

function run(text: string, rtl: boolean): string {
  const rPr = rtl ? "<w:rPr><w:rtl/></w:rPr>" : "";
  // Line breaks inside a paragraph are breaks, not new paragraphs.
  return text.split(/\r?\n/).map((line, i) =>
    `${i > 0 ? `<w:r>${rPr}<w:br/></w:r>` : ""}<w:r>${rPr}<w:t xml:space="preserve">${xmlText(line)}</w:t></w:r>`,
  ).join("");
}

function paragraph(text: string, style: string | null, rtl: boolean, bullet = false): string {
  const pPr = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    bullet ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "",
    rtl ? "<w:bidi/>" : "",
  ].join("");
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${run(text, rtl)}</w:p>`;
}

function documentXml(doc: DocxDocument, rtlDefault: boolean): string {
  const body: string[] = [paragraph(doc.title, "Title", isRtlText(doc.title, rtlDefault))];
  if (doc.subtitle?.trim()) body.push(paragraph(doc.subtitle, "Subtitle", isRtlText(doc.subtitle, rtlDefault)));
  for (const block of doc.blocks) {
    if (!block.text.trim()) continue;
    const rtl = isRtlText(block.text, rtlDefault);
    if (block.type === "heading") body.push(paragraph(block.text, block.level === 2 ? "Heading2" : "Heading1", rtl));
    else if (block.type === "bullet") body.push(paragraph(block.text, "ListParagraph", rtl, true));
    else body.push(paragraph(block.text, null, rtl));
  }
  // A4, one-inch margins; a right-to-left document also lays its pages out right to left.
  const sectPr = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>${rtlDefault ? "<w:bidi/>" : ""}</w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${W}"><w:body>${body.join("")}${sectPr}</w:body></w:document>`;
}

function stylesXml(language: string): string {
  const lang = xmlText(language);
  const style = (id: string, name: string, pPr: string, rPr: string, extra = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${extra}<w:pPr>${pPr}</w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${lang}" w:eastAsia="${lang}" w:bidi="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${
  style("Title", "Title", `<w:spacing w:after="120"/>`, `<w:b/><w:bCs/><w:sz w:val="44"/><w:szCs w:val="44"/>`, "<w:qFormat/>")}${
  style("Subtitle", "Subtitle", `<w:spacing w:after="240"/>`, `<w:color w:val="595959"/><w:sz w:val="28"/><w:szCs w:val="28"/>`, "<w:qFormat/>")}${
  style("Heading1", "heading 1", `<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>`, `<w:b/><w:bCs/><w:color w:val="10B981"/><w:sz w:val="32"/><w:szCs w:val="32"/>`, "<w:qFormat/>")}${
  style("Heading2", "heading 2", `<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>`, `<w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/>`, "<w:qFormat/>")}${
  style("ListParagraph", "List Paragraph", `<w:ind w:left="720"/><w:contextualSpacing/>`, "", "<w:qFormat/>")}</w:styles>`;
}

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

function coreXml(title: string, language: string, when: Date): string {
  const stamp = when.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(title)}</dc:title><dc:language>${xmlText(language)}</dc:language><dc:creator>Visionex</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`;
}

/** Plain text: a blank line separates paragraphs; single line breaks stay breaks. */
export function blocksFromPlainText(text: string): DocxBlock[] {
  return text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => ({ type: "paragraph" as const, text: p }));
}

/** Markdown's structure — headings and list items — as Word's; inline markup is dropped. */
export function blocksFromMarkdown(markdown: string): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const inline = (s: string) => s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/(\*|_)(.+?)\1/g, "$2").replace(/`([^`]+)`/g, "$1");
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) { flush(); blocks.push({ type: "heading", level: heading[1].length === 1 ? 1 : 2, text: inline(heading[2]) }); }
    else if (item) { flush(); blocks.push({ type: "bullet", text: inline(item[1]) }); }
    else paragraph.push(inline(line));
  }
  flush();
  return blocks;
}

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

/** Build the .docx bytes. `when` fixes the timestamps, for repeatable output. */
export async function buildDocx(doc: DocxDocument, when: Date = new Date()): Promise<Uint8Array> {
  const language = (doc.language ?? "").trim() || (isRtlText(doc.title) ? "ar" : "en");
  const rtlDefault = RTL_LANGUAGES.has(language.slice(0, 2).toLowerCase());
  const enc = new TextEncoder();
  const part = (name: string, text: string) => ({ name, data: enc.encode(text), mtime: when });
  return writeZip([
    part("[Content_Types].xml", CONTENT_TYPES),
    part("_rels/.rels", ROOT_RELS),
    part("word/document.xml", documentXml(doc, rtlDefault)),
    part("word/_rels/document.xml.rels", DOCUMENT_RELS),
    part("word/styles.xml", stylesXml(language)),
    part("word/numbering.xml", NUMBERING_XML),
    part("docProps/core.xml", coreXml(doc.title, language, when)),
  ]);
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
