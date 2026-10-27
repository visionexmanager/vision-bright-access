import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessRecognition } from "../../services/media-processor/src/limits.mjs";

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

/** Build a Tesseract TSV from [word, confidence] pairs. */
function tsv(words: Array<[string, number]>): string {
  const rows = words.map(([text, conf], i) => `5\t1\t1\t1\t1\t${i + 1}\t0\t0\t10\t10\t${conf}\t${text}`);
  // Structural rows (levels 1-4) carry conf -1 and no text; they must be ignored.
  return [HEADER, "1\t1\t0\t0\t0\t0\t0\t0\t100\t100\t-1\t", ...rows].join("\n");
}

const clean = (n: number): Array<[string, number]> =>
  Array.from({ length: n }, (_, i) => [`كلمة${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${"abcdefghij"[Math.floor(i / 26)]}`, 88]);

describe("assessRecognition", () => {
  it("trusts a clean page of printed words", () => {
    const a = assessRecognition(tsv(clean(30)));
    expect(a.trusted).toBe(true);
    expect(a.reason).toBeNull();
    expect(a.words).toBe(30);
  });

  it("declines a page with no words, such as a cover photograph", () => {
    expect(assessRecognition(tsv([])).reason).toBe("no_words");
    expect(assessRecognition("").reason).toBe("no_words");
    expect(assessRecognition(undefined).trusted).toBe(false);
  });

  it("declines a page whose mean confidence is low", () => {
    const a = assessRecognition(tsv(Array.from({ length: 20 }, (_, i) => [`w${"abcdefghijklmnopqrstuvwxyz"[i]}`, 55])));
    expect(a.reason).toBe("low_confidence");
  });

  it("declines a page where a quarter of the words are doubtful", () => {
    const words: Array<[string, number]> = [...clean(15), ...Array.from({ length: 8 }, (_, i): [string, number] => [`x${"abcdefghijklmnopqrstuvwxyz"[i]}`, 30])];
    expect(assessRecognition(tsv(words)).reason).toBe("low_confidence");
  });

  it("declines when the digits are doubtful even though the words are fine", () => {
    // A handwritten form: printed labels read well, the filled-in numbers do not.
    const a = assessRecognition(tsv([...clean(30), ["1990", 52], ["07", 48], ["٣٣", 55]]));
    expect(a.reason).toBe("unsure_digits");
  });

  it("declines a page dense in figures, because lost amounts are not flagged by confidence", () => {
    // This is the failure the confidence number cannot see: every figure here
    // reads as confident, and the page is still routed to the vision model.
    const figures: Array<[string, number]> = Array.from({ length: 12 }, (_, i) => [`${1000 + i}`, 90]);
    const a = assessRecognition(tsv([...clean(40), ...figures]));
    expect(a.reason).toBe("numeric_table");
    expect(a.digitWords).toBe(12);
  });

  it("trusts a page with a few confident figures", () => {
    const a = assessRecognition(tsv([...clean(40), ["2021", 91], ["6", 90], ["2", 89]]));
    expect(a.trusted).toBe(true);
  });

  it("recognises Arabic-Indic digits as digits", () => {
    const figures: Array<[string, number]> = Array.from({ length: 10 }, (_, i) => [`٣٤${i}`, 90]);
    expect(assessRecognition(tsv([...clean(40), ...figures])).reason).toBe("numeric_table");
  });

  it("ignores structural rows and negative confidences", () => {
    const body = tsv(clean(5)) + "\n5\t1\t1\t1\t1\t9\t0\t0\t1\t1\t-1\tghost";
    expect(assessRecognition(body).words).toBe(5);
  });

  it("returns counts and a code, never the words", () => {
    const a = assessRecognition(tsv(clean(3)));
    expect(Object.keys(a).sort()).toEqual(["confidence", "digitWords", "embeddedLatin", "reason", "trusted", "words"]);
  });
});

describe("assessRecognition: a Latin guess inside an Arabic sentence", () => {
  // Words carry the block.par.line so the check can tell a line from a page.
  const line = (words: Array<[string, number]>, lineNo = 1) =>
    words.map(([text, conf], i) => `5\t1\t1\t1\t${lineNo}\t${i + 1}\t0\t0\t10\t10\t${conf}\t${text}`);
  const page = (rows: string[]) => [HEADER, ...rows].join("\n");
  const arabic = (n: number): Array<[string, number]> =>
    Array.from({ length: n }, (_, i) => [`كلمة${"ابتثجح"[i % 6]}`, 92]);

  it("flags an English word between Arabic words at middling confidence (the 2026-10-27 case)", () => {
    const words: Array<[string, number]> = [...arabic(5), ["Bae", 80], ...arabic(2)];
    const a = assessRecognition(page(line(words)));
    expect(a.embeddedLatin).toBe(1);
    expect(a.trusted).toBe(false);
    expect(a.reason).toBe("script_mixed");
  });

  it("leaves a bilingual sign alone: English on its own line", () => {
    const rows = [...line(arabic(4), 1), ...line([["EXIT", 80], ["GATE", 82]], 2)];
    const a = assessRecognition(page(rows));
    expect(a.embeddedLatin).toBe(0);
    expect(a.trusted).toBe(true);
  });

  it("leaves a confidently read brand inside an Arabic sentence alone", () => {
    const words: Array<[string, number]> = [...arabic(3), ["WiFi", 96], ...arabic(3)];
    expect(assessRecognition(page(line(words))).trusted).toBe(true);
  });

  it("does not flag a Latin word at the start or end of a line", () => {
    const words: Array<[string, number]> = [["Hotel", 75], ...arabic(4), ["Cafe", 75]];
    expect(assessRecognition(page(line(words))).embeddedLatin).toBe(0);
  });

  it("the service re-reads such a page with Arabic alone and keeps it only if trusted", () => {
    const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
    expect(server).toContain('assessment.reason === "script_mixed" && language === "ara+eng"');
    expect(server).toContain('runOcr(bytes, "ara", psm, oem)');
    expect(server).toContain("if (secondAssessment.trusted) {");
  });
});
