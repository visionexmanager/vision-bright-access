// What a file actually is, how big it really unpacks to, and what it is carrying
// that nobody meant to send.
//
// ── The three questions this answers ────────────────────────────────────────
//
//   is it what it claims?   `whatsappMedia.ts` checks the MIME type Meta reports.
//                           Meta takes that from the sending client, so it is a
//                           claim, not a fact. `sniffMime` reads the first bytes
//                           and says what the file is, which is the only version
//                           of that answer worth acting on.
//
//   how big is it really?   A size ceiling bounds the *download*. It does not
//                           bound the decode: a 100-megapixel PNG compresses to
//                           a few megabytes of near-uniform colour and expands
//                           to hundreds of megabytes of pixels. The ceiling
//                           passes and the worker dies. Dimensions are in the
//                           header, ahead of the pixels, so they can be read
//                           before anything is committed to.
//
//   what else is in it?     A photograph from a phone carries EXIF, and EXIF
//                           carries GPS. Visionex sends photographs to a vision
//                           provider. Until now it sent the coordinates with
//                           them — for an audience that includes blind users
//                           photographing their own post, their own medication,
//                           their own front door.
//
//                           `stripImageMetadata` removes it before the image
//                           leaves this server. Nothing about the picture
//                           changes; only the part of it that was never the
//                           picture.
//
// Pure: no `Deno`, no fetch, no database, no image library. Everything here is
// byte inspection over a `Uint8Array`, which is what lets it run inside an Edge
// Function — where a native image library cannot go — and be tested under Node.

// ── What a file claims versus what it is ─────────────────────────────────────

/** The formats this channel accepts, by their actual leading bytes. */
export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "application/pdf"
  | "audio/ogg"
  | "audio/mpeg"
  | "audio/wav"
  | "video/mp4"
  | "application/zip"        // also every OOXML: docx, xlsx, pptx
  | "unknown";

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0): boolean => {
  if (bytes.length < at + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[at + i] !== signature[i]) return false;
  }
  return true;
};

const ascii = (bytes: Uint8Array, at: number, length: number): string => {
  if (bytes.length < at + length) return "";
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[at + i]);
  return out;
};

/**
 * What the bytes say this file is.
 *
 * Deliberately a short list: this channel accepts a short list. Anything not
 * recognised is `unknown`, which is not the same as "dangerous" — a plain text
 * file has no signature at all — so the caller decides what to do about it
 * rather than this function guessing.
 */
export function sniffMime(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (startsWith(bytes, [0x49, 0x44, 0x33]) || startsWith(bytes, [0xff, 0xfb])) return "audio/mpeg";
  // ISO base media: a `ftyp` box at offset 4. Covers mp4, m4a and 3gp.
  if (ascii(bytes, 4, 4) === "ftyp") return "video/mp4";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return "unknown";
}

/**
 * Whether the bytes are consistent with the type the sender claimed.
 *
 * ── Why a mismatch is not automatically a refusal ───────────────────────────
 *
 * Real senders produce honest mismatches all the time. A voice note may arrive
 * declared `audio/ogg` and be an MP4 container; every Office document is a ZIP;
 * a text file has no signature. Refusing all of that would break the channel
 * for people who did nothing wrong.
 *
 * So this reports agreement rather than verdicts. What it exists to catch is
 * the case where the bytes say one *known* thing and the claim says a different
 * *known* thing — a PDF declared as a JPEG — which is not something a phone
 * does by accident.
 */
export function mimeAgrees(declared: string, sniffed: SniffedType): boolean {
  if (sniffed === "unknown") return true;
  const claim = (declared ?? "").toLowerCase().split(";")[0].trim();
  if (!claim) return true;

  // Every OOXML document is a ZIP, and so is an unknown archive.
  if (sniffed === "application/zip") {
    return claim.includes("openxmlformats") || claim.includes("zip") || claim.includes("officedocument");
  }
  // The ISO base media container carries audio as well as video.
  if (sniffed === "video/mp4") {
    return claim.startsWith("video/") || claim.startsWith("audio/");
  }
  // Opus and OGG are the same container as far as the header is concerned, and
  // WhatsApp labels its voice notes either way.
  if (sniffed === "audio/ogg") return claim.startsWith("audio/");
  if (sniffed === "audio/mpeg" || sniffed === "audio/wav") return claim.startsWith("audio/");

  return claim === sniffed;
}

// ── How big it really is ─────────────────────────────────────────────────────

