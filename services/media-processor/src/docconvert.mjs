// Turning one kind of document into another: PDF ⇄ Word and its relatives.
//
// ── What does the work ──────────────────────────────────────────────────────
//
// LibreOffice, headless, in this container. It is a document engine and not a
// text extractor, which is why a Word file comes out as a Word file and a
// spreadsheet keeps its cells. Poppler (already installed for page rendering)
// reads the text layer of a PDF, and Tesseract (already installed, with the
// Arabic model) reads a PDF that is only pictures.
//
// ── Why Arabic is the thing to get right ────────────────────────────────────
//
// Most of this service's traffic is Arabic, and a converter that reverses a
// paragraph or leaves it left-aligned is worse than none: the reader cannot
// tell what was lost. Two places decide it, both here:
//   - the container carries Arabic-capable fonts, so a conversion to PDF draws
//     letters instead of boxes (see the Dockerfile);
//   - text that has no layout of its own (a .txt, the output of OCR) is wrapped
//     in HTML whose paragraphs carry their own direction, so Word opens it
//     right-to-left and right-aligned where the text is.
//
// Pure helpers only. The processes themselves are run by `runTool` in
// server.mjs, the same way Tesseract, zbar and ffmpeg are.

/** Equal to the media ceiling and to nginx's body limit in front of this route. */
export const MAX_DOC_BYTES = 16 * 1024 * 1024;

/** LibreOffice cold-starts in several seconds and a big workbook takes longer. nginx waits 120 s. */
export const DOC_TIMEOUT_MS = 90_000;

/**
 * The whole request's budget. nginx waits 120 s in front of this route; a
 * scanned PDF is several steps in a row, so each step is given what is left of
 * this rather than its own full timeout, and the caller gets an answer (or an
 * honest refusal) before the proxy gives up on it.
 */
export const DOC_BUDGET_MS = 105_000;

/** Reading pages stops when less than this is left, to leave room for building the file. */
export const OCR_RESERVE_MS = 30_000;

/** The time a step may take: its own limit, or what is left of the budget, never under a floor. */
export const stepTimeout = (ownLimitMs, deadline, now = Date.now()) =>
  Math.max(15_000, Math.min(ownLimitMs, deadline - now));

/** A document larger than this on the way out is not something a chat or a page can carry. */
export const MAX_DOC_OUTPUT_BYTES = 48 * 1024 * 1024;

/** Pages of a scanned PDF that are read; later pages are dropped and the caller is told. */
export const MAX_OCR_PAGES = 10;

/**
 * A PDF that needs reading by eye and has no more pages than this is answered in
 * the same request. A longer one becomes a job: the answer is a job id, the
 * caller polls, and nothing waits on a proxy for ten minutes. At about four
 * seconds a page, eight pages is the most that fits inside the 105 s budget.
 */
export const MAX_SYNC_OCR_PAGES = 8;

/** The most pages one job reads. A 16 MB upload can hold more; 400 is already half an hour. */
export const MAX_JOB_PAGES = 400;
/** Pages rendered and read per step, so a long job never holds hundreds of page images. */
export const JOB_BATCH_PAGES = 5;
/** A job that has not finished by then is abandoned. */
export const JOB_MAX_MS = 40 * 60_000;
/** How long a finished (or failed) job is kept for the caller to collect it. */
export const JOB_TTL_MS = 50 * 60_000;
/** Jobs waiting or running at once; a further request is told to come back. */
export const JOB_MAX_QUEUED = 4;
/** Building the Word file from hundreds of pages takes longer than the interactive limit. */
export const JOB_SOFFICE_TIMEOUT_MS = 300_000;

/** A job id is 128 random bits in hex. Anything else is not one. */
export const isJobId = (value) => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
export const OCR_RENDER_DPI = 200;
export const PDFTOTEXT_TIMEOUT_MS = 20_000;
export const PDFTOPPM_TIMEOUT_MS = 60_000;

/** Fewer visible characters than this in a whole PDF means it has no text layer worth keeping. */
export const MIN_TEXT_LAYER_CHARS = 40;

// ── What can become what ─────────────────────────────────────────────────────

/**
 * Every output, with the name LibreOffice's `--convert-to` wants.
 *
 * The filter after the colon matters: `docx` alone is accepted but picks
 * whatever default the installed version has, and `txt` alone writes in the
 * system encoding, which is not UTF-8 in a container with no locale.
 */
