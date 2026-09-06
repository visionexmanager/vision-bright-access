// ─── ZIP, TAR and GZIP, with nothing installed ───────────────────────────────
//
// The archive module was a stub: it waited three hundred milliseconds and said
// the conversion "requires server processing. Available in Phase 12." Phase 12
// was never built, and the page is linked from the navbar, the footer and the
// service catalog.
//
// None of this needs a server or a library. `DecompressionStream("deflate-raw")`
// is the codec inside a ZIP, `CompressionStream("gzip")` is the whole of GZIP,
// and TAR is 512-byte headers with octal numbers in them. What was missing was
// the container code, which is what this file is — against a dependency that
// would have to be installed, patched and audited for the same three formats.
//
// ── What is deliberately refused ────────────────────────────────────────────
//
// 7z and RAR: neither has a decoder in any browser, and neither is something
// this can write. They stay recognised *inputs* so the page can say why, and
// they are never offered as a target. A format nobody can produce is a menu
// entry that can only ever fail — the same rule that took AVI and WMA off the
// video and audio lists.
//
// ZIP64, encrypted entries and compression methods other than store and deflate
// are refused by name rather than mis-read.

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

/** One file inside an archive. Directories are not carried: paths are. */
export interface ArchiveEntry {
  /** A relative POSIX path. Never absolute, never containing a `..` segment. */
  name: string;
  data: Uint8Array;
  /** Preserved across a conversion when the source recorded one. */
  mtime?: Date;
}

/**
 * Ceilings.
 *
 * An archive declares how much it will become before it becomes it, so both are
 * checked while reading rather than after: a 40 KB ZIP can describe 40 GB, and
 * the page's own size limit is on the file it was handed, not on what is inside.
 */
export const MAX_ENTRIES = 2_000;
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveError";
  }
}

// ── Bytes ────────────────────────────────────────────────────────────────────

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) + b[at + 3] * 0x1000000;

function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Run bytes through one of the platform's codecs.
 *
 * `new Blob([bytes]).stream()` would be shorter and does not exist in jsdom, so
 * the bytes are written into the transform's own writable end instead.
 *
 * The parameter is `GenericTransformStream` — the interface both compression
 * streams extend — and not `TransformStream<Uint8Array, Uint8Array>`, because
 * the two lockfiles in this repository resolve different DOM typings: under the
 * newer ones a `CompressionStream` writes `BufferSource`, not `Uint8Array`, and
 * only the pnpm CI job sees it. The shared base is the same in both.
 */
async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // Deliberately not awaited: a 16 MB chunk can sit past the stream's
  // high-water mark, and nothing drains it until the loop below reads. The
  // rejection is swallowed here because the read side reports the real failure.
  const written = writer.write(bytes).then(
    () => writer.close(),
    () => {},
  );
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      total += chunk.length;
      if (total > MAX_TOTAL_BYTES) {
        await reader.cancel();
        throw new ArchiveError("This archive expands to more than this page can hold.");
      }
      chunks.push(chunk);
    }
  } finally {
    await written;
  }
  return concat(chunks);
}

const inflateRaw = (bytes: Uint8Array) => pipe(bytes, new DecompressionStream("deflate-raw"));
const deflateRaw = (bytes: Uint8Array) => pipe(bytes, new CompressionStream("deflate-raw"));
export const gzip = (bytes: Uint8Array) => pipe(bytes, new CompressionStream("gzip"));
export const gunzip = (bytes: Uint8Array) => pipe(bytes, new DecompressionStream("gzip"));

// ── CRC-32, which a ZIP is not valid without ─────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Paths ────────────────────────────────────────────────────────────────────

/**
 * The check that makes repackaging safe.
 *
 * An archive entry named `../../.ssh/authorized_keys` is a real attack on
 * whoever extracts it, and a converter that copied such a name from a ZIP into
 * a TAR would be laundering it into a format whose classic extractors do not
 * check. It is refused here, on the way in, in both directions.
 */
