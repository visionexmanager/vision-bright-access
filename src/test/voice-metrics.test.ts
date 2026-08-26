// The measuring instrument, measured.
//
// The baseline's numbers are only worth as much as the thing that computes
// them, and this is the only part of Phase 2 that can be verified without a
// provider key: hand-checkable references with known edit distances, plus the
// Arabic folding rules that decide whether a provider is being scored on what
// it heard or on which alef it typed.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const metrics = await import("../../scripts/voice/metrics.mjs");

describe("edit distance", () => {
  it("counts each operation separately", () => {
    // "a b c" → "a x c" is one substitution.
    expect(metrics.editDistance(["a", "b", "c"], ["a", "x", "c"]))
      .toEqual({ distance: 1, substitutions: 1, deletions: 0, insertions: 0 });
    // A missing word is a deletion; an extra one is an insertion.
    expect(metrics.editDistance(["a", "b", "c"], ["a", "c"]))
      .toEqual({ distance: 1, substitutions: 0, deletions: 1, insertions: 0 });
    expect(metrics.editDistance(["a", "c"], ["a", "b", "c"]))
      .toEqual({ distance: 1, substitutions: 0, deletions: 0, insertions: 1 });
  });

  it("is zero for identical sequences and total for a wholly wrong one", () => {
    expect(metrics.editDistance(["x"], ["x"]).distance).toBe(0);
    expect(metrics.editDistance(["a", "b"], ["c", "d"]).distance).toBe(2);
  });
});

describe("word error rate", () => {
  it("divides errors by the reference length, not the hypothesis", () => {
    // Four reference words, one substitution → 25%.
    const scored = metrics.wer("where is my order", "where is my parcel");
    expect(scored.rate).toBeCloseTo(0.25, 5);
    expect(scored.units).toBe(4);
  });

  it("counts an inserted word against a short reference", () => {
    // Two reference words, one insertion → 50%, which is the point: a provider
    // that hallucinates into a two-word voice note is badly wrong.
    expect(metrics.wer("thank you", "thank you very").rate).toBeCloseTo(0.5, 5);
  });

  it("treats an empty transcript as total loss, and empty-for-empty as perfect", () => {
    expect(metrics.wer("hello there", "").rate).toBe(1);
    expect(metrics.wer("", "").rate).toBe(0);
    expect(metrics.wer("", "unexpected").rate).toBe(1);
  });
});

describe("character error rate", () => {
  it("scores a single wrong letter far lower than a wrong word", () => {
    const word = metrics.wer("Beirut", "Beiruth").rate;
    const chars = metrics.cer("Beirut", "Beiruth").rate;
    expect(word).toBe(1);
    expect(chars).toBeLessThan(0.2);
  });
});

describe("Arabic normalisation", () => {
  it("folds the orthographic variants a keyboard produces", () => {
    // Alef variants, teh marbuta, alef maqsura, diacritics and tatweel.
    expect(metrics.normalizeText("أهلاً")).toBe(metrics.normalizeText("اهلا"));
    expect(metrics.normalizeText("مدرسة")).toBe(metrics.normalizeText("مدرسه"));
    expect(metrics.normalizeText("إلى")).toBe(metrics.normalizeText("الي"));
    expect(metrics.normalizeText("هٰذا")).toBe(metrics.normalizeText("هذا"));
    expect(metrics.normalizeText("مـــرحبا")).toBe(metrics.normalizeText("مرحبا"));
  });

  it("folds Arabic-Indic digits, so a number is scored on its value", () => {
    expect(metrics.normalizeText("رقم ٧٤٢٩")).toBe(metrics.normalizeText("رقم 7429"));
  });

  it("does not stem: a different word stays a different word", () => {
    expect(metrics.normalizeText("كتاب")).not.toBe(metrics.normalizeText("كتب"));
  });

  it("keeps raw mode honest about what was actually written", () => {
    // The same pair that normalises to zero error must not be zero raw — that
    // difference is exactly what the two modes exist to show.
    expect(metrics.wer("أهلاً وسهلاً", "اهلا وسهلا", "normalized").rate).toBe(0);
    expect(metrics.wer("أهلاً وسهلاً", "اهلا وسهلا", "raw").rate).toBeGreaterThan(0);
  });
});

