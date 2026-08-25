// What this service will and will not accept, as data.
//
// Separated from the server so the rules can be tested without opening a socket
// or spawning a binary — the same reason every decision in the WhatsApp Edge
// Function lives in a pure module beside the I/O that performs it.
//
// The numbers deliberately mirror `whatsappMedia.ts` and `whatsappFileSafety.ts`
// rather than inventing a second set. Two services with different ideas of how
// large an image may be is how a file gets accepted by one and refused by the
// other, and the customer is told something that is only true of half the
// system.

/** Bytes accepted in one request body. Matches the WhatsApp image ceiling. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Pixels this service will decode. Matches `MAX_IMAGE_PIXELS`. */
export const MAX_IMAGE_PIXELS = 50_000_000;

/** Longest edge accepted, so a long thin strip is refused on shape alone. */
export const MAX_IMAGE_EDGE = 20_000;

/**
 * How long one OCR run may take before it is abandoned.
 *
 * Tesseract on a page of clean print is well under a second on this hardware.
 * Fifteen seconds is not a performance target — it is the point past which
 * something has gone wrong and the process should be reclaimed rather than
 * left holding a core.
 */
export const OCR_TIMEOUT_MS = 15_000;

/**
 * Requests processed at once.
 *
 * The server has four cores and Tesseract will use one fully. Two leaves
 * headroom for the website, the deploy build and everything else the box does,
 * and it is the difference between a queue that is slow and a machine that is
 * unresponsive.
 */
export const MAX_CONCURRENT = 2;

/** Requests queued behind those. Beyond this the caller is told to retry. */
export const MAX_QUEUED = 8;

/** Language packs installed in the image. Anything else is refused by name. */
export const SUPPORTED_LANGUAGES = ["ara", "eng", "ara+eng"];

/**
 * Whether a language string is one this image can actually load.
 *
 * Checked rather than passed through, because the value reaches a command line.
 * Tesseract takes `-l ara+eng`, so a plus is legitimate and an allowlist of
 * whole strings is simpler to be sure about than a parser.
 */
export const isSupportedLanguage = (value) => typeof value === "string" && SUPPORTED_LANGUAGES.includes(value);

/**
 * The language a query string actually asked for.
 *
 * A plus sign in a query decodes to a space, so a caller writing the obvious
 * `?lang=ara+eng` is heard as `ara eng` and refused. The caller was fixed to
 * encode it, but the ambiguity is in the URL syntax rather than in that one
 * caller, and the next one will make the same mistake.
 *
 * A space is never valid in a Tesseract language spec, so reading it as the
 * plus it must have been is unambiguous. The allowlist above is still the only
 * thing that decides — this normalises the input to it, it does not widen it.
 */
export const languageFromQuery = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, "+") : value;

/**
 * How Tesseract should carve the page up.
 *
 * Tesseract's default is 3, "fully automatic page segmentation", which assumes
 * a page. A photograph of a sign is not a page: it is one or two lines of large
 * text on a mostly empty background, and the layout analysis can decide there
 * is no text region at all and return nothing — exiting 0, having read nothing,
 * which is indistinguishable from "there were no words".
 *
 * That is the open question about Arabic on this box. `ara.traineddata` is
 * installed, Tesseract exits 0, and a large, correctly shaped, high-contrast
 * Arabic image reads as empty. Segmentation is one of the two remaining
 * explanations and this makes it testable instead of arguable.
 *
 * Allowlisted rather than parsed, for the same reason the language is: the
 * value reaches a command line. 6 is a uniform block, 7 a single line, 11
 * sparse text — the three that suit a photograph rather than a scanned page.
 */
export const SUPPORTED_PSM = ["3", "6", "7", "11"];

export const isSupportedPsm = (value) => typeof value === "string" && SUPPORTED_PSM.includes(value);

/**
 * Which recognition engine Tesseract should use.
 *
 * 0 is the legacy engine, 1 is LSTM, 3 is "whichever the model supports".
 * 3 is the default and is what has been running.
 *
 * This exists because of a specific, reproducible result: a 995x391 image of
 * two Arabic words, set in Noto Sans Arabic at 96pt with a wide quiet border,
 * reads as completely empty under every segmentation mode and both language
 * settings — while the identical English probe reads perfectly. Reading
 * *nothing at all* from clean large text is not what poor accuracy looks like;
 * it is what an engine that cannot use the model it was handed looks like.
 *
 * A language pack built for one engine and run under another can produce
 * exactly this: exit 0, no error, no text. Naming the engine turns that from a
 * theory into a measurement.
 */