/**
 * Pixels this channel will decode.
 *
 * Chosen as a real ceiling rather than a round number: 50 megapixels is far
 * beyond any phone camera a customer is using — a 48 MP sensor produces 12 MP
 * by default — and far below what it takes to exhaust an Edge Function. A photo
 * of a prescription is under 5 MP.
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

/** Largest edge accepted, so a 1×200,000,000 strip is refused on shape alone. */
export const MAX_IMAGE_EDGE = 20_000;

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Width and height, read from the header without decoding the image.
 *
 * This is the whole point: the dimensions of every format below are declared in
 * the first few dozen bytes, ahead of the pixel data. Reading them costs
 * nothing and is what makes a decompression bomb refusable *before* it is
 * expanded rather than after it has taken the process down.
 *
 * Null when the format is not one this can measure, which the caller must treat
 * as "unknown", never as "safe".
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    // IHDR is always the first chunk: 8-byte signature, 4-byte length, "IHDR".
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (ascii(bytes, 0, 3) === "GIF") {
    if (bytes.length < 10) return null;
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return jpegDimensions(bytes, view);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return webpDimensions(bytes, view);

  return null;
}

/** Walk the JPEG segment chain to the frame header that carries the size. */
function jpegDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  let at = 2;
  // Bounded: a malformed file must not spin here, and no real JPEG has
  // thousands of segments before its frame header.
  for (let guard = 0; guard < 2_048 && at + 9 < bytes.length; guard++) {
    if (bytes[at] !== 0xff) { at += 1; continue; }
    const marker = bytes[at + 1];
    // Start-of-frame, every variant except the four that are not frames.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { at += 2; continue; }
    const length = view.getUint16(at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** WebP comes in three flavours and each states its size differently. */
function webpDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  const format = ascii(bytes, 12, 4);
  if (format === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (format === "VP8L" && bytes.length >= 25) {
    const bits = view.getUint32(21, true);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (format === "VP8 " && bytes.length >= 30) {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  return null;
}

export type BombReason = "too_many_pixels" | "edge_too_long";

/**
 * Whether the image may be decoded, and what was measured.
 *
 * A flat shape with an optional reason rather than a discriminated union: this
 * project compiles with `strictNullChecks: false`, which stops TypeScript
 * narrowing a union on a boolean literal, so the tidier form does not actually
 * typecheck here. A shape that survives the real compiler settings beats one
 * that reads better in isolation.
 */
export interface BombVerdict {
  ok: boolean;
  dimensions: ImageDimensions | null;
  /** Present only when `ok` is false. */
  reason?: BombReason;
}

/**
 * Whether this image is safe to hand to anything that will decode it.
 *
 * An unmeasurable image passes. That is deliberate and it is the honest
 * position: this function's job is to refuse what it can *prove* is oversized,
 * and the download ceiling in `whatsappMedia.ts` is what bounds everything
 * else. Refusing every image whose header this cannot parse would reject real
 * photographs to guard against a hypothetical one.
 */
export function checkDecompressionBomb(bytes: Uint8Array): BombVerdict {
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) return { ok: true, dimensions: null };

  const { width, height } = dimensions;
  if (width <= 0 || height <= 0) return { ok: true, dimensions };
  if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
    return { ok: false, dimensions, reason: "edge_too_long" };
  }
  if (width * height > MAX_IMAGE_PIXELS) return { ok: false, dimensions, reason: "too_many_pixels" };
  return { ok: true, dimensions };
}

// ── What else it is carrying ─────────────────────────────────────────────────

export interface StripResult {
  bytes: Uint8Array;
  /** How many bytes of metadata were removed. Safe to log: it is a count. */
  removed: number;
  /** Whether anything was found at all. */
  stripped: boolean;
}

/**
 * Remove the metadata from an image, keeping the image.
 *
 * ── What is removed, and why each ───────────────────────────────────────────
 *
 *   JPEG   every APP segment (0xFFE0-0xFFEF) and the comment segment. APP1 is
 *          EXIF, which holds GPS coordinates, the camera's serial number and
 *          the capture timestamp. APP13 is Photoshop IRB, which holds IPTC.
 *          APP2 can hold an ICC profile — colour management, which a vision
 *          model does not need and which is not worth a special case.
 *
 *   PNG    `eXIf`, `tEXt`, `iTXt`, `zTXt` and `tIME`. PNG carries EXIF too,
 *          and the text chunks are where phone software writes location.
 *
 * Everything structural is untouched, so the result is the same picture: the
 * scan data, the quantisation tables and the Huffman tables in a JPEG; IHDR,
 * PLTE, IDAT and IEND in a PNG.
 *
 * WebP and GIF are returned unchanged and reported as not stripped. WebP
 * metadata lives in RIFF chunks that require rewriting the container length,
 * and doing that wrong corrupts the image — a worse outcome than the metadata,
 * and the caller can decide to refuse instead. GIF has no EXIF.
 */
export function stripImageMetadata(bytes: Uint8Array, mimeType: string): StripResult {
  const type = sniffMime(bytes);
  const claimed = (mimeType ?? "").toLowerCase();

  if (type === "image/jpeg" || claimed.includes("jpeg") || claimed.includes("jpg")) {
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return stripJpeg(bytes);
  }
  if (type === "image/png") return stripPng(bytes);
  return { bytes, removed: 0, stripped: false };
}

function stripJpeg(bytes: Uint8Array): StripResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keep: Array<[number, number]> = [];
  let at = 2;
  let removed = 0;

  keep.push([0, 2]); // SOI

  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];

    // Start of scan: the compressed data runs to the end, and there are no
    // more parseable segments after it.
    if (marker === 0xda) { keep.push([at, bytes.length]); at = bytes.length; break; }
    if (marker === 0xd9) { keep.push([at, at + 2]); at += 2; break; }

    const length = view.getUint16(at + 2);
    if (length < 2 || at + 2 + length > bytes.length) break;

    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (isMetadata) removed += 2 + length;
    else keep.push([at, at + 2 + length]);

    at += 2 + length;
  }

  if (removed === 0) return { bytes, removed: 0, stripped: false };
  if (at < bytes.length) keep.push([at, bytes.length]);

  return { bytes: concat(bytes, keep), removed, stripped: true };
}

