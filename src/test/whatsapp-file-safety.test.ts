// Phase A1 — what a file is, how big it unpacks to, and what it is carrying.
//
// These build real files byte by byte rather than mocking a parser. A JPEG with
// a genuine APP1/EXIF segment holding genuine GPS tags, a PNG with a real eXIf
// chunk, a PNG header that claims a hundred megapixels. If the production code
// ever stops understanding the format, these fail — which a fixture-free test
// asserting `stripped === true` would not.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { SniffedType } from "../../supabase/functions/_shared/whatsappFileSafety.ts";

const safety = await import("../../supabase/functions/_shared/whatsappFileSafety.ts");

// ── Builders: real files, assembled here ─────────────────────────────────────

const bytes = (...values: number[]) => Uint8Array.from(values);

const join = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

const u16 = (n: number) => bytes((n >> 8) & 0xff, n & 0xff);
const u32 = (n: number) => bytes((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const asciiBytes = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

/** A JPEG segment: marker, length (inclusive of the length field), payload. */
const segment = (marker: number, payload: Uint8Array) =>
  join(bytes(0xff, marker), u16(payload.length + 2), payload);

/**
 * A real EXIF APP1 payload carrying a GPS tag.
 *
 * Little-endian TIFF header, one IFD entry pointing at a GPS sub-IFD, and a
 * GPSLatitude entry. Enough that the bytes below genuinely contain coordinates
 * rather than the word "GPS" in a comment.
 */
const exifPayload = (): Uint8Array => join(
  asciiBytes("Exif"), bytes(0x00, 0x00),
  asciiBytes("II"), bytes(0x2a, 0x00),          // little-endian, magic 42
  bytes(0x08, 0x00, 0x00, 0x00),                 // offset to IFD0
  bytes(0x01, 0x00),                             // one entry
  bytes(0x25, 0x88, 0x04, 0x00),                 // tag 0x8825 GPSInfoIFD, LONG
  bytes(0x01, 0x00, 0x00, 0x00),                 // count 1
  bytes(0x1a, 0x00, 0x00, 0x00),                 // value: offset to GPS IFD
  bytes(0x00, 0x00, 0x00, 0x00),                 // next IFD: none
  bytes(0x01, 0x00),                             // GPS IFD, one entry
  bytes(0x02, 0x00, 0x05, 0x00),                 // tag 0x0002 GPSLatitude
  bytes(0x03, 0x00, 0x00, 0x00),
  bytes(0x2c, 0x00, 0x00, 0x00),
  u32(0x1f000000), u32(0x00000001),              // 31/1 degrees — Amman-ish
);

/** A minimal but structurally real JPEG, optionally carrying metadata. */
const jpeg = (options: { width?: number; height?: number; withExif?: boolean; withComment?: boolean } = {}) => {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const parts: Uint8Array[] = [bytes(0xff, 0xd8)];                       // SOI
  if (options.withExif) parts.push(segment(0xe1, exifPayload()));        // APP1
  if (options.withComment) parts.push(segment(0xfe, asciiBytes("taken at home")));
  parts.push(segment(0xdb, new Uint8Array(65)));                          // DQT
  parts.push(segment(0xc0, join(                                          // SOF0
    bytes(0x08), u16(height), u16(width), bytes(0x01, 0x01, 0x11, 0x00),
  )));
  parts.push(bytes(0xff, 0xda), u16(8), bytes(0x01, 0x01, 0x00, 0x00, 0x3f, 0x00));
  parts.push(bytes(0x12, 0x34, 0x56, 0x78));                              // "scan"
  parts.push(bytes(0xff, 0xd9));                                          // EOI
  return join(...parts);
};

/** A PNG chunk: length, type, data, CRC (unchecked here — nothing verifies it). */
const chunk = (type: string, data: Uint8Array) =>
  join(u32(data.length), asciiBytes(type), data, u32(0));

const png = (options: { width?: number; height?: number; withExif?: boolean; withText?: boolean } = {}) => {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const parts: Uint8Array[] = [
    bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", join(u32(width), u32(height), bytes(8, 2, 0, 0, 0))),
  ];
  if (options.withExif) parts.push(chunk("eXIf", exifPayload()));
  if (options.withText) parts.push(chunk("tEXt", asciiBytes("Comment\0taken at 31.95, 35.93")));
  parts.push(chunk("IDAT", bytes(0x78, 0x9c, 0x63, 0x00, 0x00)));
  parts.push(chunk("IEND", new Uint8Array(0)));
  return join(...parts);
};

const gif = (width = 640, height = 480) =>
  join(asciiBytes("GIF89a"), bytes(width & 0xff, width >> 8, height & 0xff, height >> 8), bytes(0x00, 0x00));

const webpVp8x = (width = 1000, height = 800) => {
  const w = width - 1;
  const h = height - 1;
  const body = join(
    asciiBytes("VP8X"), u32(10),
    bytes(0x00, 0x00, 0x00, 0x00),
    bytes(w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff),
    bytes(h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff),
  );
  return join(asciiBytes("RIFF"), u32(body.length + 4), asciiBytes("WEBP"), body);
};

const pdf = () => join(asciiBytes("%PDF-1.7\n"), bytes(0x0a), asciiBytes("1 0 obj"));
const zip = () => join(bytes(0x50, 0x4b, 0x03, 0x04), new Uint8Array(20));
const ogg = () => join(asciiBytes("OggS"), new Uint8Array(20));
const mp4 = () => join(u32(24), asciiBytes("ftypisom"), new Uint8Array(16));

/** Does a buffer contain this byte sequence anywhere? */
const contains = (haystack: Uint8Array, needle: Uint8Array): boolean => {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

// ── 1. What a file actually is ───────────────────────────────────────────────

describe("sniffing what a file really is", () => {
  const cases: Array<[string, Uint8Array, SniffedType]> = [
    ["jpeg", jpeg(), "image/jpeg"],
    ["png", png(), "image/png"],
    ["gif", gif(), "image/gif"],
    ["webp", webpVp8x(), "image/webp"],
    ["pdf", pdf(), "application/pdf"],
    ["ogg", ogg(), "audio/ogg"],
    ["mp4", mp4(), "video/mp4"],
    ["zip/ooxml", zip(), "application/zip"],
  ];

  for (const [name, file, expected] of cases) {
    it(`recognises ${name}`, () => expect(safety.sniffMime(file)).toBe(expected));
  }

  it("says unknown rather than guessing", () => {
    expect(safety.sniffMime(asciiBytes("just some plain text"))).toBe("unknown");
    expect(safety.sniffMime(new Uint8Array(0))).toBe("unknown");
    expect(safety.sniffMime(bytes(1, 2, 3))).toBe("unknown");
  });

  it("catches a file pretending to be another kind entirely", () => {
    // The case that matters: known bytes, a different known claim.
    expect(safety.mimeAgrees("image/jpeg", safety.sniffMime(pdf()))).toBe(false);
    expect(safety.mimeAgrees("image/png", safety.sniffMime(zip()))).toBe(false);
  });

  it("tolerates the honest mismatches real senders produce", () => {
    // A voice note declared ogg that is really an MP4 container.
    expect(safety.mimeAgrees("audio/ogg", "video/mp4")).toBe(true);
    // Every Office document is a ZIP.
    expect(safety.mimeAgrees(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    )).toBe(true);
    // Opus labelled as ogg, and the reverse.
    expect(safety.mimeAgrees("audio/opus", "audio/ogg")).toBe(true);
    // Plain text has no signature at all.
    expect(safety.mimeAgrees("text/plain", "unknown")).toBe(true);
    // A parameterised MIME still matches.
    expect(safety.mimeAgrees("image/jpeg; charset=binary", "image/jpeg")).toBe(true);
  });

  it("never throws, whatever it is handed", () => {
    for (const hostile of [new Uint8Array(0), bytes(0xff), new Uint8Array(3), bytes(0xff, 0xd8)]) {
      expect(() => safety.sniffMime(hostile)).not.toThrow();
      expect(() => safety.readImageDimensions(hostile)).not.toThrow();
      expect(() => safety.checkDecompressionBomb(hostile)).not.toThrow();
      expect(() => safety.inspectImage(hostile, "image/jpeg")).not.toThrow();
    }
  });
});

// ── 2. How big it really is ──────────────────────────────────────────────────

describe("reading dimensions without decoding", () => {
  it("reads each format from its header", () => {
    expect(safety.readImageDimensions(jpeg({ width: 1920, height: 1080 }))).toEqual({ width: 1920, height: 1080 });
    expect(safety.readImageDimensions(png({ width: 1024, height: 768 }))).toEqual({ width: 1024, height: 768 });
    expect(safety.readImageDimensions(gif(640, 480))).toEqual({ width: 640, height: 480 });
    expect(safety.readImageDimensions(webpVp8x(1000, 800))).toEqual({ width: 1000, height: 800 });
  });

  it("finds the frame header past a large EXIF segment", () => {
    // The realistic case: a phone photo whose APP1 is kilobytes long. A parser
    // that only looked at a fixed offset would miss the size entirely.
    const withExif = jpeg({ width: 4032, height: 3024, withExif: true, withComment: true });
    expect(safety.readImageDimensions(withExif)).toEqual({ width: 4032, height: 3024 });
  });

  it("returns null for a format it cannot measure", () => {
    expect(safety.readImageDimensions(pdf())).toBeNull();
    expect(safety.readImageDimensions(asciiBytes("hello"))).toBeNull();
  });
});

describe("decompression bombs", () => {
  it("passes an ordinary photograph", () => {
    const verdict = safety.checkDecompressionBomb(jpeg({ width: 4032, height: 3024 }));
    expect(verdict.ok).toBe(true);
  });

  it("refuses an image with too many pixels", () => {
    // ~10,000 × 10,000 = 100 MP in a header a few dozen bytes long.
    const verdict = safety.checkDecompressionBomb(png({ width: 10_000, height: 10_000 }));
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("too_many_pixels");
  });

  it("refuses a long thin strip, which the pixel count alone would pass", () => {
    // 1 × 30,000 is only 30,000 pixels. The edge rule is what catches it.
    const verdict = safety.checkDecompressionBomb(png({ width: 30_000, height: 1 }));
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("edge_too_long");
  });

  it("MUTATION: the bomb is small on disk, which is why bytes are not enough", () => {
    // The whole argument for this check: the file that would kill the worker is
    // smaller than the one that would not.
    const bomb = png({ width: 10_000, height: 10_000 });
    const ordinary = jpeg({ width: 4032, height: 3024, withExif: true });
    expect(bomb.length).toBeLessThan(ordinary.length);
    expect(safety.checkDecompressionBomb(bomb).ok).toBe(false);
    expect(safety.checkDecompressionBomb(ordinary).ok).toBe(true);
  });

  it("passes what it cannot measure rather than refusing real photographs", () => {
    expect(safety.checkDecompressionBomb(asciiBytes("not an image")).ok).toBe(true);
  });
});

// ── 3. What else it is carrying ──────────────────────────────────────────────

describe("metadata never leaves with the picture", () => {
  const GPS_TAG = bytes(0x25, 0x88);            // EXIF tag 0x8825, GPSInfoIFD
  const EXIF_MARKER = asciiBytes("Exif");

  it("removes EXIF from a JPEG", () => {
    const original = jpeg({ withExif: true });
    expect(contains(original, EXIF_MARKER), "the fixture must really carry EXIF").toBe(true);
    expect(contains(original, GPS_TAG), "the fixture must really carry a GPS tag").toBe(true);

    const result = safety.stripImageMetadata(original, "image/jpeg");
    expect(result.stripped).toBe(true);
    expect(result.removed).toBeGreaterThan(0);
    expect(contains(result.bytes, EXIF_MARKER)).toBe(false);
    expect(contains(result.bytes, GPS_TAG)).toBe(false);
  });

  it("removes a JPEG comment too", () => {
    const result = safety.stripImageMetadata(jpeg({ withComment: true }), "image/jpeg");
    expect(contains(result.bytes, asciiBytes("taken at home"))).toBe(false);
  });

  it("keeps the picture: the image is still valid and the same size", () => {
    const original = jpeg({ width: 4032, height: 3024, withExif: true, withComment: true });
    const result = safety.stripImageMetadata(original, "image/jpeg");

    expect(safety.sniffMime(result.bytes)).toBe("image/jpeg");
    expect(safety.readImageDimensions(result.bytes)).toEqual({ width: 4032, height: 3024 });
    // Structure intact: still starts SOI and ends EOI, and the scan survived.
    expect([result.bytes[0], result.bytes[1]]).toEqual([0xff, 0xd8]);
    expect([result.bytes.at(-2), result.bytes.at(-1)]).toEqual([0xff, 0xd9]);
    expect(contains(result.bytes, bytes(0x12, 0x34, 0x56, 0x78))).toBe(true);
    expect(result.bytes.length).toBeLessThan(original.length);
  });

  it("removes eXIf and text chunks from a PNG", () => {
    const original = png({ withExif: true, withText: true });
    expect(contains(original, EXIF_MARKER)).toBe(true);

    const result = safety.stripImageMetadata(original, "image/png");
    expect(result.stripped).toBe(true);
    expect(contains(result.bytes, EXIF_MARKER)).toBe(false);
    expect(contains(result.bytes, asciiBytes("31.95, 35.93"))).toBe(false);
    // And it is still a PNG of the same size, with its pixels.
    expect(safety.sniffMime(result.bytes)).toBe("image/png");
    expect(safety.readImageDimensions(result.bytes)).toEqual({ width: 800, height: 600 });
    expect(contains(result.bytes, asciiBytes("IDAT"))).toBe(true);
    expect(contains(result.bytes, asciiBytes("IEND"))).toBe(true);
  });

  it("leaves a clean image entirely alone", () => {
    const clean = jpeg();
    const result = safety.stripImageMetadata(clean, "image/jpeg");
    expect(result.stripped).toBe(false);
    expect(result.removed).toBe(0);
    expect(result.bytes).toBe(clean); // same reference: nothing was rebuilt
  });

  it("does not pretend to strip a format it cannot rewrite safely", () => {
    // WebP metadata needs the RIFF length rewritten; getting that wrong
    // corrupts the image, which is worse than the metadata.
    const result = safety.stripImageMetadata(webpVp8x(), "image/webp");
    expect(result.stripped).toBe(false);
    expect(result.bytes).toBe(result.bytes);
  });
});

// ── 4. The one call the webhook makes ────────────────────────────────────────

describe("inspectImage", () => {
  it("accepts, measures and cleans an ordinary photograph in one call", () => {
    const verdict = safety.inspectImage(jpeg({ width: 4032, height: 3024, withExif: true }), "image/jpeg");
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.sniffed).toBe("image/jpeg");
    expect(verdict.dimensions).toEqual({ width: 4032, height: 3024 });
    expect(verdict.stripped).toBe(true);
    expect(contains(verdict.bytes, asciiBytes("Exif"))).toBe(false);
  });

  it("refuses a mismatch before doing any other work", () => {
    const verdict = safety.inspectImage(pdf(), "image/jpeg");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("mime_mismatch");
  });

  it("refuses a bomb before walking it", () => {
    const verdict = safety.inspectImage(png({ width: 10_000, height: 10_000 }), "image/png");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("too_many_pixels");
  });

  it("is order-dependent on purpose: sniff, measure, then strip", () => {
    // A bomb that also mismatches reports the mismatch, because that check is
    // first and is the cheaper refusal.
    const bombPretendingToBeJpeg = png({ width: 10_000, height: 10_000 });
    const verdict = safety.inspectImage(bombPretendingToBeJpeg, "image/jpeg");
    expect(verdict.ok === false && verdict.reason).toBe("mime_mismatch");
  });

  it("never throws on hostile or truncated input", () => {
    const truncated = jpeg({ withExif: true }).subarray(0, 12);
    for (const input of [truncated, new Uint8Array(0), bytes(0xff, 0xd8, 0xff)]) {
      expect(() => safety.inspectImage(input, "image/jpeg")).not.toThrow();
    }
  });
});

// ── 5. The production path is the one under test ─────────────────────────────

describe("the webhook actually uses it", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("inspects the image between downloading it and understanding it", () => {
    const download = webhook.indexOf("kind: incoming.media.kind,");
    const inspect = webhook.indexOf("const inspected = inspectImage(");
    const understand = webhook.indexOf("const seen = await understandImage({");
    expect(inspect).toBeGreaterThan(download);
    expect(understand).toBeGreaterThan(inspect);
  });

  it("forwards the STRIPPED bytes, which is what makes the check load-bearing", () => {
    // The failure this guards against is subtle and silent: inspect the image,
    // then send the original anyway. Everything would pass except the privacy.
    expect(webhook).toContain("bytes: inspected.bytes,");
    const call = webhook.slice(webhook.indexOf("const seen = await understandImage({"));
    expect(call.slice(0, 400)).not.toContain("bytes: media.bytes");
  });

  it("refuses rather than forwarding when inspection fails", () => {
    const block = webhook.slice(webhook.indexOf("const inspected = inspectImage("));
    expect(block.slice(0, 500)).toContain("if (!inspected.ok)");
    expect(block.slice(0, 500)).toContain("continue;");
  });

  it("logs a reason and a count, never the metadata it removed", () => {
    const rejected = webhook.slice(webhook.indexOf('log("image_rejected"'), webhook.indexOf('log("image_rejected"') + 220);
    expect(rejected).toContain("reason: inspected.reason");
    expect(rejected).not.toContain("media.bytes,");
  });
});
