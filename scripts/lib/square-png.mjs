// Pad a landscape PNG out to a square, without decoding the image.
//
// WhatsApp requires a square profile picture of at least 192x192 and crops it
// to a circle. The Visionex logo (`public/favicon.png`) is 1536x1024, so
// uploading it as-is means Meta or the client decides what to crop, and the
// tips of the X are what a centre crop takes first. Padding is the safe
// direction: the artwork sits on black, so black bars above and below are
// invisible, and the whole mark lands inside the circle.
//
// The padding is done on the compressed scanline stream rather than on pixels,
// which is why there is no image library here. A PNG row is a filter byte
// followed by the row's bytes; a row of all zeros is filter "None" followed by
// RGB (0,0,0) — black. And because the filter algorithms treat the row above
// the first one as all zeros, prepending rows that are themselves all zeros
// leaves every original row decoding to exactly the pixels it did before.
//
// That trick is what constrains the accepted formats. In an RGBA image a zero
// row is transparent, not black, and the prepended row would no longer match
// the implicit zero row the original first scanline was filtered against — so
// anything other than 8-bit truecolour is refused rather than quietly mangled.

import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Read the header and collect the image data, which may arrive in several IDATs. */
function parse(png) {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");

  const header = {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    bitDepth: png[24],
    colorType: png[25],
    compression: png[26],
    filter: png[27],
    interlace: png[28],
  };

  const idat = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (idat.length === 0) throw new Error("the PNG has no image data");

  return { header, idat: Buffer.concat(idat) };
}

/**
 * Describe why a PNG cannot be padded, or null if it can be.
 *
 * Separate from the padding itself so the offline validator can reject a
 * replaced logo in CI, months before anyone runs the publish workflow.
 */
export function squarePngProblem(png) {
  let parsed;
  try {
    parsed = parse(png);
  } catch (error) {
    return error.message;
  }
  const { width, height, bitDepth, colorType, interlace } = parsed.header;

  if (bitDepth !== 8 || colorType !== 2) {
    return `only 8-bit truecolour PNGs can be padded (this one is bit depth ${bitDepth}, colour type ${colorType}). ` +
      "Re-export the logo as 8-bit RGB with no alpha channel.";
  }
  if (interlace !== 0) return "interlaced PNGs cannot be padded; re-export without Adam7 interlacing";
  if (height > width) {
    return `the logo is taller than it is wide (${width}x${height}). Padding only adds rows, ` +
      "so a portrait image would need side bars this cannot write.";
  }
  // Meta's floor is 192 on a side, and padding never grows the shorter side's
  // content — a 100px-tall logo padded to square is still 100px of artwork.
  if (width < 192) return `the logo is ${width}px wide; WhatsApp requires at least 192px on a side`;

  return null;
}

/**
 * Return `png` padded to a square with black bars, or unchanged if it already
 * is one. Throws if `squarePngProblem` would have reported a reason.
 */
export function squarePng(png) {
  const problem = squarePngProblem(png);
  if (problem) throw new Error(problem);

  const { header, idat } = parse(png);
  const { width, height } = header;
  if (width === height) return png;

  const bytesPerRow = width * 3 + 1; // filter byte + RGB triples
  const raw = inflateSync(idat);
  if (raw.length !== height * bytesPerRow) {
    throw new Error(`image data is ${raw.length} bytes, expected ${height * bytesPerRow}`);
  }

  const missing = width - height;
  const above = Math.floor(missing / 2);
  const below = missing - above;
  const black = Buffer.alloc(bytesPerRow); // filter None, RGB 0,0,0

  const padded = Buffer.concat([
    ...Array.from({ length: above }, () => black),
    raw,
    ...Array.from({ length: below }, () => black),
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4); // square: the new height is the width
  ihdr[8] = header.bitDepth;
  ihdr[9] = header.colorType;
  ihdr[10] = header.compression;
  ihdr[11] = header.filter;
  ihdr[12] = header.interlace;

  // Only the chunks a decoder needs are carried over. The source carries a
  // caBX (content credentials) chunk that describes the original 1536x1024
  // artwork and would now be describing a different image.
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(padded, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Width and height of a PNG, for reporting. */
export function pngSize(png) {
  const { header } = parse(png);
  return { width: header.width, height: header.height };
}