describe("the scored shape the baseline records", () => {
  it("reports both rates in both modes", () => {
    const score = metrics.scoreTranscript("مرحباً", "مرحبا");
    expect(score.wer.normalized).toBe(0);
    expect(score.wer.raw).toBe(1);
    expect(score.cer.normalized).toBe(0);
    expect(score.cer.raw).toBeGreaterThan(0);
  });

  it("averages only the numbers it has", () => {
    expect(metrics.mean([0.1, 0.3])).toBeCloseTo(0.2, 5);
    expect(metrics.mean([])).toBeNull();
    expect(metrics.mean([undefined, null, 0.5])).toBe(0.5);
  });
});

describe("audio validity", () => {
  const head = (...bytes: number[]) => new Uint8Array([...bytes, 0, 0, 0, 0]);

  it("recognises the containers the providers return", () => {
    expect(metrics.audioLooksValid(head(0x4f, 0x67, 0x67, 0x53), "audio/ogg"))
      .toMatchObject({ valid: true, container: "ogg" });
    expect(metrics.audioLooksValid(head(0x49, 0x44, 0x33, 0x04), "audio/mpeg"))
      .toMatchObject({ valid: true, container: "mp3" });
    expect(metrics.audioLooksValid(head(0xff, 0xfb, 0x90, 0x00), "audio/mpeg"))
      .toMatchObject({ valid: true, container: "mp3" });
    expect(metrics.audioLooksValid(head(0x52, 0x49, 0x46, 0x46), "audio/wav"))
      .toMatchObject({ valid: true, container: "wav" });
  });

  it("catches the failure that would otherwise be recorded as success", () => {
    // An error page or a truncated body labelled as audio.
    expect(metrics.audioLooksValid(new Uint8Array(0), "audio/ogg")).toMatchObject({ valid: false });
    const html = new Uint8Array([..."<htm"].map((c) => c.charCodeAt(0)));
    expect(metrics.audioLooksValid(html, "audio/ogg")).toMatchObject({ valid: false });
  });
});

describe("the corpus", () => {
  const corpus = JSON.parse(readFileSync("scripts/voice/fixtures.json", "utf8")) as {
    fixtures: Array<{ id: string; language: string; dialect: string; text: string; requiresRealAudio?: boolean }>;
  };
  const doc = readFileSync("docs/voice-quality-baseline.md", "utf8");

  it("covers every product language, with both Arabic dialects", async () => {
    // Visionex is a global product: a language in the interface with no
    // fixture is a language nobody can ever answer "does voice work there?"
    // about.
    const { SUPPORTED_LANGUAGES } = await import(
      "../../supabase/functions/_shared/whatsappLanguages.ts"
    );
    const covered = new Set(corpus.fixtures.map((f) => f.language));
    for (const language of SUPPORTED_LANGUAGES) {
      expect(covered.has(language), `no fixture for ${language}`).toBe(true);
    }

    const dialects = new Set(corpus.fixtures.map((f) => f.dialect));
    expect(dialects).toContain("msa");
    expect(dialects).toContain("lebanese");

    // Still small enough that a person can read the whole corpus and re-record
    // it. Roughly three sentences per language is the ceiling this is holding.
    expect(corpus.fixtures.length).toBeLessThanOrEqual(SUPPORTED_LANGUAGES.length * 3);
  });

  it("gives every fixture a unique id and a reference transcript", () => {
    const ids = corpus.fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fixture of corpus.fixtures) {
      expect(fixture.text.trim().length, fixture.id).toBeGreaterThan(0);
    }
  });

  it("marks every Lebanese and noisy fixture as needing a real recording", () => {
    // Synthesised speech is Modern Standard Arabic with an accent. Scoring a
    // dialect fixture against it would produce a number that means nothing.
    for (const fixture of corpus.fixtures) {
      if (fixture.dialect === "lebanese" || fixture.id.includes("noisy")) {
        expect(fixture.requiresRealAudio, fixture.id).toBe(true);
      }
    }
  });

  it("stays in step with the document that publishes it", () => {
    // The baseline is only reproducible if the written corpus is the one the
    // runner reads. Every id has to appear in the document.
    for (const fixture of corpus.fixtures) {
      expect(doc, fixture.id).toContain(fixture.id);
    }
  });
});
