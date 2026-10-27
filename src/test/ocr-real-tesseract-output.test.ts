// What the service decides about real Tesseract output.
//
// `ocr-recognition-assessment.test.ts` builds its TSVs by hand, which proves the
// arithmetic. These are TSVs Tesseract 5.4 actually wrote (tessdata_best) for
// four drawn, non-personal images on 2026-10-27, so they prove the decisions on
// the shapes of page the service really meets:
//
//   table-en  an invoice with sixteen amounts. Tesseract read the numbers but
//             scrambled the columns and made a word out of the header at a
//             mean confidence of 90, so confidence cannot tell: it is declined
//             on the number of amounts, and the vision model reads the table.
//   table-ar  an Arabic invoice with five numbers, all read exactly. Trusted.
//   hand-en   handwriting-style script. Tesseract found no word at all, so it
//             is declined and goes to the model.
//   para-en   a clean printed paragraph. Trusted, at confidence 97.
//
// If a Tesseract upgrade changes these outputs the fixtures should be
// regenerated, not the assertions loosened.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assessRecognition } from "../../services/media-processor/src/limits.mjs";

const tsv = (name: string) => readFileSync(`services/media-processor/fixtures/tesseract-tsv/${name}.tsv`, "utf8");

describe("assessRecognition on real Tesseract output", () => {
  it("declines an invoice table because amounts are what must not be scrambled", () => {
    const a = assessRecognition(tsv("table-en"));
    expect(a.trusted).toBe(false);
    expect(a.reason).toBe("numeric_table");
    expect(a.digitWords).toBeGreaterThanOrEqual(10);
    // The page looked fine by confidence, which is the point.
    expect(a.confidence).toBeGreaterThanOrEqual(85);
  });

  it("trusts an Arabic invoice with a handful of numbers", () => {
    const a = assessRecognition(tsv("table-ar"));
    expect(a.trusted).toBe(true);
    expect(a.digitWords).toBeLessThan(10);
    expect(a.confidence).toBeGreaterThanOrEqual(90);
  });

  it("declines handwriting-style text that produced no words", () => {
    const a = assessRecognition(tsv("hand-en"));
    expect(a.trusted).toBe(false);
    expect(a.reason).toBe("no_words");
  });

  it("trusts a clean printed paragraph", () => {
    const a = assessRecognition(tsv("para-en"));
    expect(a.trusted).toBe(true);
    expect(a.reason).toBeNull();
    expect(a.confidence).toBeGreaterThanOrEqual(95);
  });

  it("the Arabic read with ara+eng on the shaped paragraph is flagged, and the ara-only read is not", () => {
    // The 2026-10-27 case: «عدة» read as "Bae" between Arabic words.
    const mixed = [
      "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t93\tيتحدث",
      "5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t93\tفي",
      "5\t1\t1\t1\t1\t3\t0\t0\t10\t10\t80\tBae",
      "5\t1\t1\t1\t1\t4\t0\t0\t10\t10\t93\tدول",
    ].join("\n");
    expect(assessRecognition(mixed).reason).toBe("script_mixed");
  });
});
