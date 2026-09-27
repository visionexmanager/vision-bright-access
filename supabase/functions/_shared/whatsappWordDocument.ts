/**
 * "…as a Word file": the assistant's answer, delivered as a real .docx.
 *
 * The sender asks for a document in the same sentence as the request — «سيرة
 * ذاتية لمهندس مدني كملف وورد», "a lesson plan on fractions as a Word
 * document". The answer is generated exactly once, as it would be anyway, and
 * then travels as a file through deliverAsset instead of as text parts. If the
 * file cannot be delivered the text is sent instead, so the answer is never
 * lost to a transport failure.
 *
 * The writer is the site's own (docxDocument.ts): headings are Word headings,
 * points are a real list, and Arabic paragraphs are right to left.
 *
 * Pure. No Deno, no fetch, no database.
 */
import { blocksFromMarkdown, type DocxDocument } from "./docxDocument.ts";

// Explicit requests only. "word" alone is an ordinary English word, and
// «وورد» alone could be anything; a file is asked for with a noun and the name
// together, or with the extension.
const ARABIC_REQUEST = /(?:ملف|مستند|صيغة|بصيغة|كملف|كمستند|فايل)\s*(?:ال)?\s*(?:وورد|ورد|word)/i;
const ENGLISH_REQUEST = /\b(?:word\s+(?:document|doc|file)|as\s+an?\s+word\b|in\s+word\s+format|ms\s+word\s+file)\b/i;
const EXTENSION = /(?:^|[\s.(])docx\b/i;

export function wantsWordDocument(text: string | null | undefined): boolean {
  if (!text) return false;
  return ARABIC_REQUEST.test(text) || ENGLISH_REQUEST.test(text) || EXTENSION.test(text);
}

/**
 * Tells the model its answer will be a document. Markdown is the one format
 * the writer turns into Word structure, and a file needs no "here is your
 * document" around it.
 */
export const WORD_DOCUMENT_DIRECTIVE = [
  "The sender asked for this answer as a Word document; it will be delivered as a .docx file.",
  "Write the document itself: no greeting, no preamble, and no closing note about sending a file.",
  "Structure it in Markdown: the first line is '# ' and the document's title, sections start with '## ', points are '- ' list items, and everything else is plain paragraphs.",
  "Do not use tables, code blocks or images. Keep the sender's language.",
].join(" ");

const MAX_TITLE = 120;

/** The answer as a document: its first top-level heading is the title. */
export function documentFromAnswer(answer: string, language: string, fallbackTitle: string): DocxDocument {
  const blocks = blocksFromMarkdown(answer);
  const first = blocks[0];
  let title = fallbackTitle;
  if (first && first.type === "heading" && (first.level ?? 1) === 1) {
    title = first.text;
    blocks.shift();
  } else if (first && first.type === "paragraph" && first.text.length <= MAX_TITLE && blocks.length > 1) {
    // A short first line followed by more is a title the model wrote without '#'.
    title = first.text;
    blocks.shift();
  }
  return { title: title.slice(0, MAX_TITLE), language, blocks };
}

/**
 * A filename a phone shows and keeps: letters and digits in any script, the
 * rest folded to hyphens, never empty, never long.
 */
export function documentFileName(title: string): string {
  const stem = title.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return `${stem || "visionex-document"}.docx`;
}
