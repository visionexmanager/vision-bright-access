// Rebuilding a page's layout from where Tesseract found each word.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// A scan or an Arabic PDF is read by eye (see docconvert.mjs), and `txt` output
// from Tesseract is one long run of lines. A table in it becomes a column of
// numbers followed by a column of names, which is not a table and is not what
// anybody wanted in Word. The word table (`tsv`) says where every word sits, and
// that is enough to get most of the structure back without a model:
//
//   1. words on the same horizontal band are one row;
//   2. inside a row, a gap much wider than a word space starts a new cell;
//   3. a run of rows that all have several cells, lined up, is a table;
//   4. everything else is prose, and a larger gap between rows starts a paragraph.
//
// ── What it will not do ─────────────────────────────────────────────────────
//
// Merged cells, ruled lines, nested tables and pictures are not recovered: a
// table comes back as a grid of text. Two-column prose set close together can
// be mistaken for a two-cell table, so a run is only a table if its cells are
// short; prose columns have lines tens of characters long.
//
// Pure. No process, no file: it takes the text of a `.tsv` and returns blocks.

import { isRtlParagraph } from "./docconvert.mjs";

/** The words of a Tesseract TSV (level 5), with their boxes. Unreadable rows are skipped. */
export function parseWords(tsv) {
  const words = [];
  let index = 0;
  for (const line of String(tsv ?? "").split("\n").slice(1)) {
    const cells = line.replace(/\r$/, "").split("\t");
    if (cells.length < 12 || cells[0] !== "5") continue;
    const text = cells.slice(11).join("\t").trim();
    const left = Number(cells[6]);
    const top = Number(cells[7]);
    const width = Number(cells[8]);
    const height = Number(cells[9]);
    const conf = Number(cells[10]);
    if (!text || ![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;
    if (Number.isFinite(conf) && conf < 0) continue;
    // `index` is Tesseract's own order, which inside a line is reading order
    // even for right-to-left scripts, with Latin words in place.
    words.push({ left, top, width, height, text, index: index++ });
  }
  return words;
}

/**
 * The direction of a paragraph by its first letter that has one, the rule the
 * Unicode bidirectional algorithm itself uses. Counting letters would call an
 * Arabic sentence that quotes a long English product name left-to-right.
 */
export function startsRtl(text) {
  for (const ch of String(text)) {
    if (/[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/u.test(ch)) return true;
    if (/\p{L}/u.test(ch)) return false;
  }
  return false;
}

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** A gap wider than this many text heights starts a new cell. */
export const CELL_GAP_HEIGHTS = 1.8;
/** Rows closer than this many text heights (centre to centre) are one run. */
export const ROW_PITCH_HEIGHTS = 2.4;
/** A paragraph break is a row gap wider than this many text heights. */
export const PARAGRAPH_GAP_HEIGHTS = 1.9;
/** Cells longer than this are prose, so the "table" is two columns of text. */
export const MAX_TABLE_CELL_CHARS = 60;
/** More words per cell than this on average is prose set in columns, not a table. */
export const MAX_TABLE_WORDS_PER_CELL = 5;

function clusterRows(words, medianH) {
  const ordered = [...words].sort((a, b) => (a.top + a.height / 2) - (b.top + b.height / 2));
  const rows = [];
  for (const word of ordered) {
    const centre = word.top + word.height / 2;
    const last = rows[rows.length - 1];
    if (last && Math.abs(centre - last.centre) <= medianH * 0.6) {
      last.words.push(word);
      last.centre = (last.centre * (last.words.length - 1) + centre) / last.words.length;
    } else {
      rows.push({ words: [word], centre });
    }
  }
  for (const row of rows) row.words.sort((a, b) => a.left - b.left);
  return rows;
}

function splitCells(words, gapPx) {
  const cells = [];
  let current = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].left - (words[i - 1].left + words[i - 1].width);
    if (gap > gapPx) {
      cells.push(current);
      current = [];
    }
    current.push(words[i]);
  }
  cells.push(current);
  return cells.map((cell) => ({
    words: cell,
    left: cell[0].left,
    right: cell[cell.length - 1].left + cell[cell.length - 1].width,
  }));
}

// Words of a cell in the engine's reading order, not left to right: a Latin
// phrase inside an Arabic line must not be turned round.
const cellText = (cell) => [...cell.words].sort((a, b) => a.index - b.index).map((w) => w.text).join(" ");

/**
 * Blocks for one page: `{ type: "para", text, rtl }` and
 * `{ type: "table", rows: string[][], rtl }`, in reading order.
 *
 * `rtl` on a table means its first logical column is the right-hand one; the
 * cells are already in logical order, so a reader (or Word) lays them out
 * right to left.
 */
export function buildBlocks(words) {
  if (!words || words.length === 0) return [];
  const medianH = median(words.map((w) => w.height));
  const rtlPage = isRtlParagraph(words.map((w) => w.text).join(" "));
  const rows = clusterRows(words, medianH).map((row) => ({
    ...row,
    cells: splitCells(row.words, medianH * CELL_GAP_HEIGHTS),
  }));

  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "para", text, rtl: startsRtl(text) });
    paragraph = [];
  };

  let i = 0;
  let previousCentre = null;
  while (i < rows.length) {
    // A run of rows with several cells each, close together.
    let j = i;
    while (
      j < rows.length &&
      rows[j].cells.length >= 2 &&
      (j === i || rows[j].centre - rows[j - 1].centre <= medianH * ROW_PITCH_HEIGHTS)
    ) j++;
    const run = rows.slice(i, j);
    const reference = run.reduce((best, row) => (row.cells.length > best.cells.length ? row : best), run[0] ?? { cells: [] });
    const longest = run.reduce((n, row) => Math.max(n, ...row.cells.map((c) => cellText(c).length)), 0);
    const cellCount = run.reduce((n, row) => n + row.cells.length, 0);
    const wordCount = run.reduce((n, row) => n + row.words.length, 0);
    const prose = cellCount > 0 && wordCount / cellCount > MAX_TABLE_WORDS_PER_CELL;
    const sameCount = run.length > 0 && run.every((row) => row.cells.length === run[0].cells.length);
    const isTable = run.length >= 2 && reference.cells.length >= 2 && longest <= MAX_TABLE_CELL_CHARS && !prose && (run.length >= 3 || sameCount);

    if (isTable) {
      flushParagraph();
      const anchors = reference.cells.map((c) => (c.left + c.right) / 2);
      const grid = run.map((row) => {
        const out = anchors.map(() => "");
        for (const cell of row.cells) {
          const centre = (cell.left + cell.right) / 2;
          let best = 0;
          for (let k = 1; k < anchors.length; k++) {
            if (Math.abs(anchors[k] - centre) < Math.abs(anchors[best] - centre)) best = k;
          }
          const text = cellText(cell);
          out[best] = out[best] ? `${out[best]} ${text}` : text;
        }
        return rtlPage ? out.reverse() : out;
      });
      blocks.push({ type: "table", rows: grid, rtl: rtlPage });
      previousCentre = run[run.length - 1].centre;
      i = j;
      continue;
    }

    const row = rows[i];
    if (previousCentre !== null && row.centre - previousCentre > medianH * PARAGRAPH_GAP_HEIGHTS) flushParagraph();
    // A right-to-left line reads from its right-most piece.
    paragraph.push((rtlPage ? [...row.cells].reverse() : row.cells).map((c) => cellText(c)).join(" "));
    previousCentre = row.centre;
    i++;
  }
  flushParagraph();
  return blocks;
}