export const SUPPORTED_OEM = ["0", "1", "3"];

export const isSupportedOem = (value) => typeof value === "string" && SUPPORTED_OEM.includes(value);

/**
 * What the bytes say this file is. A narrow copy of `sniffMime`.
 *
 * The Edge Function already checks this before forwarding, so this is the
 * second gate rather than the first. It exists because a service that is
 * reachable over the network has to assume its caller might not be the one it
 * was built for.
 */
export function sniffImage(bytes) {
  const at = (i) => (i < bytes.length ? bytes[i] : -1);
  const ascii = (start, length) => {
    if (bytes.length < start + length) return "";
    let out = "";
    for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]);
    return out;
  };

  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  return null;
}

/** Width and height from the header, without decoding. */
export function readDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, length) => {
    if (bytes.length < start + length) return "";
    let out = "";
    for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]);
    return out;
  };

  if (bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (ascii(0, 3) === "GIF") {
    if (bytes.length < 10) return null;
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    for (let guard = 0; guard < 2048 && i + 9 < bytes.length; guard++) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
      const length = view.getUint16(i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
  }
  return null;
}

/**
 * Whether this upload may be processed.
 *
 * Every refusal is a named reason rather than a boolean, because the caller
 * turns it into something a customer reads and "no" is not translatable.
 */
export function checkUpload(bytes, declaredMime) {
  if (!bytes || bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const sniffed = sniffImage(bytes);
  if (!sniffed) return { ok: false, reason: "not_an_image" };

  if (declaredMime && !declaredMime.startsWith("image/")) {
    return { ok: false, reason: "mime_mismatch" };
  }

  const dimensions = readDimensions(bytes);
  if (dimensions) {
    const { width, height } = dimensions;
    if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
      return { ok: false, reason: "edge_too_long" };
    }
    if (width * height > MAX_IMAGE_PIXELS) {
      return { ok: false, reason: "too_many_pixels" };
    }
  }

  return { ok: true, sniffed, dimensions };
}

/**
 * How much of a Tesseract run is worth keeping.
 *
 * A page of dense text is a legitimate result; a megabyte of it is a decoder
 * that has found structure in noise. The ceiling matches the document budget
 * the Edge Function already applies downstream.
 */
export const MAX_TEXT_CHARS = 24_000;

/**
 * Whether OCR found something worth returning.
 *
 * Tesseract answers a photograph of a wall with whitespace and a handful of
 * stray marks. Reporting that as text would send the assistant off to explain
 * nothing, so a result this thin is reported as "nothing readable" — which is
 * a true answer and a useful one.
 */
export function textIsUsable(text) {
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 3) return false;
  // At least a few characters that are actually letters or digits, rather than
  // the punctuation soup a failed recognition produces.
  const meaningful = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  return meaningful.length >= 3;
}

// ── Barcodes ────────────────────────────────────────────────────────────────
//
// The second thing this service can do to a photograph, and the first one that
// works in every language. OCR here is English-only because Arabic recognition
// does not work on this box; a barcode has no language at all. The digits under
// a retail symbol are the same digits in Riyadh and in Helsinki, so this
// capability serves the whole audience rather than the half Tesseract can read.

/**
 * How long one zbar run may take.
 *
 * Shorter than OCR's fifteen seconds because the work is smaller: zbar scans
 * for a finder pattern rather than recognising letterforms, and on a phone
 * photograph it either finds one quickly or does not find one at all. Ten
 * seconds is the point past which the process should be reclaimed.
 */
export const BARCODE_TIMEOUT_MS = 10_000;

/**
 * Symbols returned from one image.
 *
 * A shelf photographed straight on can legitimately contain a dozen barcodes.
 * Reading all of them back to somebody is not an answer, so the scan is bounded
 * and the caller is told how many were seen.
 */
export const MAX_BARCODE_SYMBOLS = 8;

/**
 * Characters kept from one symbol's payload.
 *
 * A QR code can carry several kilobytes. This goes into a WhatsApp message that
 * somebody is going to hear read aloud, and past a certain length the honest
 * answer is "this is a long code" rather than four kilobytes of it.
 */
export const MAX_BARCODE_VALUE_CHARS = 1_200;

