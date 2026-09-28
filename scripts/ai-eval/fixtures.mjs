// Synthetic, deterministic fixtures shared by the provider probes.

import { deflateSync } from "node:zlib";

// ── A deterministic test image: "HELLO 42" in a 5×7 bitmap font ─────────────

const GLYPHS = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function textPng(text, scale = 12, pad = 24) {
  const w = text.length * 6 * scale + pad * 2, h = 7 * scale + pad * 2;
  const raw = Buffer.alloc((w + 1) * h, 0xff);
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0; // filter byte
  [...text].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, gy) => [...row].forEach((bit, gx) => {
      if (bit !== "1") return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const x = pad + (i * 6 + gx) * scale + dx, y = pad + gy * scale + dy;
        raw[y * (w + 1) + 1 + x] = 0;
      }
    }));
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}
