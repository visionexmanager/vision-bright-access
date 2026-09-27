/**
 * Arabic-script text for jsPDF — the one place every PDF generator gets it.
 *
 * jsPDF's built-in fonts are WinAnsi: Arabic handed to them comes out as
 * "þâþßþŽ…". This registers Noto Naskh Arabic on a document and routes that
 * document's `text()` and `splitTextToSize()` through a layout that is correct
 * for mixed Arabic and Latin lines.
 *
 * Why not just `setFont("NotoNaskhArabic")`? Three facts, all measured:
 *
 *  - The font has no Latin letters and almost no ASCII punctuation (only
 *    space ! , . : and digits), so a line like "Visionex مرحبا (2026)" cannot
 *    be drawn in it alone. Arabic goes in Noto; everything else stays in the
 *    page's own font.
 *  - jsPDF shapes Arabic (Unicode presentation forms) and reorders it
 *    right-to-left inside every `text()` call, and running its shaper twice
 *    is not safe: on 530 of 22,411 words from the ar/fa/ur dictionaries a
 *    second pass over reordered text invents lam-alef ligatures. So nothing
 *    here pre-shapes. Each Arabic segment is drawn once, in logical order,
 *    through jsPDF's own shaping and reordering; this module only decides
 *    where segments, Latin words, numbers and punctuation sit on the line —
 *    the Unicode bidi rules for levels, reordering and bracket mirroring.
 *  - jsPDF's shaper counts Arabic punctuation and Arabic-Indic digits as
 *    letters that join, so the «ك» of «حالك؟» came out in its initial form.
 *    Those characters are therefore never inside a shaped segment: they are
 *    units of their own, drawn in Noto as they are.
 *
 * A document is only changed when its content contains Arabic script. For
 * everything else `enableArabicText` does nothing and the PDF is byte for byte
 * what it was.
 *
 * Every non-ASCII character below is built from its code point: an escape
 * written into this file has been known to arrive as the invisible character
 * itself.
 */
import type { jsPDF } from "jspdf";
import fontUrl from "@/assets/fonts/NotoNaskhArabic-Regular.ttf?url";

export const ARABIC_FONT_NAME = "NotoNaskhArabic";
const FONT_FILE = "NotoNaskhArabic-Regular.ttf";

const cp = (code: number) => String.fromCharCode(code);
const charClass = (...ranges: Array<[number, number]>) =>
  `[${ranges.map(([from, to]) => (from === to ? cp(from) : `${cp(from)}-${cp(to)}`)).join("")}]`;

/** The script jsPDF's shaper handles: Arabic, Supplement, Extended-A, presentation forms. */
const ARABIC = new RegExp(charClass([0x0600, 0x06ff], [0x0750, 0x077f], [0x08a0, 0x08ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]));
/** Arabic punctuation: comma, semicolon, question mark, percent and separators, full stop. */
const ARABIC_PUNCTUATION = new RegExp(charClass([0x060c, 0x060c], [0x061b, 0x061b], [0x061f, 0x061f], [0x066a, 0x066d], [0x06d4, 0x06d4]));
/** Of those, the ones that are strongly right-to-left in the bidi algorithm. */
const ARABIC_STRONG_PUNCTUATION = new RegExp(charClass([0x061b, 0x061b], [0x061f, 0x061f], [0x06d4, 0x06d4]));
/** Arabic-Indic and Extended Arabic-Indic digits, with the Arabic decimal and thousands separators. */
const ARABIC_DIGIT = new RegExp(charClass([0x0660, 0x0669], [0x06f0, 0x06f9]));
/** An Arabic-Indic number: a separator between two digits keeps it one unit (bidi W4). */
const ARABIC_NUMBER = new RegExp(`^${ARABIC_DIGIT.source}+(?:${charClass([0x066b, 0x066c], [0x2f, 0x2f], [0x2e, 0x2e], [0x2c, 0x2c], [0x3a, 0x3a])}${ARABIC_DIGIT.source}+)*`);
/**
 * Invisible bidi controls. The marks steer direction and are not drawn —
 * Arabic dates from toLocaleDateString carry an RLM after each part. The
 * embeddings and isolates are not supported and are dropped.
 */
