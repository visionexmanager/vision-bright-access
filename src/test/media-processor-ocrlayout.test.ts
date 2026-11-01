import { describe, expect, it } from "vitest";

import { blocksToHtml, blocksToText, buildBlocks, parseWords } from "../../services/media-processor/src/ocrlayout.mjs";

type W = [text: string, left: number, top: number, width?: number];
const H = 30;

/** A Tesseract TSV with one level-5 row per word. */
const tsv = (words: W[]) =>
  ["level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"]
    .concat(words.map(([t, l, top, w], i) => `5\t1\t1\t1\t${1 + Math.floor(i / 50)}\t${i}\t${l}\t${top}\t${w ?? t.length * 15}\t${H}\t90\t${t}`))
    .join("\n");

const blocks = (words: W[]) => buildBlocks(parseWords(tsv(words)));

describe("reading a word table", () => {
  it("keeps boxes and the engine's own order, and skips unreadable rows", () => {
    const words = parseWords("h\n5\t1\t1\t1\t1\t1\t10\t20\t30\t40\t95\tab\n4\t1\t1\t1\t1\t0\t0\t0\t0\t0\t-1\t\n5\t1\t1\t1\t1\t2\t50\t20\t30\t40\t-1\tbad\n5\t1\t1\t1\t1\t3\t90\t20\t30\t40\t80\tcd");
    expect(words.map((w: { text: string }) => w.text)).toEqual(["ab", "cd"]);
    expect(words[1].index).toBe(1);
  });
});

describe("tables", () => {
  const grid: W[] = [
    ["Name", 100, 100], ["Qty", 500, 100], ["Price", 900, 100],
    ["Apple", 100, 150], ["3", 500, 150], ["1.20", 900, 150],
    ["Pear", 100, 200], ["12", 500, 200], ["0.80", 900, 200],
  ];

  it("turns aligned rows with wide gaps into a table", () => {
    const result = blocks(grid);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("table");
    expect(result[0].rows).toEqual([["Name", "Qty", "Price"], ["Apple", "3", "1.20"], ["Pear", "12", "0.80"]]);
  });

  it("puts a cell that is missing from a row back in its own column", () => {
    const result = blocks([...grid.slice(0, 6), ["Pear", 100, 200], ["0.80", 900, 200]]);
    expect(result[0].rows[2]).toEqual(["Pear", "", "0.80"]);
  });

  it("lays an Arabic table out right to left, first column on the right", () => {
    const result = blocks([
      ["الاسم", 900, 100], ["العدد", 500, 100], ["السعر", 100, 100],
      ["تفاح", 900, 150], ["3", 500, 150], ["1.20", 100, 150],
      ["كمثرى", 900, 200], ["12", 500, 200], ["0.80", 100, 200],
    ]);
    expect(result[0].type).toBe("table");
    expect(result[0].rtl).toBe(true);
    expect(result[0].rows[0]).toEqual(["الاسم", "العدد", "السعر"]);
    expect(result[0].rows[1]).toEqual(["تفاح", "3", "1.20"]);
  });

  it("does not make a table of two columns of prose", () => {
    // Two columns of ordinary prose, a wide gutter between them.
    const line = (text: string, start: number, top: number): W[] =>
      text.split(" ").map((word, i) => [word, start + i * 85, top, 70] as W);
    const rows: W[] = [];
    for (let r = 0; r < 4; r++) {
      rows.push(...line("this is a line of ordinary prose set", 100, 100 + r * 45));
      rows.push(...line("and this is a line of prose again", 1000, 100 + r * 45));
    }
    expect(blocks(rows).every((b: { type: string }) => b.type === "para")).toBe(true);
  });

  it("leaves a single line with a gap in it as a line of text", () => {
    expect(blocks([["left", 100, 100], ["right", 900, 100]]).map((b: { type: string }) => b.type)).toEqual(["para"]);
  });
});

describe("paragraphs", () => {
  it("joins lines and breaks on a larger gap", () => {
    const result = blocks([
      ["one", 100, 100], ["two", 200, 100], ["three", 100, 140], ["four", 100, 260], ["five", 200, 260],
    ]);
    expect(result.map((b: { text: string }) => b.text)).toEqual(["one two three", "four five"]);
  });

  it("keeps a Latin phrase inside an Arabic line in the engine's order", () => {
    // Tesseract lists the words of a right-to-left line in reading order: the
    // boxes run right to left while the sequence is logical.
    const result = blocks([["مرحبا", 521, 100, 75], ["Visionex", 257, 100, 120], ["selftest", 389, 100, 120], ["بكم", 200, 100, 45]]);
    expect(result[0].text).toBe("مرحبا Visionex selftest بكم");
    expect(result[0].rtl).toBe(true);
  });

  it("returns nothing for an empty page", () => {
    expect(buildBlocks([])).toEqual([]);
  });
});

describe("output", () => {
  const table = { type: "table", rtl: true, rows: [["الاسم", "السعر"], ["تفاح", "1.20"]] };

  it("writes a bordered, right-to-left HTML table that Word will open as one", () => {
    const html = blocksToHtml([table]);
    expect(html).toContain('<table dir="rtl" border="1"');
    expect(html).toContain('<td dir="rtl" style="text-align:right">الاسم</td>');
  });

  it("starts a later page on a new page", () => {
    expect(blocksToHtml([{ type: "para", text: "x", rtl: false }], { pageBreak: true })).toContain("page-break-before:always");
    expect(blocksToHtml([{ type: "para", text: "x", rtl: false }])).not.toContain("page-break");
  });

  it("escapes what a scan says", () => {
    expect(blocksToHtml([{ type: "para", text: "<b>&", rtl: false }])).toContain("&lt;b&gt;&amp;");
  });

  it("writes tables to text with tabs", () => {
    expect(blocksToText([{ type: "para", text: "hi", rtl: false }, table])).toBe("hi\n\nالاسم\tالسعر\nتفاح\t1.20");
  });
});
