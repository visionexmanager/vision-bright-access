import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { enableArabicText, visualUnits } from "@/lib/pdf/arabicText";
import { drawnText, isGibberish, logical, type DrawnText } from "./helpers/pdfText";

// Arabic handed to jsPDF's built-in fonts came out as "þâþßþŽ…" in every PDF
// the site makes. These build real documents with the real font and read the
// drawn glyphs back out of the file.
//
// PDF_OUT=<dir> also writes each document there, to be looked at.

const FONT = "src/assets/fonts/NotoNaskhArabic-Regular.ttf";

beforeAll(() => {
  vi.stubGlobal("fetch", async () => new Response(readFileSync(FONT)));
});

async function build(name: string, draw: (doc: jsPDF) => void, ...content: unknown[]) {
  const doc = new jsPDF();
  doc.setCreationDate(new Date(0));
  doc.setFileId("00000000000000000000000000000000");
  await enableArabicText(doc, ...content);
  draw(doc);
  const pdf = doc.output();
  if (process.env.PDF_OUT) {
    mkdirSync(process.env.PDF_OUT, { recursive: true });
    writeFileSync(join(process.env.PDF_OUT, `${name}.pdf`), pdf, "binary");
  }
  const runs = drawnText(pdf);
  expect(runs.filter(isGibberish), `${name}: Arabic written in a built-in font`).toEqual([]);
  return { pdf, runs };
}

const leftToRight = (runs: DrawnText[]) => [...runs].sort((a, b) => a.x - b.x);

