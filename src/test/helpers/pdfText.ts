/**
 * Reads back what a jsPDF document actually drew: every text-showing operator,
 * its position, and its text decoded through the font's own ToUnicode map.
 * Real PDF bytes, no mocks — this is how the Arabic tests know the glyphs on
 * the page are shaped, in order, and in a font that has them.
 */
export interface DrawnText {
  /** The embedded Arabic font (a hex glyph string) or a built-in font (a literal). */
  embedded: boolean;
  x: number;
  y: number;
  /** For embedded fonts: presentation forms, left to right as drawn. */
  text: string;
}

export function drawnText(pdf: string): DrawnText[] {
  const toUnicode = new Map<string, string>();
  for (const block of pdf.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, glyph, unicode] of block[1].matchAll(/<([0-9a-f]+)><([0-9a-f]+)>/gi)) {
      toUnicode.set(glyph.toLowerCase(), String.fromCodePoint(...unicode.match(/.{4}/g)!.map((h) => parseInt(h, 16))));
    }
  }
  const out: DrawnText[] = [];
  const op = /(-?[\d.]+) (-?[\d.]+) Td\s*(?:<([0-9a-f]*)>|\(((?:\\.|[^\\)])*)\)) Tj/gi;
  for (const [, x, y, hex, literal] of pdf.matchAll(op)) {
    if (hex !== undefined) {
      const glyphs = hex.match(/.{4}/g) ?? [];
      out.push({ embedded: true, x: Number(x), y: Number(y), text: glyphs.map((g) => toUnicode.get(g.toLowerCase()) ?? "�").join("") });
    } else {
      out.push({ embedded: false, x: Number(x), y: Number(y), text: literal.replace(/\\(.)/g, "$1") });
    }
  }
  return out;
}

/** An embedded run read back in logical order: reversed, then presentation forms unfolded. */
export function logical(run: DrawnText): string {
  return [...run.text].reverse().join("").normalize("NFKC");
}

/**
 * A built-in-font run that carries Arabic. jsPDF writes each presentation
 * form (U+FB50–U+FEFF) into a WinAnsi font as its two bytes, so the page shows
 * "þâþßþŽ…": a 0xFB–0xFE byte before every character. An em dash or a
 * "café" is one high byte and does not match.
 */
const cp = (code: number) => String.fromCharCode(code);
const MANGLED = new RegExp(`(?:[${cp(0xfb)}-${cp(0xfe)}].){2}`, "s");
const ARABIC_IN_BUILT_IN_FONT = new RegExp(`[${cp(0x600)}-${cp(0x6ff)}${cp(0xfb50)}-${cp(0xfeff)}]`);

export function isGibberish(run: DrawnText): boolean {
  return !run.embedded && (MANGLED.test(run.text) || ARABIC_IN_BUILT_IN_FONT.test(run.text));
}
