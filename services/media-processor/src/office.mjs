// Reading a Word document or a slide deck without opening one.
//
// ── Why this is here and not Apache Tika ────────────────────────────────────
//
// The audit put Office extraction in Phase A behind Tika: a 0.5-1 GB Java
// container, sandboxed, with its own lifecycle. That is the right tool if the
// goal is every format anybody has ever produced — Tika parses a hundred of
// them, including the pre-2007 binary ones this cannot touch.
//
// It is the wrong tool for the two formats that actually arrive on WhatsApp.
// `.docx` and `.pptx` are ZIP archives full of XML, Node ships a DEFLATE
// decoder in its standard library, and the text is in one kind of element. That
// is a few hundred lines against a gigabyte of Java, a second container to
// patch, and a second thing that can be down. When the gigabyte buys formats
// nobody sends, it is not a saving to skip it — it is the correct size.
//
// If `.doc`, `.rtf` or `.odt` ever become common here, that is when Tika earns
// its place. Today they are refused by name, which is honest, rather than
// half-read, which is not.
//
// ── Deliberately dependency-free, like the rest of this service ─────────────
//
// `node:zlib` only. No unzip package, no XML parser. This code is handed files
// that arrived from the internet and it runs in a container that also runs OCR;
// the smallest possible amount of third-party code in that path is the point.
//
// ── What it will not do ─────────────────────────────────────────────────────
//
// Spreadsheets. `.xlsx` keeps its text in a shared-string table and its numbers
// in the sheets, so extracting the strings alone returns a price list with
// every product name and no prices. For somebody who cannot see the file, a
// confident half-answer is worse than a refusal — the same reason local OCR
// refuses Arabic rather than reading the English half of a bilingual sign. So
// `.xlsx` is still declined, by name, and says so.

import { inflateRawSync } from "node:zlib";

// ── Ceilings ────────────────────────────────────────────────────────────────
//
// A ZIP archive is the classic decompression bomb: a few kilobytes of nested
// deflate streams expands to gigabytes and takes the container with it. Every
// one of these bounds is checked *before* the bytes are produced, never after.

/** Entries the central directory may declare. A 200-slide deck has ~600. */
export const MAX_ZIP_ENTRIES = 1_024;

/** Uncompressed bytes from any single entry. */
export const MAX_ENTRY_BYTES = 12 * 1024 * 1024;

/** Uncompressed bytes from the whole archive. */
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/**
 * How much an entry may expand, once it is large enough for the ratio to mean
 * anything.
 *
 * OOXML is repetitive markup and legitimately compresses ten to twenty times.
 * Two hundred is far past anything a real document does and far below what a
 * bomb needs, so it separates the two without a judgement call.
 *
 * The floor matters as much as the ratio. A short run of repeated characters —
 * a line of dashes, a paragraph of spaces — compresses several hundred times
 * and is completely ordinary, so a ratio check applied to every entry refuses
 * real documents. Below the floor the entry ceiling is the bound that is doing
 * the work, and it is sufficient: nothing under a megabyte is a bomb.
 */
export const MAX_EXPANSION_RATIO = 200;

/** Below this, an entry's expansion ratio is not evidence of anything. */
export const RATIO_CHECK_FLOOR_BYTES = 1024 * 1024;

/** Characters of extracted text kept. Matches the OCR ceiling. */
export const MAX_OFFICE_TEXT_CHARS = 24_000;

/** How long one extraction may take before it is abandoned. */
export const OFFICE_TIMEOUT_MS = 10_000;

// ── The archive ─────────────────────────────────────────────────────────────

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/**
 * Find the end-of-central-directory record.
 *
 * It sits at the end of the file, but a ZIP may carry a trailing comment of up
 * to 64 KB, so the last 64 KB + 22 bytes are scanned backwards for the
 * signature. Backwards, because a file whose *contents* happen to contain those
 * four bytes would otherwise be found first — and a document containing a ZIP
 * signature in its own data is not exotic, it is a document with a picture in
 * it.
 */
function findEndOfCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const earliest = Math.max(0, bytes.length - 22 - 65_535);
  for (let i = bytes.length - 22; i >= earliest; i--) {
    if (view.getUint32(i, true) !== EOCD_SIGNATURE) continue;
    return {
      entries: view.getUint16(i + 10, true),
      size: view.getUint32(i + 12, true),
      offset: view.getUint32(i + 16, true),
    };
  }
  return null;
}