const RTL_MARK = new RegExp(charClass([0x200f, 0x200f], [0x061c, 0x061c]));
const LTR_MARK = new RegExp(charClass([0x200e, 0x200e]));
const BIDI_CONTROL = new RegExp(charClass([0x202a, 0x202e], [0x2066, 0x2069]));
/** Characters the Noto font carries besides Arabic: they may sit inside a shaped segment. */
// ZWNJ and ZWJ stay inside a segment: Persian writes with ZWNJ, and jsPDF's
// shaper already treats it as the break in joining it is.
const NOTO_SHARED = new RegExp(charClass([0x20, 0x20], [0x30, 0x39], [0x2e, 0x2e], [0x2c, 0x2c], [0x3a, 0x3a], [0x21, 0x21], [0xa0, 0xa0], [0x200c, 0x200d]));
const DIGIT = /[0-9]/;
/** A number, with the separators and signs that keep it one left-to-right unit. */
const NUMBER = new RegExp(`^[-+$${cp(0x20ac)}${cp(0xa3)}]?[0-9]+(?:[.,:/-][0-9]+)*%?`);
const LETTER = /[\p{L}\p{M}]/u;
/** Paragraph-direction hint splitTextToSize leaves on each line of a right-to-left paragraph. */
const RLM = cp(0x200f);
const LEADING_RLM = new RegExp(`^${RLM}+`);
const MIRROR: Record<string, string> = {
  "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<",
  [cp(0xab)]: cp(0xbb), [cp(0xbb)]: cp(0xab),
};

/** A letter jsPDF may shape: Arabic, but not punctuation or a digit. */
const isJoinable = (ch: string) => ARABIC.test(ch) && !ARABIC_PUNCTUATION.test(ch) && !ARABIC_DIGIT.test(ch) && !RTL_MARK.test(ch);

export function containsArabic(value: unknown): boolean {
  if (typeof value === "string") return ARABIC.test(value);
  if (Array.isArray(value)) return value.some(containsArabic);
  if (value && typeof value === "object") return Object.values(value).some(containsArabic);
  return false;
}

let fontData: Promise<string> | null = null;

