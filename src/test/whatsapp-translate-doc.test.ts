// Translating a file, which is not translating a sentence.
//
// The assistant has translated for a while — a photograph of a sign, or text
// pasted into the message. Both are short, both arrive whole, both are one
// prompt and one answer.
//
// A document is neither, and the three things that only appear at length are
// what these cover: splitting text without cutting a sentence in half, what
// happens when the fourth chunk of nine fails, and putting a subtitle file back
// together with its timings untouched.
//
// Nobody can proof-read the result. The sender asked precisely because they
// cannot read the original, so a translation with a silent hole in it is worse
// than a refusal — that judgement is what most of this file is about.

import { describe, expect, it, vi } from "vitest";

import {
  CHUNK_CHARS,
  chunkForTranslation,
  classifyForTranslation,
  MAX_DOCUMENT_CHARS,
  MAX_FAILED_CHUNK_RATIO,
  translateDocument,
} from "../../supabase/functions/_shared/whatsappTranslateDoc.ts";
import { parseSubtitles } from "../../supabase/functions/_shared/whatsappSubtitles.ts";

const SRT = [
  "1",
  "00:00:01,000 --> 00:00:04,000",
  "The meeting starts at nine.",
  "",
  "2",
  "00:00:05,500 --> 00:00:09,250",
  "Bring the documents.",
  "",
].join("\n");

const upper = async (text: string) => text.toUpperCase();

// ── 1. Splitting ─────────────────────────────────────────────────────────────

describe("splitting a document for translation", () => {
  it("leaves anything short alone", () => {
    expect(chunkForTranslation("One short line.")).toEqual(["One short line."]);
    expect(chunkForTranslation("   ")).toEqual([]);
  });

  it("keeps every chunk under the limit", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Paragraph number ${i}. `.repeat(6)).join("\n\n");
    const chunks = chunkForTranslation(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_CHARS);
  });

  it("loses no words", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence ${i} is here.`).join(" ");
    const rejoined = chunkForTranslation(long).join(" ").replace(/\s+/g, " ");
    expect(rejoined).toBe(long.replace(/\s+/g, " "));
  });

  it("breaks on paragraphs before sentences", () => {
    // A paragraph break is a real boundary, and the reassembled text keeps it.
    const text = `${"a".repeat(1_000)}\n\n${"b".repeat(1_000)}`;
    const chunks = chunkForTranslation(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("a".repeat(1_000));
  });

  it("ends sentences in every script, not only with a full stop", () => {
    // The character that ends an English sentence is not the one that ends an
    // Arabic, Chinese, Japanese or Devanagari one. Splitting on `.` alone
    // leaves all of those as one chunk the size of the document.
    for (const [name, ender] of [
      ["Chinese", "。"], ["Japanese", "！"], ["Devanagari", "।"],
      ["Arabic question", "؟"], ["Urdu", "۔"],
    ] as const) {
      // Four sentences of 700 characters. Split correctly, two fit in a chunk
      // and every chunk ends on a sentence. Split on `.` alone, the whole thing
      // is one sentence too long for the budget and gets hard-cut at 1800 —
      // which also produces more than one chunk, so counting them proves
      // nothing. Where the cut *lands* is the difference.
      const sentence = `${"x".repeat(700)}${ender} `;
      const chunks = chunkForTranslation(sentence.repeat(4));
      expect(chunks.length, name).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length, name).toBeLessThanOrEqual(CHUNK_CHARS);
        expect(chunk.endsWith(ender), `${name}: chunk cut mid-sentence`).toBe(true);
      }
    }
  });

  it("cuts a single sentence longer than the whole budget", () => {
    // The alternative is not translating it at all.
    const monster = "z".repeat(CHUNK_CHARS * 3);
    const chunks = chunkForTranslation(monster);
    expect(chunks.length).toBe(3);
    expect(chunks.join("")).toBe(monster);
  });

  it("chunks small enough that a model will not truncate the answer", () => {
    // The limit that bites is not the input. A model asked to return three
    // thousand words returns two thousand and stops, and the missing thousand
    // is invisible to somebody who cannot read either version.
    expect(CHUNK_CHARS).toBeLessThanOrEqual(2_500);
  });
});

// ── 2. Knowing what kind of file it is ───────────────────────────────────────

describe("what a file turns out to be", () => {
  it("recognises subtitles from the content, not the filename", () => {
    // A `.txt` holding an SRT is common — people rename them to get past upload
    // filters — and translating one as prose destroys its timings.
    expect(classifyForTranslation(SRT).kind).toBe("subtitles");
    expect(classifyForTranslation("Just an ordinary paragraph of prose.").kind).toBe("text");
  });
});

// ── 3. Subtitles keep their timings ──────────────────────────────────────────