export function safeEntryName(rawName: string): string {
  const name = rawName.replace(/\\/g, "/").replace(/^\.\//, "");
  if (name.length === 0) throw new ArchiveError("This archive has an entry with no name.");
  if (name.startsWith("/") || /^[a-zA-Z]:\//.test(name)) {
    throw new ArchiveError(
      `This archive contains an absolute path (${rawName}), which is not safe to repackage.`,
    );
  }
  if (name.split("/").some((part) => part === "..")) {
    throw new ArchiveError(`This archive contains a path that escapes its own folder (${rawName}).`);
  }
  return name;
}

function guard(entries: ArchiveEntry[], addedBytes: number, total: { bytes: number }) {
  if (entries.length > MAX_ENTRIES) {
    throw new ArchiveError(
      `This archive holds more than ${MAX_ENTRIES.toLocaleString()} files, which is more than this page converts.`,
    );
  }
  total.bytes += addedBytes;
  if (total.bytes > MAX_TOTAL_BYTES) {
    throw new ArchiveError("This archive expands to more than this page can hold.");
  }
}

// ── ZIP ──────────────────────────────────────────────────────────────────────

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

/** DOS date and time, which is what a ZIP stores instead of a timestamp. */
function fromDosTime(time: number, date: number): Date | undefined {
  const year = ((date >> 9) & 0x7f) + 1980;
  const month = (date >> 5) & 0x0f;
  const day = date & 0x1f;
  if (month < 1 || month > 12 || day < 1) return undefined;
  return new Date(year, month - 1, day, (time >> 11) & 0x1f, (time >> 5) & 0x3f, (time & 0x1f) * 2);
}

function toDosTime(when: Date): { time: number; date: number } {
  const year = Math.max(1980, when.getFullYear());
  return {
    time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
  };
}

export async function readZip(bytes: Uint8Array): Promise<ArchiveEntry[]> {
  // The end-of-central-directory record is last, but a trailing comment may sit
  // after it, so it is found by scanning backwards rather than assumed.
  let eocd = -1;
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let at = bytes.length - 22; at >= earliest; at--) {
    if (u32(bytes, at) === ZIP_EOCD) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError("This file isn't a ZIP archive, or it is damaged.");

  const count = u16(bytes, eocd + 10);
  const directoryAt = u32(bytes, eocd + 16);
  if (count === 0xffff || directoryAt === 0xffffffff) {
    throw new ArchiveError("This is a ZIP64 archive, which this page doesn't read.");
  }

  const entries: ArchiveEntry[] = [];
  const total = { bytes: 0 };
  let at = directoryAt;

  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || u32(bytes, at) !== ZIP_CENTRAL) {
      throw new ArchiveError("This ZIP's directory is damaged.");
    }
    const flags = u16(bytes, at + 8);
    if (flags & 0x1) throw new ArchiveError("This ZIP is password-protected.");
    const method = u16(bytes, at + 10);
    const time = u16(bytes, at + 12);
    const date = u16(bytes, at + 14);
    const expectedCrc = u32(bytes, at + 16);
    const compressedSize = u32(bytes, at + 20);
    const uncompressedSize = u32(bytes, at + 24);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const localAt = u32(bytes, at + 42);
    const rawName = dec.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;

    // A directory is a name ending in a slash with no bytes behind it. The
    // paths of the files carry the same information.
    if (rawName.endsWith("/")) continue;
    const name = safeEntryName(rawName);

    if (u32(bytes, localAt) !== ZIP_LOCAL) {
      throw new ArchiveError(`This ZIP's entry for ${name} is damaged.`);
    }
    // The local header repeats the name and extra fields at its own lengths,
    // which are not always the central directory's — using the directory's
    // lengths here is the classic way to land in the middle of the data.
    const dataAt = localAt + 30 + u16(bytes, localAt + 26) + u16(bytes, localAt + 28);
    const stored = bytes.subarray(dataAt, dataAt + compressedSize);

    let data: Uint8Array;
    if (method === 0) data = stored.slice();
    else if (method === 8) data = await inflateRaw(stored);
    else throw new ArchiveError(`${name} uses a compression this page doesn't read (method ${method}).`);

    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) {
      throw new ArchiveError(`${name} is damaged — the archive's own checksum doesn't match.`);
    }

    entries.push({ name, data, mtime: fromDosTime(time, date) });
    guard(entries, data.length, total);
  }

  if (entries.length === 0) throw new ArchiveError("This ZIP holds no files.");
  return entries;
}

export async function writeZip(entries: ArchiveEntry[]): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = enc.encode(safeEntryName(entry.name));
    const raw = entry.data;
    const deflated = await deflateRaw(raw);
    // Compression that makes a file bigger is not compression. Already-
    // compressed and very small files are stored instead, which is what every
    // real writer does.
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const { time, date } = toDosTime(entry.mtime ?? new Date());
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, ZIP_LOCAL, true);
    lv.setUint16(4, 20, true); // version needed: 2.0, which is deflate
    lv.setUint16(6, 0x0800, true); // the names are UTF-8, and this says so
    lv.setUint16(8, useDeflate ? 8 : 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, payload);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, ZIP_CENTRAL, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, useDeflate ? 8 : 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, payload.length, true);
    dv.setUint32(24, raw.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);

    offset += local.length + payload.length;
  }

  const directory = concat(central);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, ZIP_EOCD, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directory.length, true);
  ev.setUint32(16, offset, true);
  return concat([...locals, directory, end]);
}

// ── TAR ──────────────────────────────────────────────────────────────────────

const BLOCK = 512;

const octal = (bytes: Uint8Array, at: number, length: number): number => {
  const text = dec.decode(bytes.subarray(at, at + length)).replace(/\0.*$/, "").trim();
  return text.length === 0 ? 0 : parseInt(text, 8) || 0;
};