describe("every PDF generator", () => {
  it("goes through the shared Arabic layer before it draws", () => {
    const files = (readdirSync("src", { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("test") && !f.replace(/\\/g, "/").startsWith("lib/pdf/"))
      .map((f) => join("src", f))
      .filter((f) => /from "jspdf"|import\("jspdf"\)/.test(readFileSync(f, "utf8")));
    expect(files.length).toBe(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const created = source.indexOf("new jsPDF(");
      const enabled = source.indexOf("await enableArabicText(doc", created);
      expect(enabled, `${file} draws without enableArabicText`).toBeGreaterThan(created);
      // …straight after creating the document, before the first line is drawn.
      const firstDraw = source.slice(created).search(/doc\.(text|splitTextToSize)\(|textInBox\(/);
      expect(enabled - created, file).toBeLessThan(firstDraw);
    }
  });
});

describe("Arabic in PDFs", () => {
  it("leaves an English-only document exactly as it was", async () => {
    const english = (doc: jsPDF) => {
      doc.setFont("times", "bold");
      doc.text("Certificate of Completion — Visionex (2026)", 105, 30, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize("A long line of English that wraps at a narrow width, as a report does.", 60), 20, 50);
    };
    const plain = new jsPDF();
    plain.setCreationDate(new Date(0));
    plain.setFileId("00000000000000000000000000000000");
    english(plain);
    const { pdf } = await build("english-only", english, "Certificate of Completion");
    expect(pdf).toBe(plain.output());
    expect(pdf).not.toContain("FontFile2");
  });

  it("draws Arabic shaped and right to left, in the embedded font", async () => {
    const { runs } = await build("arabic-only", (doc) => doc.text("مرحبا بالعالم", 20, 20), "مرحبا");
    expect(runs).toHaveLength(1);
    expect(runs[0].embedded).toBe(true);
    expect(logical(runs[0])).toBe("مرحبا بالعالم");
    // Joined letter forms, not isolated ones: meem initial, alef final…
    const glyphs = [...runs[0].text].reverse();
    expect(glyphs[0]).toBe("ﻣ"); // م initial
    expect(glyphs[4]).toBe("ﺎ"); // ا final
    // …and the lam-alef of «بالعالم» as the ligature, once, where it belongs.
    expect(runs[0].text.match(/ﻻ|ﻼ/g)).toBeNull();
    expect(logical(runs[0])).toContain("بالعالم");
  });

  it("keeps lam-alef ligatures right and invents none", async () => {
    const { runs } = await build("lam-alef", (doc) => doc.text("لا إله الا السلامة العالم", 20, 20), "لا");
    expect(logical(runs[0])).toBe("لا إله الا السلامة العالم");
    expect(runs[0].text.match(/[ﻵ-ﻼ]/g)?.length).toBe(3); // لا, لإ-free, الا, سلا
  });

  it("keeps an English word in an Arabic line in its own font, in bidi order", async () => {
    const { runs } = await build("arabic-english", (doc) => doc.text("مرحبا بك في Visionex اليوم", 20, 20), "مرحبا");
    const order = leftToRight(runs.filter((r) => r.text.trim()));
    expect(order.map((r) => (r.embedded ? logical(r) : r.text.trim()))).toEqual(["اليوم", "Visionex", "مرحبا بك في"]);
    expect(order[1].embedded).toBe(false);
  });

  it("puts Arabic on the right of an English-first line", async () => {
    const { runs } = await build("english-arabic", (doc) => doc.text("Visionex: مرحبا بالعالم", 20, 20), "مرحبا");
    const order = leftToRight(runs.filter((r) => r.text.trim()));
    expect(order.map((r) => (r.embedded ? logical(r) : r.text))).toEqual(["Visionex: ", "مرحبا بالعالم"]);
  });

  it("keeps numbers left to right inside Arabic", async () => {
    // «123» sits between Arabic words, so it is part of the shaped segment;
    // «4567» ends the line and is a number of its own.
    const units = visualUnits("العدد 123 من 4567").units.map((u) => u.text).filter((t) => t.trim());
    expect(units).toEqual(["4567", "العدد 123 من"]);
    const { runs } = await build("arabic-numbers", (doc) => doc.text("العدد 123 من 4567", 20, 20), "العدد");
    const order = leftToRight(runs.filter((r) => r.text.trim()));
    expect(order).toHaveLength(2);
    expect(order[0].embedded).toBe(false);
    expect(order[0].text.trim()).toBe("4567");
    // Drawn left to right: «من», 123, «العدد» — the digits unreversed.
    expect(order[1].text.normalize("NFKC")).toBe("نم 123 ددعلا");
  });

  it("keeps a percentage whole and on the correct side", async () => {
    const units = visualUnits("نسبة 50% من الطلاب").units.map((u) => u.text).filter((t) => t.trim());
    expect(units).toEqual(["من الطلاب", "50%", "نسبة"]);
    const { runs } = await build("arabic-percent", (doc) => doc.text("نسبة 50% من الطلاب", 20, 20), "نسبة");
    const order = leftToRight(runs.filter((r) => r.text.trim()));
    expect(order.map((r) => (r.embedded ? logical(r) : r.text.trim()))).toEqual(["من الطلاب", "50%", "نسبة"]);
  });

  it("handles Arabic and ASCII punctuation, mirroring brackets", async () => {
    expect(visualUnits("مرحبا، كيف حالك؟").units.map((u) => u.text)).toEqual(["؟", "كيف حالك", " ", "،", "مرحبا"]);
    expect(visualUnits("(مرحبا)").units.map((u) => u.text)).toEqual(["(", "مرحبا", ")"]);
    expect(visualUnits("مرحبا!").units.map((u) => u.text)).toEqual(["!", "مرحبا"]);
    expect(visualUnits("ما هذا?").units.map((u) => u.text)).toEqual(["?", "ما هذا"]);
    const { runs } = await build("arabic-punctuation", (doc) => {
      doc.text("مرحبا، كيف حالك؟", 20, 20);
      doc.text("(مرحبا) - أهلاً!", 20, 30);
    }, "مرحبا");
    const firstY = Math.max(...runs.map((r) => r.y));
    const first = leftToRight(runs.filter((r) => r.y === firstY));
    // Everything on the first line is Arabic, so all of it is in the embedded font.
    expect(first.filter((r) => r.text.trim()).every((r) => r.embedded)).toBe(true);
    expect(first[0].text).toBe("؟");
    expect(first.filter((r) => !r.embedded).map((r) => r.text)).toEqual([" "]);
    expect(first.map((r) => (r.embedded ? logical(r) : r.text)).reverse().join("")).toBe("مرحبا، كيف حالك؟");
    // (مرحبا) - أهلاً!  reads right to left: «!» leftmost, the mirrored «)» rightmost.
    const second = leftToRight(runs.filter((r) => r.y !== firstY));
    expect(second[0].text).toBe("!");
    expect(second.at(-1)).toMatchObject({ embedded: false, text: ")" });
    expect(second.map((r) => (r.embedded ? logical(r) : r.text)).join("|")).toBe("!|أهلاً| - (|مرحبا|)");
  });

  it("gives a letter before Arabic punctuation its final form, not a joining one", async () => {
    // jsPDF's shaper counts ؟ and ، as letters that join, so the «ك» of
    // «حالك؟» came out as an initial form. Kaf final is U+FEDA.
    const kafFinal = String.fromCharCode(0xfeda);
    const kafJoining = new RegExp(`[${String.fromCharCode(0xfedb)}${String.fromCharCode(0xfedc)}]`);
    const { runs } = await build("punctuation-forms", (doc) => {
      doc.text("كيف حالك؟", 20, 20);
      doc.text("سمك، وملح؛ ملك٪", 20, 30);
    }, "كيف");
    const shaped = runs.filter((r) => r.embedded && r.text.length > 1);
    const endsInKaf = shaped.filter((r) => logical(r).endsWith("ك"));
    expect(endsInKaf.length).toBe(3); // حالك، سمك، ملك
    for (const run of endsInKaf) {
      expect(run.text[0], logical(run)).toBe(kafFinal);
      expect(run.text[0]).not.toMatch(kafJoining);
    }
  });

  it("aligns centred Arabic on its centre and right-aligned Arabic on its right edge", async () => {
    const { runs } = await build("alignment", (doc) => {
      doc.text("شهادة إتمام", 105, 20, { align: "center" });
      doc.text("تقرير الجدوى", 190, 40, { align: "right" });
    }, "شهادة");
    const [centred, right] = runs;
    const doc = new jsPDF();
    await enableArabicText(doc, "x");
    expect(centred.x).toBeLessThan(105 * doc.internal.scaleFactor);
    expect(right.x).toBeLessThan(190 * doc.internal.scaleFactor);
  });

  it("wraps a long Arabic paragraph and sets each line flush right", async () => {
    const paragraph = "هذه فقرة طويلة باللغة العربية تشرح خطة غذائية متوازنة تحتوي على الخضار والفواكه والبروتين وتلتزم بعدد السعرات المطلوب يوميا";
    const { runs } = await build("wrapped", (doc) => {
      const lines = doc.splitTextToSize(paragraph, 80) as string[];
      expect(lines.length).toBeGreaterThan(1);
      doc.text(lines, 20, 20, { maxWidth: 80 });
    }, paragraph);
    // Re-splitting already split lines (text() with maxWidth) used to leave a
    // second direction marker, drawn in Helvetica as a stray character.
    expect(runs.every((r) => r.embedded), "a character outside the Arabic font was drawn").toBe(true);
    const lines = new Map<number, DrawnText[]>();
    for (const r of runs) lines.set(r.y, [...(lines.get(r.y) ?? []), r]);
    expect(lines.size).toBeGreaterThan(1);
    expect([...lines.values()].map((l) => l.map(logical).join(" ")).join(" ")).toBe(paragraph);
    // Flush right: every line ends at the same right edge.
    const doc = new jsPDF();
    await enableArabicText(doc, paragraph);
    const rightEdges = [...lines.values()].map(([run]) => {
      doc.setFont("NotoNaskhArabic", "normal");
      return Math.round(run.x + doc.getTextWidth(logical(run)) * doc.internal.scaleFactor);
    });
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1);
  });

  it("keeps a line's direction and single marker when it is split twice", async () => {
    const doc = new jsPDF();
    await enableArabicText(doc, "م");
    const once = doc.splitTextToSize("خطة غذائية متوازنة تحتوي على الخضار والفواكه", 40) as string[];
    const twice = doc.splitTextToSize(once.join(String.fromCharCode(10)), 40) as string[];
    expect(twice).toEqual(once);
    const rlm = String.fromCharCode(0x200f);
    for (const line of twice) expect(line.startsWith(rlm) && !line.startsWith(rlm + rlm)).toBe(true);
  });

  it("draws an Arabic-locale date the way the browser shows it, marks unseen", async () => {
    // What toLocaleDateString gives an Arabic browser: Arabic-Indic digits,
    // an RLM after each part, and a "/" the Arabic font does not have.
    const date = new Date(Date.UTC(2026, 8, 27)).toLocaleDateString("ar-EG", { timeZone: "UTC" });
    const rlm = String.fromCharCode(0x200f);
    expect(date).toContain(rlm);
    const line = `Issued ${date} by مكتبة فيجنكس`;
    const { runs } = await build("arabic-date", (doc) => doc.text(line, 20, 20), line);
    // No mark reached the page, in either font.
    expect(runs.some((r) => r.text.includes(rlm))).toBe(false);
    // Left to right: Issued, 2026, /, 9, /, 27 (read right to left as ٢٧/٩/٢٠٢٦), by, the name.
    // Digit runs are drawn as they read, left to right; only shaped words are reversed.
    const order = leftToRight(runs).map((r) => (r.embedded && !/^\p{Nd}+$/u.test(r.text) ? logical(r) : r.text)).join("");
    const digits = (n: number) => [...String(n)].map((d) => String.fromCharCode(0x0660 + Number(d))).join("");
    expect(order.replace(/\s+/g, " ")).toBe(`Issued ${digits(2026)}/${digits(9)}/${digits(27)} by مكتبة فيجنكس`);
    // The slashes are Helvetica's; the digits are Noto's.
    expect(runs.filter((r) => r.text === "/").every((r) => !r.embedded)).toBe(true);
  });

  it("keeps an Arabic-Indic number with a separator in one left-to-right unit", () => {
    const d = (s: string) => [...s].map((c) => (/[0-9]/.test(c) ? String.fromCharCode(0x0660 + Number(c)) : c)).join("");
    expect(visualUnits(`التاريخ ${d("27/9/2026")}`).units.map((u) => u.text).filter((t) => t.trim())).toEqual([d("27/9/2026"), "التاريخ"]);
  });

  it("keeps a Persian ZWNJ inside the word, where it breaks the join", async () => {
    const zwnj = String.fromCharCode(0x200c);
    const word = `می${zwnj}خواهم`;
    expect(visualUnits(word).units).toHaveLength(1);
    const { runs } = await build("persian-zwnj", (doc) => doc.text(word, 20, 20), word);
    expect(runs.filter((r) => r.text.trim())).toHaveLength(1);
    expect(runs[0].embedded).toBe(true);
  });

  it("draws Persian letters joined", async () => {
    const { runs } = await build("persian", (doc) => doc.text("گزارش پیشرفت", 20, 20), "گزارش");
    expect(logical(runs[0])).toBe("گزارش پیشرفت");
    expect(runs[0].text).toMatch(/[ﮒ-ﮕ]/); // گ in a joined form
  });
});
