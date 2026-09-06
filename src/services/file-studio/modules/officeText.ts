// ─── The words out of a Word document or a slide deck, in the tab ────────────
//
// A .docx and a .pptx are ZIP archives of XML, and the ZIP reader written for
// the archive module reads them as they are. So the document module can hand a
// visitor the text of their file without a round trip, an account, or the 16 MB
// ceiling the server path carries.
//
// ── Why this is not a second implementation ─────────────────────────────────
//
// `services/media-processor/src/office.mjs` extracts the same text for the
// WhatsApp assistant, and the *rules* below are that file's rules, deliberately
// and line for line: only `<w:t>` and `<a:t>` hold visible text, paragraph ends
// become line breaks, tabs and breaks become spaces, `word/document.xml` is the
// only Word part read, and slides are numbered so slide 10 does not sort next
// to slide 1. What differs is the runtime — that module runs on the server
// behind a bearer token the browser cannot hold, and `file-convert` proxies
// conversion only. Two runtimes, one set of rules; if the rules change, they
// change in both, which is what `file-studio-office.test.ts` and
// `whatsapp-office.test.ts` are each there to notice.
//
// Word's headers and footers are excluded on purpose: they repeat on every
// page, and text prefixed by the same letterhead thirty times is harder to
// listen to, not more complete.

import { readZip, ArchiveError } from "./archiveFormats";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML entities, including the numeric ones OOXML uses for odd characters. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (_whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body] ?? "";
  });
}

/**
 * The words out of one OOXML part.
 *
 * Stripping every tag instead would be shorter and would also sweep up revision
 * identifiers, style names, relationship targets and the odd base64 blob.
 * Paragraph ends become line breaks because structure carries meaning: an
 * address, a list of ingredients and a set of bullets all stop being readable
 * when they are run into one line.
 */
export function textFromOoxml(xml: string): string {
  const pattern = /<(?:w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|a):t>|<\/(?:w|a):p>|<(?:w|a):(?:tab|br)\s*\/?>/g;
  let out = "";
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    if (match[1] !== undefined) out += decodeEntities(match[1]);
    else if (match[0].startsWith("</")) out += "\n";
    else out += " ";
  }

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Which parts of the archive hold the words, per format. */
const PARTS: Record<string, RegExp> = {
  docx: /^word\/document\.xml$/,
  pptx: /^ppt\/slides\/slide\d+\.xml$/,
};

export const OFFICE_TEXT_FORMATS = Object.keys(PARTS);

export const isOfficeTextFormat = (value: string): boolean =>
  Object.prototype.hasOwnProperty.call(PARTS, value);

/** Slide 2 must not sort after slide 10. */
const slideNumber = (name: string) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);

const decoder = new TextDecoder("utf-8", { fatal: false });

/**
 * The readable text of a .docx or a .pptx.
 *
 * Slides are separated by a blank line, which is the one piece of structure a
 * plain-text rendering of a deck can carry without inventing headings that were
 * never in the file.
 */
export async function officeText(bytes: Uint8Array, kind: string): Promise<string> {
  const pattern = PARTS[kind];
  if (!pattern) throw new ArchiveError(`${kind.toUpperCase()} isn't a format this reads.`);

  let entries;
  try {
    entries = await readZip(bytes);
  } catch (err) {
    // A .docx that is not a ZIP is not a .docx, whatever it is named, and the
    // ZIP reader's own message would talk about an archive the visitor never
    // knew they had.
    throw new ArchiveError(
      err instanceof ArchiveError && /password|ZIP64|compression/i.test(err.message)
        ? err.message
        : `This file isn't a readable ${kind.toUpperCase()} — it may be damaged, or an older format saved under a new name.`,
    );
  }

  const wanted = entries.filter((entry) => pattern.test(entry.name));
  if (kind === "pptx") wanted.sort((a, b) => slideNumber(a.name) - slideNumber(b.name));
  if (wanted.length === 0) {
    throw new ArchiveError(`This ${kind.toUpperCase()} has no readable text inside it.`);
  }

  const parts = wanted.map((entry) => textFromOoxml(decoder.decode(entry.data))).filter(Boolean);
  const text = parts.join("\n\n");
  if (text.length === 0) {
    throw new ArchiveError(`This ${kind.toUpperCase()} holds pictures and no text.`);
  }
  return text;
}