describe("translating a subtitle file", () => {
  it("returns a subtitle file, with every timing where it was", async () => {
    const result = await translateDocument({ source: SRT, translate: upper });
    expect(result.ok).toBe(true);
    expect(result.format).toBe("srt");
    expect(result.output).toContain("00:00:01,000 --> 00:00:04,000");
    expect(result.output).toContain("00:00:05,500 --> 00:00:09,250");
    expect(result.output).toContain("THE MEETING STARTS AT NINE.");
    // And it is still a file a player will load.
    expect(parseSubtitles(result.output ?? "").cues).toHaveLength(2);
  });

  it("hands the translator dialogue and never a timestamp", async () => {
    const seen: string[] = [];
    await translateDocument({
      source: SRT,
      translate: async (text) => { seen.push(text); return text; },
    });
    expect(seen).toEqual(["The meeting starts at nine.", "Bring the documents."]);
    for (const text of seen) expect(text).not.toMatch(/-->|\d{2}:\d{2}:\d{2}/);
  });

  it("says what language it was in", async () => {
    const result = await translateDocument({ source: SRT, translate: upper });
    expect(result.detected?.language).toBe("en");
  });

  it("keeps a line whose translation failed, rather than dropping it", async () => {
    // Ten cues, one failure — under the ratio, so the file still comes back.
    // A subtitle that vanishes is worse than one left in the original: the
    // viewer loses the line and has no way to know it was ever there.
    const at = (seconds: number) => `00:00:${String(seconds).padStart(2, "0")},000`;
    const long = Array.from({ length: 10 }, (_, i) =>
      `${i + 1}\n${at(i)} --> ${at(i + 1)}\nLine number ${i}.\n`).join("\n");

    let call = 0;
    const result = await translateDocument({
      source: long,
      translate: async (text) => (++call === 4 ? null : text.toUpperCase()),
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("Line number 3.");     // the one that failed
    expect(result.output).toContain("LINE NUMBER 4.");     // its neighbour
    expect(parseSubtitles(result.output ?? "").cues).toHaveLength(10);
  });

  it("refuses a subtitle file when too much of it came back empty", async () => {
    const result = await translateDocument({ source: SRT, translate: async () => null });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("translation_failed");
  });
});

// ── 4. Prose, and what happens when part of it fails ─────────────────────────

describe("translating prose", () => {
  it("puts the pieces back with their paragraph breaks", async () => {
    const source = `${"a".repeat(1_000)}\n\n${"b".repeat(1_000)}`;
    const result = await translateDocument({ source, translate: upper });
    expect(result.ok).toBe(true);
    expect(result.output).toBe(`${"A".repeat(1_000)}\n\n${"B".repeat(1_000)}`);
  });

  it("leaves a failed chunk in its original language rather than as a gap", async () => {
    // A missing paragraph is invisible. A paragraph in the language it started
    // in is at least visibly untranslated.
    const source = Array.from({ length: 10 }, (_, i) => `${`Paragraph ${i}. `.repeat(60)}`).join("\n\n");
    let call = 0;
    const result = await translateDocument({
      source,
      translate: async (text) => (++call === 2 ? null : text.toUpperCase()),
    });
    expect(result.ok).toBe(true);
    expect(result.incomplete).toBeGreaterThan(0);
    // The untranslated piece is present, in lower case, rather than absent.
    expect(result.output).toMatch(/Paragraph \d+\./);
  });

  it("refuses rather than returning a document full of holes", async () => {
    // Past a fifth, the answer is a failure. A reader who cannot check the
    // original has no way to notice the holes.
    const source = Array.from({ length: 10 }, (_, i) => `${`Paragraph ${i}. `.repeat(60)}`).join("\n\n");
    const result = await translateDocument({ source, translate: async () => null });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("translation_failed");
  });

  it("survives a few failures, which is the point of having a ratio at all", async () => {
    const source = Array.from({ length: 20 }, (_, i) => `${`Paragraph ${i}. `.repeat(60)}`).join("\n\n");
    let call = 0;
    const result = await translateDocument({
      source,
      translate: async (text) => (++call === 3 ? null : text.toUpperCase()),
    });
    expect(result.ok).toBe(true);
    expect(result.incomplete).toBeLessThanOrEqual(MAX_FAILED_CHUNK_RATIO);
  });
});

// ── 5. The refusals ──────────────────────────────────────────────────────────

describe("what it will not attempt", () => {
  it("refuses an empty document", async () => {
    const result = await translateDocument({ source: "   ", translate: upper });
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a book, and says so rather than truncating", async () => {
    // A cap with no message is a silent truncation, which is the failure this
    // whole module is written against.
    const translate = vi.fn(upper);
    const result = await translateDocument({
      source: "x".repeat(MAX_DOCUMENT_CHARS + 1),
      translate,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_long");
    // And it did not spend a single call finding that out.
    expect(translate).not.toHaveBeenCalled();
  });

  it("has a ceiling somebody would actually hit before a bill does", () => {
    expect(MAX_DOCUMENT_CHARS).toBeGreaterThan(10_000);
    expect(MAX_DOCUMENT_CHARS).toBeLessThanOrEqual(200_000);
  });
});
