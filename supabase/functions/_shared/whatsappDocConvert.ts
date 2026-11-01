// "Make this PDF a Word file", from a document sent on WhatsApp.
//
// The same shape as the audio, video and image conversions next to it
// (whatsappConvertIntent.ts): the file is the input and arrives as its own
// message, a few words name what it should become, and the work happens in the
// queue after the 200 has gone back. What differs is the engine on the other
// end — LibreOffice behind `/doc-convert` rather than ffmpeg behind `/convert`.
//
// ── What a sender may ask for ───────────────────────────────────────────────
//
// Only what Meta will carry back as a document: PDF, Word, plain text, Excel and
// PowerPoint. The service also writes ODT, RTF, HTML, ODS, CSV and ODP; those
// stay on the website, because a conversion WhatsApp cannot deliver is a minute
// of queue followed by an apology (whatsappAssetDelivery.ts has the table).
//
// ── Why a bare "Word" is not always a request ───────────────────────────────
//
// "pdf", "docx", "xlsx" and "pptx" mean nothing else, so on a document they are
// request enough. "word", "text" and their Arabic equivalents are ordinary
// words: a caption "translate this word" is not a conversion. Those need a
// cue (convert, turn it into, to, حوّل, إلى) or must be the whole message.
//
// The format names themselves are the same word in every language, so — as for
// audio — only the verb and the two or three product names need listing.

export type DocFormat = "pdf" | "docx" | "doc" | "odt" | "rtf" | "txt" | "html" | "xlsx" | "xls" | "ods" | "csv" | "pptx" | "ppt" | "odp";

/** What WhatsApp can send back, with the name Meta's list gives it. */
export const WHATSAPP_DOC_TARGETS: Readonly<Record<string, { label: string; mime: string }>> = Object.freeze({
  pdf: { label: "PDF", mime: "application/pdf" },
  docx: { label: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  txt: { label: "TXT", mime: "text/plain" },
  xlsx: { label: "Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { label: "PowerPoint", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
});

export const WHATSAPP_DOC_TARGET_NAMES: readonly string[] = Object.freeze(Object.keys(WHATSAPP_DOC_TARGETS));

/** Mirrors `FAMILY_OF_INPUT` in the service; a test reads both and fails if they differ. */
const FAMILY: Readonly<Record<string, "pdf" | "text" | "sheet" | "slides">> = Object.freeze({
  pdf: "pdf",
  docx: "text", doc: "text", odt: "text", rtf: "text", txt: "text", html: "text",
  xlsx: "sheet", xls: "sheet", ods: "sheet", csv: "sheet",
  pptx: "slides", ppt: "slides", odp: "slides",
});

/** The same outputs, restricted to what WhatsApp can deliver. */
const OUTPUTS: Readonly<Record<"pdf" | "text" | "sheet" | "slides", readonly string[]>> = Object.freeze({
  pdf: ["docx", "txt"],
  text: ["pdf", "docx", "txt"],
  sheet: ["pdf", "xlsx"],
  slides: ["pdf", "pptx"],
});

const MIME_TO_FORMAT: Readonly<Record<string, DocFormat>> = Object.freeze({
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "text/plain": "txt",
  "text/html": "html",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "text/csv": "csv",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.presentation": "odp",
});

/**
 * What a document attachment is, from its MIME type or its name; `null` for
 * anything this cannot convert. WhatsApp phones often send a generic
 * `application/octet-stream`, so the extension is the fallback.
 */
export function docSourceFormat(media: { mimeType?: string | null; filename?: string | null }): DocFormat | null {
  const mime = (media.mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (MIME_TO_FORMAT[mime]) return MIME_TO_FORMAT[mime];
  const ext = (media.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  return Object.prototype.hasOwnProperty.call(FAMILY, ext) ? (ext as DocFormat) : null;
}

/** Targets that can be made from this source and delivered, never the source itself. */
export function offeredDocTargets(source: DocFormat): readonly string[] {
  return OUTPUTS[FAMILY[source]].filter((target) => target !== source);
}

const fold = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

/** A caption longer than this is a question or a translation request, not a format. */
export const DOC_CONVERT_MAX_CHARS = 80;

const NOT_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_AFTER = "(?![\\p{L}\\p{N}])";
const word = (alternatives: string) => new RegExp(`${NOT_BEFORE}(?:${alternatives})${NOT_AFTER}`, "u");

// Names that mean nothing else: enough on their own.
const UNAMBIGUOUS: ReadonlyArray<readonly [string, RegExp]> = [
  ["pdf", word("pdf|بي دي اف|بيدي اف|بى دى اف")],
  ["docx", word("docx")],
  ["xlsx", word("xlsx|excel|اكسل|اكسيل")],
  ["pptx", word("pptx|powerpoint|power point|بوربوينت|باوربوينت")],
  ["txt", word("txt")],
];

// Ordinary words that are also format names: they need a cue.
const AMBIGUOUS: ReadonlyArray<readonly [string, RegExp]> = [
  ["docx", word("word|وورد|ورد|مايكروسوفت وورد")],
  ["txt", word("text|plain text|نص|نص عادي|ملف نصي")],
];

// "convert", "turn into", "make", "save as", "to", and the Arabic for them.
const CUE = word(
  "convert|turn|make|change|save|export|into|to|as|حول|تحويل|اجعل|اجعله|اجعلها|صدر|احفظ|الى|الي|ك|ل",
);

const TRANSLATE = word("translate|translation|ترجم|ترجمه|traduci|traduire|übersetze|traduz");

/**
 * What the message asks the file to become, and from what, or null.
 *
 * Only ever one target: a caption naming two (“pdf and word”) is ambiguous and
 * the sender gets the menu rather than a guess. A translation request is never
 * a conversion, even when it names a format.
 */
export function parseDocConvertRequest(params: {
  text: string;
  source: DocFormat;
}): { target: string; from: DocFormat } | null {
  const text = fold(params.text ?? "");
  if (!text || text.length > DOC_CONVERT_MAX_CHARS) return null;
  if (TRANSLATE.test(text)) return null;

  const found = new Set<string>();
  for (const [target, pattern] of UNAMBIGUOUS) if (pattern.test(text)) found.add(target);
  const cued = CUE.test(text) || AMBIGUOUS.some(([, pattern]) => pattern.test(text) && text.split(/\s+/).length <= 2);
  const ambiguousHit = AMBIGUOUS.some(([, pattern]) => pattern.test(text));
  if (cued) for (const [target, pattern] of AMBIGUOUS) if (pattern.test(text)) found.add(target);
  // "pdf and word": a second name without a cue to say it is the target. Ask, do not guess.
  if (ambiguousHit && !cued && found.size > 0) return null;

  // "pdf to word" names the file it was sent with; that is the source, not a second target.
  found.delete(params.source);
  if (found.size !== 1) return null;
  const target = [...found][0];
  if (!offeredDocTargets(params.source).includes(target)) return null;
  return { target, from: params.source };
}