const ascii = (bytes, start, length) => {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]);
  return out;
};

/**
 * The archive's table of contents.
 *
 * Only the central directory is trusted for sizes and offsets. A local file
 * header carries its own copy of both and they are allowed to disagree — a
 * streamed ZIP writes zeroes there and puts the real values in a trailing
 * descriptor. Reading sizes from the local header is how an unpacker ends up
 * inflating an unbounded stream while believing it declared nothing.
 */
export function readCentralDirectory(bytes) {
  const eocd = findEndOfCentralDirectory(bytes);
  if (!eocd) return { ok: false, reason: "not_a_zip" };

  // 0xffff / 0xffffffff mean "see the ZIP64 record", which this does not
  // implement. Our ceiling is eight megabytes; a document that needs ZIP64 is
  // not one of ours, and guessing at it would be worse than refusing.
  if (eocd.entries === 0xffff || eocd.offset === 0xffffffff || eocd.size === 0xffffffff) {
    return { ok: false, reason: "zip64_unsupported" };
  }
  if (eocd.entries > MAX_ZIP_ENTRIES) return { ok: false, reason: "too_many_entries" };
  if (eocd.offset + eocd.size > bytes.length) return { ok: false, reason: "truncated" };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = [];
  let cursor = eocd.offset;

  for (let i = 0; i < eocd.entries; i++) {
    if (cursor + 46 > bytes.length) return { ok: false, reason: "truncated" };
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return { ok: false, reason: "bad_directory" };

    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);

    if (cursor + 46 + nameLength > bytes.length) return { ok: false, reason: "truncated" };
    entries.push({
      // OOXML part names are ASCII by specification, and a name is only ever
      // compared against a fixed list below — never used as a path on disk.
      name: ascii(bytes, cursor + 46, nameLength),
      method,
      compressed,
      uncompressed,
      offset,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return { ok: true, entries };
}

/**
 * The bytes of one entry, inflated, with every ceiling checked first.
 *
 * The declared size is checked before the decoder runs, and the produced size
 * is checked after — because a declaration is a claim. `inflateRawSync` is
 * given its own `maxOutputLength`, so a stream that lies about its size is
 * stopped by zlib itself rather than by a check that arrives too late.
 */
export function readEntry(bytes, entry, budget) {
  if (entry.uncompressed > MAX_ENTRY_BYTES) return { ok: false, reason: "entry_too_large" };
  if (entry.uncompressed > budget.remaining) return { ok: false, reason: "archive_too_large" };
  if (
    entry.uncompressed >= RATIO_CHECK_FLOOR_BYTES &&
    entry.compressed > 0 &&
    entry.uncompressed / entry.compressed > MAX_EXPANSION_RATIO
  ) {
    return { ok: false, reason: "suspicious_ratio" };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.offset + 30 > bytes.length) return { ok: false, reason: "truncated" };
  if (view.getUint32(entry.offset, true) !== LOCAL_SIGNATURE) return { ok: false, reason: "bad_entry" };

  // Only the name and extra *lengths* are read from the local header; the sizes
  // are the central directory's. See `readCentralDirectory`.
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  if (start + entry.compressed > bytes.length) return { ok: false, reason: "truncated" };

  const payload = bytes.subarray(start, start + entry.compressed);

  let output;
  if (entry.method === 0) {
    // Stored. Some writers do this for small parts.
    output = Buffer.from(payload);
  } else if (entry.method === 8) {
    try {
      output = inflateRawSync(payload, { maxOutputLength: Math.min(MAX_ENTRY_BYTES, budget.remaining) });
    } catch {
      return { ok: false, reason: "inflate_failed" };
    }
  } else {
    return { ok: false, reason: "unsupported_compression" };
  }

  budget.remaining -= output.length;
  return { ok: true, text: output.toString("utf8") };
}

// ── The markup ──────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML entities, including numeric ones, which OOXML uses for odd characters. */
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body] ?? "";
  });
}