/**
 * The retail symbologies, whose payload is a product number and nothing else.
 *
 * This distinction is the whole security argument for the endpoint, so it is
 * data rather than a regex written at the call site. A symbol in this set
 * carries digits — it cannot carry a sentence, and therefore cannot carry an
 * instruction. Everything else (QR above all) carries arbitrary text somebody
 * else printed, and is treated the way `whatsappLocalOcr.ts` treats recognised
 * text: returned to the sender, never put in a prompt.
 */
export const RETAIL_SYMBOLOGIES = ["EAN-13", "EAN-8", "UPC-A", "UPC-E", "ISBN-13", "ISBN-10", "I2/5", "DataBar"];

export const isRetailSymbology = (value) => typeof value === "string" && RETAIL_SYMBOLOGIES.includes(value);

/**
 * Whether a string of digits is a real GTIN, by its own check digit.
 *
 * Every retail barcode carries a mod-10 checksum in its last digit precisely so
 * that a misread is detectable. Checking it here costs nothing and turns "zbar
 * returned some digits" into "these digits are internally consistent", which is
 * the difference between reading a product number aloud and reading a
 * misdecode aloud to somebody who cannot check it against the packet.
 *
 * ISBN-10 is deliberately not handled: it uses a mod-11 checksum with an `X`
 * terminator, so it fails this test and is reported as text rather than
 * silently accepted. That is the safe direction to be wrong in.
 */
export function gtinChecksumOk(digits) {
  if (typeof digits !== "string" || !/^\d+$/.test(digits)) return false;
  if (![8, 12, 13, 14].includes(digits.length)) return false;

  // Weights alternate 3 and 1 from the right, excluding the check digit.
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digits[i]) * weight;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[digits.length - 1]);
}

/**
 * What zbar said, as structured symbols.
 *
 * `zbarimg -q` prints one `SYMBOLOGY:payload` line per symbol. The payload may
 * itself contain a colon — a QR code holding a URL always does — so the split
 * is on the first colon only, and everything after it is the value.
 *
 * A line with no colon, an unknown symbology or an empty payload is dropped
 * rather than guessed at. This is parsing the output of a program that is being
 * handed hostile images; the failure mode to design for is a line that does not
 * look like the ones in the manual.
 */
export function parseBarcodeOutput(stdout) {
  const symbols = [];
  for (const line of String(stdout ?? "").split("\n")) {
    const trimmed = line.replace(/\r$/, "");
    if (!trimmed) continue;

    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;

    const symbology = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1);
    // A symbology name is short and has no spaces in it. Anything else is a
    // diagnostic line that escaped `-q`, not a symbol.
    if (!/^[A-Za-z0-9/+.-]{2,16}$/.test(symbology)) continue;
    if (!value) continue;

    const retail = isRetailSymbology(symbology) && gtinChecksumOk(value);
    symbols.push({
      symbology,
      value: value.slice(0, MAX_BARCODE_VALUE_CHARS),
      // `kind` rather than a boolean, because the caller branches on it and
      // "not retail" is a real category with its own handling, not an absence.
      kind: retail ? "product" : "text",
      truncated: value.length > MAX_BARCODE_VALUE_CHARS,
    });
    if (symbols.length >= MAX_BARCODE_SYMBOLS) break;
  }
  return symbols;
}

// ── Office documents ────────────────────────────────────────────────────────

/**
 * Bytes accepted in one document body.
 *
 * Larger than the image ceiling, and deliberately: this one mirrors
 * `MEDIA_LIMITS.document` in `whatsappMedia.ts`, which is twelve megabytes. A
 * service that refused at eight would let the Edge Function download a
 * ten-megabyte report, spend the bandwidth, and then fail at the proxy with a
 * 413 that says nothing about which of the two ceilings was hit.
 *
 * nginx's `client_max_body_size` is set to this rather than to the image
 * ceiling, because it is one route in front of both endpoints and has to admit
 * the larger. The endpoints themselves still enforce their own.
 */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

/**
 * What an Office file has to look like before it is unpacked.
 *
 * `PK\x03\x04` is a ZIP local file header, which is what `.docx` and `.pptx`
 * are. The declared MIME is checked too, but it is checked *second*: a MIME
 * type is a claim made by the sender's phone, and the bytes are not.
 *
 * A `.doc` or `.rtf` arriving here is not a ZIP and is refused by this check
 * rather than by an unpacker discovering it several steps later.
 */
export function checkDocumentUpload(bytes) {
  if (!bytes || bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_DOCUMENT_BYTES) return { ok: false, reason: "too_large" };
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return { ok: false, reason: "not_an_office_file" };
  }
  return { ok: true };
}
