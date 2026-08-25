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