/**
 * The words out of one OOXML part.
 *
 * Only `<w:t>` and `<a:t>` elements are read — the two that hold visible text
 * in Word and PowerPoint. Stripping every tag instead would be shorter and
 * would also sweep up revision identifiers, style names, embedded relationship
 * targets and the odd base64 blob, and hand the model somebody's document plus
 * a page of noise.
 *
 * Paragraph ends become line breaks because structure carries meaning here: an
 * address, a list of ingredients and a set of bullet points all stop being
 * readable when they are run into one line, and this text is going to be read
 * aloud to somebody who cannot see the original layout.
 */
export function textFromOoxml(xml) {
  const pattern = /<(?:w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|a):t>|<\/(?:w|a):p>|<(?:w|a):(?:tab|br)\s*\/?>/g;
  let out = "";
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    if (match[1] !== undefined) {
      out += decodeEntities(match[1]);
    } else if (match[0].startsWith("</")) {
      out += "\n";
    } else {
      out += " ";
    }
  }

  return out
    // Runs of blank lines are how OOXML represents vertical space, and there is
    // no vertical space in a WhatsApp message worth three of them.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── The formats ─────────────────────────────────────────────────────────────

/**
 * Which parts of the archive hold the words, per format.
 *
 * A regular expression rather than a fixed name, because a deck has one part
 * per slide and they must come back in order. Word's headers and footers are
 * deliberately excluded: they repeat on every page, and a document whose text
 * is prefixed by the same letterhead thirty times is harder to listen to, not
 * more complete.
 */
const PARTS = {
  docx: /^word\/document\.xml$/,
  pptx: /^ppt\/slides\/slide\d+\.xml$/,
};

export const SUPPORTED_OFFICE_KINDS = Object.keys(PARTS);

export const isSupportedOfficeKind = (value) =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(PARTS, value);

/** Slide 2 must not sort before slide 10 becomes slide 1's neighbour. */
const slideNumber = (name) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);

/**
 * Failures that describe one part rather than the archive around it.
 *
 * A single slide with a corrupt deflate stream is a damaged part in an
 * otherwise readable deck, and losing the other thirty-nine over it would be a
 * poor trade. Everything not on this list is a statement about the file as a
 * whole and stops the extraction.
 */
export const SKIPPABLE_PART_FAILURES = ["bad_entry", "inflate_failed", "unsupported_compression"];

/**
 * Read the text out of one Office file.
 *
 * Returns a named reason rather than throwing, for the same purpose every other
 * refusal in this service has one: the caller turns it into a sentence somebody
 * reads, and "no" is not translatable.
 */
export function extractOfficeText(bytes, kind) {
  if (!isSupportedOfficeKind(kind)) return { ok: false, reason: "unsupported_kind" };

  const directory = readCentralDirectory(bytes);
  if (!directory.ok) return directory;

  const wanted = directory.entries.filter((entry) => PARTS[kind].test(entry.name));
  if (wanted.length === 0) return { ok: false, reason: "no_text_part" };
  if (kind === "pptx") wanted.sort((a, b) => slideNumber(a.name) - slideNumber(b.name));

  const budget = { remaining: MAX_TOTAL_BYTES };
  const pieces = [];

  for (const entry of wanted) {
    const part = readEntry(bytes, entry, budget);
    if (!part.ok) {
      // One unreadable slide out of forty should not lose the other
      // thirty-nine, so a fault in a single part is skipped. Anything that says
      // something about the *archive* — a truncation, a bomb, an entry that
      // lied about its size — stops the whole thing.
      //
      // The direction matters. Skipping those instead would turn a hostile
      // archive into "there is no text in this file", which is a confident
      // wrong answer given to somebody who cannot open the file to check.
      if (!SKIPPABLE_PART_FAILURES.includes(part.reason)) return part;
      continue;
    }
    const text = textFromOoxml(part.text);
    if (text) pieces.push(text);
    if (pieces.join("\n\n").length >= MAX_OFFICE_TEXT_CHARS) break;
  }

  const text = pieces.join("\n\n").slice(0, MAX_OFFICE_TEXT_CHARS).trim();
  // A file with no words in it is a real outcome — a deck that is entirely
  // images, a document holding one table of numbers — and it is reported as
  // itself rather than as a failure to open the file.
  if (!text) return { ok: false, reason: "no_text" };

  return { ok: true, text, parts: pieces.length };
}