const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One page's blocks as HTML body markup. A page after the first starts on a new page. */
export function blocksToHtml(blocks, { pageBreak = false } = {}) {
  const parts = [];
  let first = true;
  const style = (rtl) => {
    const rules = [rtl ? "text-align:right" : "", pageBreak && first ? "page-break-before:always" : ""].filter(Boolean);
    return rules.length ? ` style="${rules.join(";")}"` : "";
  };
  for (const block of blocks) {
    if (block.type === "para") {
      parts.push(`<p dir="${block.rtl ? "rtl" : "ltr"}"${style(block.rtl)}>${escapeHtml(block.text)}</p>`);
    } else {
      const dir = block.rtl ? "rtl" : "ltr";
      const body = block.rows
        .map((row) => `<tr>${row.map((cell) => `<td dir="${dir}"${block.rtl ? ' style="text-align:right"' : ""}>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("");
      // The break goes on a paragraph before the table: not every importer honours it on <table>.
      if (pageBreak && first) parts.push('<p style="page-break-before:always"></p>');
      parts.push(`<table dir="${dir}" border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%">${body}</table><p></p>`);
    }
    first = false;
  }
  return parts.join("");
}

export const wrapHtml = (body) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body>${body}</body></html>`;

/** One page's blocks as plain text: paragraphs separated by a blank line, table cells by a tab. */
export function blocksToText(blocks) {
  return blocks
    .map((block) => (block.type === "para" ? block.text : block.rows.map((row) => row.join("\t")).join("\n")))
    .join("\n\n");
}
