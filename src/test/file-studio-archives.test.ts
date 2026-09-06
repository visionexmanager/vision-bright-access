// ─── The archive module, which used to be three hundred milliseconds and an
//     apology ─────────────────────────────────────────────────────────────────
//
// The point of these tests is that the reader is proved against bytes this code
// did not write. A reader and a writer that only agree with each other can be
// wrong together and never notice, so the first ZIP below is assembled by hand,
// field by field, and the CRC-32 is pinned to the standard check value before
// anything else leans on it.

import { beforeAll, describe, expect, it } from "vitest";
import {
  ArchiveError,
  crc32,
  gunzip,
  gzip,
  looksLikeTar,
  readTar,
  readZip,
  safeEntryName,
  writeTar,
  writeZip,
  type ArchiveEntry,
} from "@/services/file-studio/modules/archiveFormats";
import { ArchiveModule, ARCHIVE_WORKING_TARGETS } from "@/services/file-studio/modules/archives";
import { getWorkingOutputFormats } from "@/services/file-studio/engine";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** A ZIP with one stored entry, written here rather than by `writeZip`. */
function handBuiltZip(name: string, contents: string): Uint8Array {
  const nameBytes = enc.encode(name);
  const data = enc.encode(contents);
  const crc = crc32(data);

  const local = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(10, 0x6000, true);          // 12:00:00
  lv.setUint16(12, 0x2c21, true);          // 2002-01-01
  lv.setUint32(14, crc, true);
  lv.setUint32(18, data.length, true);
  lv.setUint32(22, data.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);

  const dir = new Uint8Array(46 + nameBytes.length);
  const dv = new DataView(dir.buffer);
  dv.setUint32(0, 0x02014b50, true);
  dv.setUint16(4, 20, true);
  dv.setUint16(6, 20, true);
  dv.setUint16(12, 0x6000, true);
  dv.setUint16(14, 0x2c21, true);
  dv.setUint32(16, crc, true);
  dv.setUint32(20, data.length, true);
  dv.setUint32(24, data.length, true);
  dv.setUint16(28, nameBytes.length, true);
  dv.setUint32(42, 0, true);
  dir.set(nameBytes, 46);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, dir.length, true);
  ev.setUint32(16, local.length + data.length, true);

  const out = new Uint8Array(local.length + data.length + dir.length + end.length);
  out.set(local, 0);
  out.set(data, local.length);
  out.set(dir, local.length + data.length);
  out.set(end, local.length + data.length + dir.length);
  return out;
}

const fileOf = (name: string, bytes: Uint8Array): File =>
  new File([bytes as unknown as BlobPart], name);