export const DOC_TARGETS = Object.freeze({
  pdf: { mime: "application/pdf", ext: "pdf", convert: "pdf" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
    convert: "docx:MS Word 2007 XML",
  },
  odt: { mime: "application/vnd.oasis.opendocument.text", ext: "odt", convert: "odt:writer8" },
  rtf: { mime: "application/rtf", ext: "rtf", convert: "rtf:Rich Text Format" },
  txt: { mime: "text/plain; charset=utf-8", ext: "txt", convert: "txt:Text (encoded):UTF8" },
  html: { mime: "text/html; charset=utf-8", ext: "html", convert: "html:XHTML Writer File:UTF8" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
    convert: "xlsx:Calc MS Excel 2007 XML",
  },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", ext: "ods", convert: "ods:calc8" },
  csv: {
    mime: "text/csv; charset=utf-8",
    ext: "csv",
    // comma, double quote, UTF-8, quote text cells, detect special numbers
    convert: "csv:Text - txt - csv (StarCalc):44,34,76,1",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
    convert: "pptx:Impress MS PowerPoint 2007 XML",
  },
  odp: { mime: "application/vnd.oasis.opendocument.presentation", ext: "odp", convert: "odp:impress8" },
});

export const DOC_TARGET_NAMES = Object.freeze(Object.keys(DOC_TARGETS));

/** The family decides what a file may become. */
export const FAMILY_OF_INPUT = Object.freeze({
  pdf: "pdf",
  docx: "text", doc: "text", odt: "text", rtf: "text", txt: "text", html: "text",
  xlsx: "sheet", xls: "sheet", ods: "sheet", csv: "sheet",
  pptx: "slides", ppt: "slides", odp: "slides",
});

export const OUTPUTS_BY_FAMILY = Object.freeze({
  pdf: ["docx", "odt", "txt"],
  text: ["pdf", "docx", "odt", "rtf", "txt", "html"],
  sheet: ["pdf", "xlsx", "ods", "csv"],
  slides: ["pdf", "pptx", "odp"],
});

export const DOC_INPUT_NAMES = Object.freeze(Object.keys(FAMILY_OF_INPUT));

export const isDocInput = (value) => typeof value === "string" && Object.hasOwn(FAMILY_OF_INPUT, value);
export const isDocTarget = (value) => typeof value === "string" && Object.hasOwn(DOC_TARGETS, value);

/** Whether `from` may become `to`. A file never converts to its own format. */
export function canConvertDocument(from, to) {
  if (!isDocInput(from) || !isDocTarget(to) || from === to) return false;
  return OUTPUTS_BY_FAMILY[FAMILY_OF_INPUT[from]].includes(to);
}

// ── Reading what a file is from its bytes ────────────────────────────────────

const has = (bytes, text) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length).includes(text);

/**
 * What these bytes are, or null.
 *
 * The declared name is a claim made by a phone; the bytes decide wherever they
 * can. The one place they cannot is the old binary Office format, where Word,
 * Excel and PowerPoint share a container: there the caller's extension is used,
 * but only among the three that belong to it.
 */
export function sniffDocument(bytes, claimed) {
  if (!bytes || bytes.length < 8) return null;
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(1024, bytes.length)).toString("latin1");

  if (head.includes("%PDF-")) return "pdf";
  if (head.startsWith("{\\rtf")) return "rtf";

  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // OpenDocument stores its type as the first, uncompressed entry.
    const odf = /application\/vnd\.oasis\.opendocument\.(text|spreadsheet|presentation)/.exec(
      Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(2048, bytes.length)).toString("latin1"),
    );
    if (odf) return odf[1] === "text" ? "odt" : odf[1] === "spreadsheet" ? "ods" : "odp";
    if (has(bytes, "word/document.xml")) return "docx";
    if (has(bytes, "xl/workbook.xml")) return "xlsx";
    if (has(bytes, "ppt/presentation.xml")) return "pptx";
    return null;
  }

  // Compound File Binary: .doc, .xls and .ppt all start the same way.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return claimed === "doc" || claimed === "xls" || claimed === "ppt" ? claimed : null;
  }

  // Plain text, HTML and CSV have no signature. Believe the extension only if
  // the bytes look like text, so a renamed binary is not handed to the engine.
  if (claimed === "txt" || claimed === "html" || claimed === "csv") {
    const sample = bytes.subarray(0, Math.min(4096, bytes.length));
    for (let i = 0; i < sample.length; i++) if (sample[i] === 0) return null;
    return claimed;
  }
  return null;
}

