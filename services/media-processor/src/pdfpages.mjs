// Turning the pages of a PDF into pictures.
//
// A PDF with no text layer is a stack of photographs, and the only way to read
// one is to look at it. The assistant's models can look at an image at high
// detail, where they are asked to; what they cannot do is choose how a whole PDF
// is rasterised when it is handed over as a file. This renders the first pages
// here, at a size we pick, so the model is shown legible pages rather than
// whatever resolution the provider happened to use.
//
// Pure helpers only (limits, validation, parsing). The processes themselves are
// run by `runTool` in server.mjs, the same way Tesseract and zbar are.

/** The largest PDF accepted. Equal to the nginx body limit in front of this route (12 MB). */
export const MAX_PDF_BYTES = 12 * 1024 * 1024;

/** Pages rendered per request. A scan beyond this is answered from its opening pages, and says so. */
export const MAX_PDF_PAGES = 6;
export const DEFAULT_PDF_PAGES = 4;

/**
 * The longer side of each rendered page, in pixels. Fixed rather than a DPI so
 * a hostile page size (a PDF may declare a sheet the size of a building) cannot
 * ask for a gigapixel bitmap: the output is bounded whatever the input says.
 */
export const PDF_PAGE_EDGE_PX = 1500;

export const PDF_RENDER_TIMEOUT_MS = 45_000;
export const PDFINFO_TIMEOUT_MS = 10_000;

/** Pages whose rendering would be larger than this are dropped, so one response stays small. */
export const MAX_PAGE_JPEG_BYTES = 900 * 1024;
export const MAX_TOTAL_JPEG_BYTES = 4 * 1024 * 1024;

/**
 * A PDF starts with `%PDF-`. The spec lets a few bytes of junk precede it, and
 * real files have them, so the first kilobyte is searched rather than the first
 * five bytes. The declared MIME is a claim made by a phone; the bytes decide.
 */
export function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const head = Buffer.from(bytes.subarray(0, Math.min(1024, bytes.length))).toString("latin1");
  return head.includes("%PDF-");
}

export function checkPdfUpload(bytes) {
  if (!bytes || bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, reason: "too_large" };
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not_a_pdf" };
  return { ok: true };
}

/** How many pages the caller asked for, clamped; a missing or malformed value is the default. */
export function pagesFromQuery(value) {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return DEFAULT_PDF_PAGES;
  const n = Number(value);
  if (n < 1) return DEFAULT_PDF_PAGES;
  return Math.min(n, MAX_PDF_PAGES);
}

/** The page count from `pdfinfo` output, or null. */
export function parsePdfInfo(stdout) {
  const pages = /^Pages:\s+(\d{1,6})\s*$/m.exec(typeof stdout === "string" ? stdout : "");
  const encrypted = /^Encrypted:\s+yes\b/im.test(typeof stdout === "string" ? stdout : "");
  return { pages: pages ? Number(pages[1]) : null, encrypted };
}

const JPEG_START = [0xff, 0xd8, 0xff];
export const isJpeg = (bytes) => !!bytes && bytes.length > 4 && JPEG_START.every((b, i) => bytes[i] === b);

/**
 * Keep the rendered pages that are real JPEGs and fit the budget, in page
 * order, stopping at the first page that would exceed the total.
 */
export function selectPages(rendered) {
  const kept = [];
  let total = 0;
  for (const page of rendered) {
    if (!isJpeg(page.bytes) || page.bytes.length > MAX_PAGE_JPEG_BYTES) continue;
    if (total + page.bytes.length > MAX_TOTAL_JPEG_BYTES) break;
    total += page.bytes.length;
    kept.push(page);
  }
  return kept;
}

/** `out-1.jpg`, `out-02.jpg`, `out-003.jpg` → the page number; anything else → null. */
export function pageNumberOf(filename) {
  const m = /^out-(\d{1,4})\.jpg$/.exec(filename);
  return m ? Number(m[1]) : null;
}