describe("CRC-32", () => {
  it("agrees with the standard check value", () => {
    // Every CRC-32 implementation in the world answers 0xCBF43926 for these
    // nine bytes. A ZIP written with a wrong CRC opens nowhere.
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("reading a ZIP nothing here wrote", () => {
  it("reads a stored entry, its bytes and its timestamp", async () => {
    const entries = await readZip(handBuiltZip("notes/hello.txt", "hello"));
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("notes/hello.txt");
    expect(dec.decode(entries[0].data)).toBe("hello");
    expect(entries[0].mtime?.getFullYear()).toBe(2002);
  });

  it("refuses a damaged entry rather than handing back wrong bytes", async () => {
    const zip = handBuiltZip("a.txt", "hello");
    zip[30 + "a.txt".length] = 0x48;        // the payload's "h" → "H", CRC untouched
    await expect(readZip(zip)).rejects.toThrow(/checksum/i);
  });

  it("refuses a path that would escape the folder it is extracted into", async () => {
    await expect(readZip(handBuiltZip("../../etc/passwd", "x"))).rejects.toThrow(/escapes/i);
    expect(() => safeEntryName("/etc/passwd")).toThrow(ArchiveError);
    expect(() => safeEntryName("C:/Windows/system32")).toThrow(ArchiveError);
    expect(safeEntryName("docs\\a\\b.txt")).toBe("docs/a/b.txt");
  });

  it("says so when the file is not a ZIP at all", async () => {
    await expect(readZip(enc.encode("this is a text file"))).rejects.toThrow(/isn't a ZIP/i);
  });
});

describe("writing", () => {
  const entries: ArchiveEntry[] = [
    { name: "a/one.txt", data: enc.encode("one ".repeat(200)), mtime: new Date(2020, 4, 6, 9, 30, 0) },
    { name: "b/two.bin", data: new Uint8Array([0, 1, 2, 3, 250, 251]), mtime: new Date(2021, 0, 2, 3, 4, 6) },
  ];

  it("writes a ZIP its own reader accepts, compression and all", async () => {
    const zip = await writeZip(entries);
    // "one one one…" compresses; six arbitrary bytes do not, and a writer that
    // deflated them anyway would produce a larger file than it was given.
    const back = await readZip(zip);
    expect(back.map((e) => e.name)).toEqual(["a/one.txt", "b/two.bin"]);
    expect(dec.decode(back[0].data)).toBe("one ".repeat(200));
    expect([...back[1].data]).toEqual([0, 1, 2, 3, 250, 251]);
    expect(zip.length).toBeLessThan(entries[0].data.length);
  });

  it("keeps the timestamps, to the two seconds a ZIP can hold", async () => {
    const [back] = await readZip(await writeZip([entries[0]]));
    expect(back.mtime?.getFullYear()).toBe(2020);
    expect(back.mtime?.getMonth()).toBe(4);
    expect(back.mtime?.getDate()).toBe(6);
    expect(back.mtime?.getHours()).toBe(9);
    expect(back.mtime?.getMinutes()).toBe(30);
  });

  it("writes a TAR with headers a checksum agrees with", () => {
    const back = readTar(writeTar(entries));
    expect(back.map((e) => e.name)).toEqual(["a/one.txt", "b/two.bin"]);
    expect(dec.decode(back[0].data)).toBe("one ".repeat(200));
    expect(back[1].data).toHaveLength(6);
    expect(back[0].mtime?.getFullYear()).toBe(2020);
  });

  it("refuses a TAR whose header has been altered", () => {
    const tar = writeTar(entries);
    tar[5] = tar[5] ^ 0xff;
    expect(() => readTar(tar)).toThrow(/checksum/i);
  });

  it("ends a TAR the way every extractor expects", () => {
    const tar = writeTar([entries[1]]);
    expect(tar.length % 512).toBe(0);
    expect([...tar.subarray(tar.length - 1024)].every((b) => b === 0)).toBe(true);
  });

  it("splits a long path across the ustar prefix instead of truncating it", () => {
    const long = `${"deep/".repeat(24)}file.txt`;     // 128 characters
    expect(long.length).toBeGreaterThan(100);
    const [back] = readTar(writeTar([{ name: long, data: enc.encode("x") }]));
    expect(back.name).toBe(long);
  });
});

describe("GZIP", () => {
  it("wraps a TAR and unwraps to the same one", async () => {
    const tar = writeTar([{ name: "one.txt", data: enc.encode("hello"), mtime: new Date(2020, 0, 1) }]);
    const inner = await gunzip(await gzip(tar));
    expect(looksLikeTar(inner)).toBe(true);
    expect(dec.decode(readTar(inner)[0].data)).toBe("hello");
  });

  it("does not mistake arbitrary bytes for a TAR", () => {
    expect(looksLikeTar(enc.encode("x".repeat(600)))).toBe(false);
  });
});

// ── The module, as the page uses it ──────────────────────────────────────────

describe("the archive module", () => {
  beforeAll(() => {
    // Two things every browser has and jsdom does not: object URLs, which the
    // module makes for the download link, and Blob.arrayBuffer, which is how it
    // reads the file it was handed.
    if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
    if (!Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = function readAsBuffer(this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      };
    }
  });

  it("turns a ZIP into a TAR with the same files inside", async () => {
    const zip = handBuiltZip("notes/hello.txt", "hello");
    const result = await ArchiveModule.convert(fileOf("notes.zip", zip), { targetFormat: "tar" }, () => {});
    expect(result.success).toBe(true);
    expect(result.metadata?.entries).toBe(1);
    const tar = new Uint8Array(await result.resultBlob!.arrayBuffer());
    expect(readTar(tar).map((e) => e.name)).toEqual(["notes/hello.txt"]);
  });

  it("turns a TAR into a gzipped TAR", async () => {
    const tar = writeTar([{ name: "one.txt", data: enc.encode("hello") }]);
    const result = await ArchiveModule.convert(fileOf("one.tar", tar), { targetFormat: "gz" }, () => {});
    expect(result.success).toBe(true);
    const out = new Uint8Array(await result.resultBlob!.arrayBuffer());
    expect(dec.decode(readTar(await gunzip(out))[0].data)).toBe("hello");
  });

  it("reads a .gz that holds a single file rather than a TAR", async () => {
    const gz = await gzip(enc.encode("plain text"));
    const result = await ArchiveModule.convert(fileOf("note.txt.gz", gz), { targetFormat: "zip" }, () => {});
    expect(result.success).toBe(true);
    const entries = await readZip(new Uint8Array(await result.resultBlob!.arrayBuffer()));
    expect(entries[0].name).toBe("note.txt");
    expect(dec.decode(entries[0].data)).toBe("plain text");
  });

  it("explains a 7z instead of failing at it", async () => {
    const result = await ArchiveModule.convert(
      fileOf("backup.7z", enc.encode("7z\xBC\xAF\x27\x1C")),
      { targetFormat: "zip" },
      () => {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no browser has/i);
  });

  it("never offers a pair it does not implement", () => {
    for (const [input, targets] of Object.entries(ARCHIVE_WORKING_TARGETS)) {
      expect(getWorkingOutputFormats("archive", `backup.${input}`)).toEqual([...targets]);
      expect(targets).not.toContain(input);
      for (const target of targets) {
        expect(ArchiveModule.supportedOutputFormats).toContain(target);
      }
    }
    // The two nothing reads. They stay inputs so the page can say why.
    expect(getWorkingOutputFormats("archive", "backup.7z")).toEqual([]);
    expect(getWorkingOutputFormats("archive", "backup.rar")).toEqual([]);
    expect(ArchiveModule.supportedInputFormats).toContain("7z");
    expect(ArchiveModule.supportedOutputFormats).not.toContain("7z");
  });
});