/** `?from=pdf&to=docx`, both checked against the allowlists. `from` may be omitted. */
export function readDocQuery(params) {
  const to = (params.get("to") ?? "").toLowerCase();
  const fromRaw = params.get("from");
  const from = fromRaw === null ? null : fromRaw.toLowerCase();
  if (!isDocTarget(to)) return { ok: false, reason: "unsupported_target" };
  if (from !== null && !isDocInput(from)) return { ok: false, reason: "unsupported_source" };
  return { ok: true, from, to };
}

// ── Text that has no layout of its own ───────────────────────────────────────

const RTL_LETTER = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/gu;
const LTR_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿऀ-ॿ぀-ヿ一-鿿가-힯]/gu;

/** True when a paragraph reads right to left: more RTL letters than any other kind. */
export function isRtlParagraph(text) {
  const rtl = (text.match(RTL_LETTER) ?? []).length;
  if (rtl === 0) return false;
  return rtl >= (text.match(LTR_LETTER) ?? []).length;
}

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Plain text, or OCR output, as an HTML document whose every paragraph carries
 * its own direction. `pages` is a list of strings; a page break is emitted
 * between them so a scanned book keeps its pages.
 *
 * Blank lines separate paragraphs; a single newline inside one is a line break,
 * which is what a hard-wrapped text file or an OCR'd column means by it.
 */