/** PNG chunks that carry text, time or EXIF rather than picture. */
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function stripPng(bytes: Uint8Array): StripResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keep: Array<[number, number]> = [[0, 8]]; // signature
  let at = 8;
  let removed = 0;

  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    // length + 4 length bytes + 4 type bytes + 4 CRC bytes.
    const total = length + 12;
    if (total < 12 || at + total > bytes.length) break;

    const type = ascii(bytes, at + 4, 4);
    if (PNG_METADATA_CHUNKS.has(type)) removed += total;
    else keep.push([at, at + total]);

    at += total;
    if (type === "IEND") break;
  }

  if (removed === 0) return { bytes, removed: 0, stripped: false };
  if (at < bytes.length) keep.push([at, bytes.length]);

  return { bytes: concat(bytes, keep), removed, stripped: true };
}

/** Join the ranges worth keeping into one buffer. */
function concat(source: Uint8Array, ranges: Array<[number, number]>): Uint8Array {
  let size = 0;
  for (const [from, to] of ranges) size += to - from;

  const out = new Uint8Array(size);
  let at = 0;
  for (const [from, to] of ranges) {
    out.set(source.subarray(from, to), at);
    at += to - from;
  }
  return out;
}

// ── One call, for the webhook ────────────────────────────────────────────────

export type IntakeReason = "mime_mismatch" | BombReason;

/** The same flat shape, and for the same compiler reason as `BombVerdict`. */
export interface IntakeVerdict {
  ok: boolean;
  /** The bytes to forward. The stripped copy when `ok`; the original otherwise. */
  bytes: Uint8Array;
  sniffed: SniffedType;
  dimensions: ImageDimensions | null;
  stripped: boolean;
  /** Bytes of metadata removed. A count, safe to log. */
  removed: number;
  /** Present only when `ok` is false. */
  reason?: IntakeReason;
}

/**
 * Everything this module does, in the order it has to happen.
 *
 * Sniff before measuring, because the measurement depends on the real format.
 * Measure before stripping, because stripping walks the file and there is no
 * reason to walk a bomb. Strip last, so what the caller forwards is what
 * survived every check.
 *
 * One function because the webhook should not be able to do two of the three
 * and forget the other — which is exactly how the metadata went out for as long
 * as it did.
 */
export function inspectImage(bytes: Uint8Array, declaredMime: string): IntakeVerdict {
  const sniffed = sniffMime(bytes);
  const refused = (reason: IntakeReason, dimensions: ImageDimensions | null): IntakeVerdict =>
    ({ ok: false, bytes, sniffed, dimensions, stripped: false, removed: 0, reason });

  if (!mimeAgrees(declaredMime, sniffed)) return refused("mime_mismatch", null);

  const bomb = checkDecompressionBomb(bytes);
  if (!bomb.ok) return refused(bomb.reason ?? "too_many_pixels", bomb.dimensions);

  const { bytes: clean, removed, stripped } = stripImageMetadata(bytes, declaredMime);
  return { ok: true, bytes: clean, sniffed, dimensions: bomb.dimensions, stripped, removed };
}
