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
    expect(Object.keys(a).sort()).toEqual(["confidence", "digitWords", "reason", "trusted", "words"]);
  });
});