export function textToHtml(pages) {
  const body = [];
  pages.forEach((page, index) => {
    const paragraphs = String(page).replace(/\r\n?/g, "\n").split(/\n{2,}/);
    let first = true;
    for (const raw of paragraphs) {
      const text = raw.replace(/[ \t]+\n/g, "\n").trim();
      if (!text) continue;
      const rtl = isRtlParagraph(text);
      const style = [
        rtl ? "text-align:right" : "",
        index > 0 && first ? "page-break-before:always" : "",
      ].filter(Boolean).join(";");
      body.push(
        `<p dir="${rtl ? "rtl" : "ltr"}"${style ? ` style="${style}"` : ""}>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>`,
      );
      first = false;
    }
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body>${body.join("")}</body></html>`;
}

/**
 * poppler wraps every right-to-left line in an embedding pair (U+202B ... U+202C,
 * and U+202A for the left-to-right runs inside). They are not text: a .txt file
 * that carries them is searched, pasted and diffed wrongly, and one Arabic
 * sentence is then four characters longer than it reads. Removed from text
 * output; the isolates (U+2066 to U+2069) go with them.
 */
export const stripBidiControls = (text) => String(text).replace(/[\u202a-\u202e\u2066-\u2069]/gu, "");

// ── Why Arabic PDFs are read by eye ──────────────────────────────────────────
//
// The text layer of an Arabic PDF is not safe to copy out. Measured on the
// server on PDFs written by Chrome and by LibreOffice alike: poppler returns
// the lam-alef ligature as alef-lam, so «السلام» comes back «السالم», «لا» comes
// back «ال», and no later step can tell a swapped pair from the article «ال»,
// which is the commonest pair in the language. LibreOffice's own PDF import is
// worse for editing: one text box per word, in presentation-form letters, in
// visual order. Tesseract reading the rendered page (Arabic model) has neither
// fault, so an Arabic PDF is read that way even when it has a text layer.
//
// Persian and Urdu are excluded: the Arabic model does not know their letters
// (پ چ ژ گ ک ی ٹ ڈ ں ے ...), and reading them wrongly is worse than the
// ligature swap. They keep the text layer.

// ── Which language to read a page in ─────────────────────────────────────────
//
// Tesseract's orientation-and-script detection says which script a page is in
// (and, as a side effect, whether it is upside down). The script picks the
// models: reading Latin text with only the Arabic model, or Arabic with only the
// English one, is the quickest way to get nonsense. Latin gets a handful of
// European models together, which costs time but is what accents need; the rest
// of the world's Latin-script languages are read as English, accents lost.

export const OCR_LANGUAGE_BY_SCRIPT = Object.freeze({
  Arabic: "ara+eng",
  Latin: "eng+fra+spa+deu+ita+por+tur",
  Cyrillic: "rus+eng",
  Devanagari: "hin+eng",
  Bengali: "ben+eng",
  Han: "chi_sim+chi_tra+eng",
  Japanese: "jpn+eng",
  Hangul: "kor+eng",
});

/** Every model name the table above may use; the Dockerfile installs exactly these. */
export const OCR_MODELS = Object.freeze([
  "eng", "ara", "fas", "urd", "fra", "spa", "deu", "ita", "por", "tur", "rus", "hin", "ben", "chi_sim", "chi_tra", "jpn", "kor",
]);

export const DEFAULT_OCR_LANGUAGE = "ara+eng";

/** The script from `tesseract --psm 0` output ("Script: Arabic"), or null. */
export function parseOsdScript(output) {
  const m = /^Script:\s*([A-Za-z]+)\s*$/m.exec(typeof output === "string" ? output : "");
  return m ? m[1] : null;
}

export const languageForScript = (script) => OCR_LANGUAGE_BY_SCRIPT[script] ?? DEFAULT_OCR_LANGUAGE;

const URDU_ONLY = /[\u0679\u0688\u0691\u06ba\u06be\u06c1\u06d2]/u;
const PERSIAN_ONLY = /[\u067e\u0686\u0698\u06af\u06a9\u06cc]/u;

/**
 * Arabic-script text that the Arabic model read, looked at again: Urdu and
 * Persian share the script and have letters it does not. Returns the language
 * to read the document in, or null to keep the one it was read in.
 */
export function refineArabicLanguage(text) {
  if (typeof text !== "string") return null;
  if (URDU_ONLY.test(text)) return "urd+eng";
  if (PERSIAN_ONLY.test(text)) return "fas+eng";
  return null;
}

export const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/u;
export const PERSIAN_URDU_LETTERS = /[\u067e\u0686\u0698\u06af\u06a9\u06cc\u0679\u0688\u0691\u06ba\u06be\u06c1\u06d2]/u;

/** True when this text layer is Arabic and the Arabic model can be trusted to read it. */
export const needsOcrForArabic = (text) => typeof text === "string" && ARABIC_SCRIPT.test(text);

/** Visible characters in extracted PDF text, for deciding whether there is a text layer. */
export const visibleChars = (text) => (typeof text === "string" ? text.replace(/[\s\f​-‏‪-‮]/gu, "").length : 0);

/**
 * Fewer visible characters than this across a whole document read by eye means
 * the reading found nothing. Much lower than MIN_TEXT_LAYER_CHARS on purpose:
 * that one asks "is there a text layer worth keeping" of a page that may hold a
 * single stamp, this one asks "did the reader find any words" of a document that
 * may be one table, or fourteen one-line pages.
 */
export const MIN_READ_CHARS = 6;

export const hasTextLayer = (text) => visibleChars(text) >= MIN_TEXT_LAYER_CHARS;

// ── The command lines ────────────────────────────────────────────────────────

/** Filters that make the engine read a text-like input as UTF-8 instead of guessing. */
const INPUT_FILTERS = Object.freeze({
  csv: "CSV:44,34,76,1",
  // Opened as a Writer document, not Writer/Web, so every export filter applies.
  html: "HTML (StarWriter)",
});

/**
 * Arguments for one `soffice` run. `profileDir` is a throwaway user profile in
 * the request's own directory: the container's home is not writable, and two
 * conversions must never share a profile lock.
 */
export function sofficeArgs({ input, outDir, profileDir, from, to }) {
  const args = [
    "--headless", "--norestore", "--nolockcheck", "--nodefault", "--nologo", "--nofirststartwizard",
    `-env:UserInstallation=file://${profileDir}`,
  ];
  if (from === "pdf") args.push("--infilter=writer_pdf_import");
  else if (INPUT_FILTERS[from]) args.push(`--infilter=${INPUT_FILTERS[from]}`);
  args.push("--convert-to", DOC_TARGETS[to].convert, "--outdir", outDir, input);
  return args;
}

/** Arguments for `pdftoppm`: grey PNGs at a fixed DPI, the first `pages` only. */
export const pdftoppmArgs = (input, prefix, last = MAX_OCR_PAGES, first = 1) => [
  "-png", "-gray", "-r", String(OCR_RENDER_DPI), "-f", String(first), "-l", String(last), input, prefix,
];

export const pdftotextArgs = (input, output, first = 1) => [
  "-enc", "UTF-8", "-nopgbrk", ...(first > 1 ? ["-f", String(first)] : []), input, output,
];

/** `out-01.png`, `out-1.png`, `out-001.png` → the page number; anything else → null. */
export function pngPageNumber(filename) {
  const m = /^pg-(\d{1,4})\.png$/.exec(filename);
  return m ? Number(m[1]) : null;
}