/** The header checksum, computed with its own field read as eight spaces. */
function tarChecksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i];
  return sum;
}

export function readTar(bytes: Uint8Array): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const total = { bytes: 0 };
  let at = 0;
  let longName: string | null = null;

  while (at + BLOCK <= bytes.length) {
    const header = bytes.subarray(at, at + BLOCK);
    if (header.every((byte) => byte === 0)) break; // the zero blocks that end a TAR

    if (octal(header, 148, 8) !== tarChecksum(header)) {
      throw new ArchiveError("This TAR is damaged — a header's checksum doesn't match.");
    }

    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 0x30);
    const data = bytes.subarray(at + BLOCK, at + BLOCK + size);
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;

    // GNU writes a name longer than 100 bytes as an entry of its own, placed
    // immediately before the file it belongs to.
    if (type === "L") {
      longName = dec.decode(data).replace(/\0+$/, "");
      continue;
    }
    // A pax header describes the next entry in a way this does not need, and a
    // directory's path is already carried by the files inside it.
    if (type === "x" || type === "g" || type === "5") {
      longName = null;
      continue;
    }
    if (type !== "0" && type !== "\0" && type !== "7") {
      longName = null;
      continue;
    }

    const stored = dec.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const prefix = dec.decode(header.subarray(345, 500)).replace(/\0.*$/, "");
    const rawName = longName ?? (prefix ? `${prefix}/${stored}` : stored);
    longName = null;
    if (rawName.length === 0) continue;

    const mtimeSeconds = octal(header, 136, 12);
    entries.push({
      name: safeEntryName(rawName),
      data: data.slice(),
      mtime: mtimeSeconds > 0 ? new Date(mtimeSeconds * 1000) : undefined,
    });
    guard(entries, size, total);
  }

  if (entries.length === 0) throw new ArchiveError("This file isn't a TAR archive, or it holds no files.");
  return entries;
}

function writeOctal(into: Uint8Array, at: number, length: number, value: number) {
  const text = value.toString(8).padStart(length - 1, "0").slice(-(length - 1));
  into.set(enc.encode(text), at);
  into[at + length - 1] = 0;
}

export function writeTar(entries: ArchiveEntry[]): Uint8Array {
  const blocks: Uint8Array[] = [];

  for (const entry of entries) {
    const name = safeEntryName(entry.name);
    // ustar splits a long path across a 155-byte prefix and a 100-byte name,
    // and the split has to fall on a slash.
    let prefix = "";
    let stored = name;
    if (enc.encode(name).length > 100) {
      const cut = name.lastIndexOf("/");
      prefix = cut > 0 ? name.slice(0, cut) : "";
      stored = cut > 0 ? name.slice(cut + 1) : name;
      if (enc.encode(stored).length > 100 || enc.encode(prefix).length > 155) {
        throw new ArchiveError(`The path ${name} is too long for a TAR archive.`);
      }
    }

    const header = new Uint8Array(BLOCK);
    header.set(enc.encode(stored), 0);
    writeOctal(header, 100, 8, 0o644); // mode
    writeOctal(header, 108, 8, 0); // uid
    writeOctal(header, 116, 8, 0); // gid
    writeOctal(header, 124, 12, entry.data.length);
    writeOctal(header, 136, 12, Math.floor((entry.mtime?.getTime() ?? Date.now()) / 1000));
    header.set(enc.encode("        "), 148); // the checksum field, while computing it
    header[156] = 0x30; // a regular file
    header.set(enc.encode("ustar"), 257);
    header[262] = 0;
    header.set(enc.encode("00"), 263);
    if (prefix) header.set(enc.encode(prefix), 345);
    // The checksum field is its own shape and not the eleven-digit one the
    // other numbers use: six octal digits, a NUL, then a space. Writing it with
    // writeOctal puts a digit where the NUL belongs, and every extractor then
    // reads a number that does not match the header it just checked.
    const sum = tarChecksum(header);
    header.set(enc.encode(sum.toString(8).padStart(6, "0").slice(-6)), 148);
    header[154] = 0;
    header[155] = 0x20;

    const padding = (BLOCK - (entry.data.length % BLOCK)) % BLOCK;
    blocks.push(header, entry.data, new Uint8Array(padding));
  }

  blocks.push(new Uint8Array(BLOCK * 2)); // the two zero blocks that end an archive
  return concat(blocks);
}

/** Whether these bytes begin with something that reads as a TAR header. */
export function looksLikeTar(bytes: Uint8Array): boolean {
  if (bytes.length < BLOCK) return false;
  if (dec.decode(bytes.subarray(257, 262)) === "ustar") return true;
  // A pre-POSIX TAR carries no magic at all, so its checksum is the only tell.
  return octal(bytes, 148, 8) === tarChecksum(bytes.subarray(0, BLOCK));
}