function loadFont(): Promise<string> {
  fontData ??= fetch(fontUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`Arabic PDF font failed to load: HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    })
    .catch((error) => {
      fontData = null;
      throw error;
    });
  return fontData;
}

/**
 * R  — Arabic letters (and the spaces and digits between them): shaped and
 *      ordered by jsPDF.
 * AP — one Arabic punctuation mark; AN — an Arabic-Indic number. Both are
 *      drawn in Noto exactly as they are.
 * L  — a Latin (or other non-Arabic) word; EN — a European number;
 *      N  — one neutral character. All three stay in the page's font.
 * X  — an invisible bidi control: it may set a direction, and draws nothing.
 */
export type Unit = { kind: "R" | "AP" | "AN" | "L" | "EN" | "N" | "X"; text: string; dir?: "L" | "R" };

/** Split a logical line into bidi units. */
function tokenize(line: string): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (RTL_MARK.test(ch) || LTR_MARK.test(ch) || BIDI_CONTROL.test(ch)) {
      units.push({ kind: "X", text: "", dir: RTL_MARK.test(ch) ? "R" : LTR_MARK.test(ch) ? "L" : undefined });
      i++;
      continue;
    }
    if (isJoinable(ch)) {
      // Extend over joining letters and the characters Noto shares, then give
      // back everything after the last letter — trailing spaces, and a number
      // that runs on into something Noto lacks ("50%") — to be resolved on
      // its own.
      let end = i + 1;
      let lastLetter = i;
      while (end < line.length && (isJoinable(line[end]) || NOTO_SHARED.test(line[end]))) {
        if (isJoinable(line[end])) lastLetter = end;
        end++;
      }
      units.push({ kind: "R", text: line.slice(i, lastLetter + 1) });
      i = lastLetter + 1;
      continue;
    }
    if (ARABIC_DIGIT.test(ch)) {
      const number = ARABIC_NUMBER.exec(line.slice(i))![0];
      units.push({ kind: "AN", text: number });
      i += number.length;
      continue;
    }
    if (ARABIC.test(ch)) {
      units.push({ kind: "AP", text: ch });
      i++;
      continue;
    }
    const number = NUMBER.exec(line.slice(i));
    if (number && (DIGIT.test(ch) || DIGIT.test(line[i + 1] ?? ""))) {
      units.push({ kind: "EN", text: number[0] });
      i += number[0].length;
      continue;
    }
    if (LETTER.test(ch)) {
      let end = i + 1;
      while (end < line.length && LETTER.test(line[end]) && !ARABIC.test(line[end])) end++;
      units.push({ kind: "L", text: line.slice(i, end) });
      i = end;
      continue;
    }
    units.push({ kind: "N", text: ch });
    i++;
  }
  return units;
}

/**
 * Visual order, left to right, of a logical line's units: Unicode bidi rules
 * W2/W7 (numbers), N1/N2 (neutrals), I1/I2 (levels), L1 (trailing spaces),
 * L2 (reordering) and L4 (mirroring). There are no explicit embeddings.
 */
export function visualUnits(line: string, rtl?: boolean): { units: Unit[]; rtl: boolean } {
  const units = tokenize(line);
  const strongOf = (u: Unit): "L" | "R" | null =>
    u.kind === "R" ? "R" : u.kind === "L" ? "L" : u.kind === "X" ? u.dir ?? null
      : u.kind === "AP" && ARABIC_STRONG_PUNCTUATION.test(u.text) ? "R" : null;
  const firstStrong = units.map(strongOf).find((s) => s !== null);
  const paragraphRtl = rtl ?? firstStrong === "R";
  const p = paragraphRtl ? 1 : 0;
  const sos = paragraphRtl ? "R" : "L";

  // Numbers: European ones after Arabic act as R toward neutrals (W2), after
  // Latin or at the start of a left-to-right line they are L (W7); Arabic
  // ones always act as R.
  const strongType: Array<"L" | "R" | null> = [];
  let lastStrong: "L" | "R" = sos;
  for (const u of units) {
    const strong = strongOf(u);
    if (strong) {
      lastStrong = strong;
      strongType.push(strong);
    } else if (u.kind === "EN") strongType.push(lastStrong === "L" ? "L" : "R");
    else if (u.kind === "AN") strongType.push("R");
    else strongType.push(null);
  }
  // Neutrals take the direction of their neighbours when those agree (N1),
  // the paragraph's otherwise (N2).
  const resolved = strongType.slice();
  for (let i = 0; i < units.length; i++) {
    if (resolved[i] !== null) continue;
    let j = i;
    while (j < units.length && strongType[j] === null) j++;
    const before = i === 0 ? sos : strongType[i - 1]!;
    const after = j === units.length ? sos : strongType[j]!;
    const dir = before === after ? before : sos;
    for (let k = i; k < j; k++) resolved[k] = dir;
    i = j - 1;
  }
  const levels = units.map((u, i) => {
    if (u.kind === "EN") return strongType[i] === "L" ? (p === 0 ? 0 : 2) : 2;
    if (u.kind === "AN") return 2;
    const dir = resolved[i];
    if (p === 0) return dir === "R" ? 1 : 0;
    return dir === "R" ? 1 : 2;
  });
  // L1: whitespace at the end of the line goes back to the paragraph level.
  for (let i = units.length - 1; i >= 0 && units[i].kind === "N" && /\s/.test(units[i].text); i--) levels[i] = p;

  // L2: from the highest level down to 1, reverse every run at that level or above.
  const order = units.map((_, i) => i);
  const max = Math.max(0, ...levels);
  for (let level = max; level >= 1; level--) {
    for (let i = 0; i < order.length; i++) {
      if (levels[order[i]] < level) continue;
      let j = i;
      while (j < order.length && levels[order[j]] >= level) j++;
      order.splice(i, j - i, ...order.slice(i, j).reverse());
      i = j;
    }
  }
  // L4: a bracket in a right-to-left run is drawn as its mirror.
  const visual = order.map((i) => {
    const u = units[i];
    return u.kind === "N" && levels[i] % 2 === 1 && MIRROR[u.text] ? { ...u, text: MIRROR[u.text] } : u;
  });
  return { units: visual, rtl: paragraphRtl };
}

type TextFn = jsPDF["text"];
type SplitFn = jsPDF["splitTextToSize"];
interface Patched { text: TextFn; split: SplitFn }
const patched = new WeakMap<jsPDF, Patched>();

interface Chunk {
  /** Drawn in the embedded Noto font. */
  arabic: boolean;
  /** Logical text for jsPDF to shape and order; otherwise already visual. */
  shaped: boolean;
  text: string;
}

/**
 * Group visual units into drawable chunks: each shaped segment alone; every
 * other character in the font that has it (Noto for Arabic script, the page's
 * font for the rest — the "/" of an Arabic date included), merged per font.
 */
function chunks(units: Unit[]): Chunk[] {
  const out: Chunk[] = [];
  for (const u of units) {
    if (u.kind === "R") {
      out.push({ arabic: true, shaped: true, text: u.text });
      continue;
    }
    for (const ch of u.text) {
      const arabic = ARABIC.test(ch);
      const last = out[out.length - 1];
      if (last && !last.shaped && last.arabic === arabic) last.text += ch;
      else out.push({ arabic, shaped: false, text: ch });
    }
  }
  return out;
}

function withFont<T>(doc: jsPDF, arabic: boolean, draw: () => T): T {
  if (!arabic) return draw();
  const { fontName, fontStyle } = doc.getFont();
  doc.setFont(ARABIC_FONT_NAME, "normal");
  try {
    return draw();
  } finally {
    doc.setFont(fontName, fontStyle);
  }
}

function lineWidth(doc: jsPDF, line: string): number {
  return chunks(tokenize(line)).reduce((sum, c) => sum + withFont(doc, c.arabic, () => doc.getTextWidth(c.text)), 0);
}

function drawLine(
  doc: jsPDF, original: Patched, line: string, x: number, y: number,
  options: { align?: string; maxWidth?: number; baseline?: string } & Record<string, unknown>,
) {
  const rtlHint = LEADING_RLM.test(line) ? true : undefined;
  line = line.replace(LEADING_RLM, "");
  const { maxWidth, ...rest } = options;
  const flushRight = !options.align || options.align === "left";

  if (!ARABIC.test(line)) {
    // A non-Arabic stretch of a right-to-left paragraph still ends on the right.
    if (rtlHint && maxWidth && flushRight) original.text.call(doc, line, x + maxWidth, y, { ...rest, align: "right" });
    else original.text.call(doc, line, x, y, rest);
    return;
  }
  const { units, rtl } = visualUnits(line, rtlHint);
  const parts = chunks(units).map((c) => ({ ...c, width: withFont(doc, c.arabic, () => doc.getTextWidth(c.text)) }));
  const total = parts.reduce((sum, c) => sum + c.width, 0);
  let cursor = x;
  if (options.align === "center") cursor = x - total / 2;
  else if (options.align === "right") cursor = x - total;
  else if (rtl && maxWidth) cursor = x + maxWidth - total;
  const baseline = options.baseline ? { baseline: options.baseline } : {};
  for (const part of parts) {
    withFont(doc, part.arabic, () => {
      // A shaped segment is logical text: jsPDF shapes it and orders it.
      // Everything else is already in visual order, so its reordering is off.
      const draw = part.shaped ? { ...baseline } : { ...baseline, isInputVisual: true, isOutputVisual: true };
      original.text.call(doc, part.text, cursor, y, draw);
    });
    cursor += part.width;
  }
}

function wrap(doc: jsPDF, paragraph: string, maxWidth: number, rtlHint?: boolean): string[] {
  const rtl = rtlHint ?? visualUnits(paragraph).rtl;
  const words = paragraph.split(/ +/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && lineWidth(doc, candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current || lines.length === 0) lines.push(current);
  return rtl ? lines.map((l) => RLM + l) : lines;
}

/**
 * `doc.text`, for text that runs across a box `width` wide from `x`: a
 * right-to-left line ends on the box's right edge instead of starting at `x`.
 * On a document without Arabic this is exactly `doc.text(text, x, y, options)`.
 */
export function textInBox(
  doc: jsPDF, text: string | string[], x: number, y: number, width: number,
  options?: Parameters<jsPDF["text"]>[3],
): jsPDF {
  const lines = Array.isArray(text) ? text : [text];
  const rtlAware = patched.has(doc) && lines.some((l) => ARABIC.test(l) || LEADING_RLM.test(l));
  return rtlAware ? doc.text(text, x, y, { ...options, maxWidth: width }) : doc.text(text, x, y, options);
}

/**
 * Make `doc` draw Arabic correctly, if `content` has any. Call it once, before
 * drawing, with the data the document will show (objects and arrays are
 * searched). Returns whether Arabic support was switched on.
 */
export async function enableArabicText(doc: jsPDF, ...content: unknown[]): Promise<boolean> {
  if (patched.has(doc)) return true;
  if (!containsArabic(content)) return false;

  const data = await loadFont();
  doc.addFileToVFS(FONT_FILE, data);
  doc.addFont(FONT_FILE, ARABIC_FONT_NAME, "normal");

  const original: Patched = { text: doc.text, split: doc.splitTextToSize };
  patched.set(doc, original);

  doc.splitTextToSize = function (text: string | string[], maxWidth: number, options?: unknown) {
    if (!containsArabic(text)) return original.split.call(doc, text, maxWidth, options);
    const paragraphs = (Array.isArray(text) ? text : [text]).flatMap((t) => String(t).split(/\r?\n/));
    return paragraphs.flatMap((p) => {
      // A line that already went through here keeps its direction, and gets
      // one marker back — not a second one.
      const rtlHint = LEADING_RLM.test(p) ? true : undefined;
      const bare = p.replace(LEADING_RLM, "");
      if (ARABIC.test(bare)) return wrap(doc, bare, maxWidth, rtlHint);
      const lines = original.split.call(doc, bare, maxWidth, options) as string[];
      return rtlHint ? lines.map((l) => RLM + l) : lines;
    });
  } as SplitFn;

  doc.text = function (text: string | string[], x: number, y: number, options?: Record<string, unknown>, transform?: unknown) {
    const plain = (Array.isArray(text) ? text : [text]).every((t) => !ARABIC.test(String(t)) && !LEADING_RLM.test(String(t)));
    if (plain) return original.text.call(doc, text, x, y, options, transform);
    const opts = (options ?? {}) as { align?: string; maxWidth?: number } & Record<string, unknown>;
    const lines = (Array.isArray(text) ? text : [text]).flatMap((t) => {
      const paragraphs = String(t).split(/\r?\n/);
      return opts.maxWidth ? paragraphs.flatMap((p) => doc.splitTextToSize(p, opts.maxWidth!) as string[]) : paragraphs;
    });
    const lineHeight = (doc.getFontSize() * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
    lines.forEach((line, i) => drawLine(doc, original, line, x, y + i * lineHeight, opts));
    return doc;
  } as TextFn;

  return true;
}
