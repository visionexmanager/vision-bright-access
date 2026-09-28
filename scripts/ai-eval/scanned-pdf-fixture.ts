// A one-page PDF that is only a picture — a "scan" with no text layer — built
// from a PNG, so the live checks need no binary fixture in the repository.
//
// A PNG's IDAT data is zlib-compressed rows, each led by a filter byte. A PDF
// image with /FlateDecode and /DecodeParms <</Predictor 15 …>> is exactly that
// format, so the PNG's compressed bytes go into the PDF unchanged. Greyscale
// (colour type 0) and RGB (2) at 8 bits are what the callers produce.

export function scannedPdfFromPng(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0, height = 0, colours = 1;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.slice(at + 4, at + 8));
    const data = png.slice(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = new DataView(data.buffer, data.byteOffset).getUint32(0);
      height = new DataView(data.buffer, data.byteOffset).getUint32(4);
      if (data[8] !== 8 || (data[9] !== 0 && data[9] !== 2)) throw new Error("8-bit greyscale or RGB PNG only");
      colours = data[9] === 2 ? 3 : 1;
    }
    if (type === "IDAT") idat.push(data);
    at += 12 + length;
  }
  const image = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let offset = 0;
  for (const d of idat) { image.set(d, offset); offset += d.length; }

  const enc = new TextEncoder();
  const content = enc.encode(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (bytes: Uint8Array) => { parts.push(bytes); size += bytes.length; };
  const object = (n: number, head: string, stream?: Uint8Array) => {
    offsets[n] = size;
    push(enc.encode(`${n} 0 obj\n${head}\n`));
    if (stream) { push(enc.encode("stream\n")); push(stream); push(enc.encode("\nendstream\n")); }
    push(enc.encode("endobj\n"));
  };
  push(enc.encode("%PDF-1.4\n"));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${colours === 3 ? "DeviceRGB" : "DeviceGray"} /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${colours} /BitsPerComponent 8 /Columns ${width} >> /Length ${image.length} >>`, image);
  object(5, `<< /Length ${content.length} >>`, content);
  const xrefAt = size;
  const rows = [1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, "0")} 00000 n \n`).join("");
  push(enc.encode(`xref\n0 6\n0000000000 65535 f \n${rows}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`));

  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
