import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { percentile, scoreCase, summarize, toMarkdownTable, validateAgainstSchema } from "../../scripts/ai-eval/score.mjs";
import { OPENAI_COMPATIBLE, GEMINI_API_BASE, availableProviders } from "../../scripts/ai-eval/providers.mjs";
import { runTask } from "../../scripts/ai-eval/harness.mjs";
import { task as searchIntent } from "../../scripts/ai-eval/tasks/search-intent.mjs";
import { task as bookClassify } from "../../scripts/ai-eval/tasks/book-classify.mjs";

const root = resolve(import.meta.dirname, "../..");

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["a", "b"] },
    synonyms: { type: "array", maxItems: 2, items: { type: "string" } },
  },
  required: ["intent", "synonyms"],
};

describe("eval schema validation", () => {
  it("accepts a conforming object", () => {
    expect(validateAgainstSchema({ intent: "a", synonyms: ["x"] }, SCHEMA).ok).toBe(true);
  });

  it("rejects a missing required field", () => {
    const result = validateAgainstSchema({ intent: "a" }, SCHEMA);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("synonyms");
  });

  it("rejects a value outside the enum", () => {
    const result = validateAgainstSchema({ intent: "z", synonyms: [] }, SCHEMA);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("not one of");
  });

  it("rejects an oversized array and a wrong type", () => {
    expect(validateAgainstSchema({ intent: "a", synonyms: ["x", "y", "z"] }, SCHEMA).ok).toBe(false);
    expect(validateAgainstSchema({ intent: "a", synonyms: "x" }, SCHEMA).ok).toBe(false);
    expect(validateAgainstSchema("not an object", SCHEMA).ok).toBe(false);
  });
});

describe("eval case scoring", () => {
  const args = { schema: SCHEMA, gradedFields: ["intent"] };

  it("marks a correct graded field correct", () => {
    const score = scoreCase({ output: { intent: "a", synonyms: [] }, expected: { intent: "a" }, ...args });
    expect(score.allCorrect).toBe(true);
    expect(score.correct).toBe(1);
  });

  it("marks a wrong graded field incorrect while recording both values", () => {
    const score = scoreCase({ output: { intent: "b", synonyms: [] }, expected: { intent: "a" }, ...args });
    expect(score.allCorrect).toBe(false);
    expect(score.fields.intent).toEqual({ expected: "a", actual: "b", correct: false });
  });

  it("never credits a correct label inside a malformed object", () => {
    const score = scoreCase({ output: { intent: "a", synonyms: "oops" }, expected: { intent: "a" }, ...args });
    expect(score.schemaOk).toBe(false);
    expect(score.correct).toBe(0);
  });

  it("ignores free-text fields that carry no expectation", () => {
    const score = scoreCase({ output: { intent: "a", synonyms: ["anything"] }, expected: { intent: "a" }, ...args });
    expect(score.graded).toBe(1);
  });
});

describe("eval aggregation", () => {
  it("computes nearest-rank percentiles", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
    expect(percentile([], 50)).toBeNull();
  });

  it("excludes failed calls from latency, so failing fast never looks fast", () => {
    const summary = summarize([
      { latencyMs: 900, score: { schemaOk: true, graded: 1, correct: 1 }, usage: { promptTokens: 5, completionTokens: 2 } },
      { latencyMs: 1, error: "boom", score: { schemaOk: false, graded: 0, correct: 0 } },
    ]);
    expect(summary.errors).toBe(1);
    expect(summary.latencyP50).toBe(900);
    expect(summary.accuracy).toBe(1);
  });

  it("reports null tokens when no provider reported usage", () => {
    const summary = summarize([{ latencyMs: 5, score: { schemaOk: true, graded: 1, correct: 0 } }]);
    expect(summary.completionTokens).toBeNull();
    expect(summary.accuracy).toBe(0);
  });

  it("renders a markdown table", () => {
    const table = toMarkdownTable({ groq: summarize([{ latencyMs: 5, score: { schemaOk: true, graded: 1, correct: 1 } }]) });
    expect(table).toContain("| groq |");
    expect(table).toContain("100%");
  });
});

describe("eval harness end to end", () => {
  it("runs both golden sets offline without a key", async () => {
    const report = await runTask({ task: searchIntent, providers: ["groq"], mock: true, repeat: 1 });
    expect(report.groq.results).toHaveLength(searchIntent.cases.length);
    expect(report.groq.summary.errors).toBe(0);
  });

  it("cannot report a perfect score from the mock, which would mean the scoring is inert", async () => {
    for (const task of [searchIntent, bookClassify]) {
      const report = await runTask({ task, providers: ["openai"], mock: true, repeat: 1 });
      expect(report.openai.summary.accuracy).toBeLessThan(1);
      expect(report.openai.summary.schemaOkRate).toBeLessThan(1);
    }
  });
});

describe("golden sets", () => {
  it("grades only fields the schema actually declares", () => {
    for (const task of [searchIntent, bookClassify]) {
      for (const field of task.gradedFields) {
        expect(Object.keys(task.schema.properties)).toContain(field);
      }
    }
  });

  it("expects only values the enum allows", () => {
    for (const task of [searchIntent, bookClassify]) {
      for (const testCase of task.cases) {
        for (const [field, value] of Object.entries(testCase.expected)) {
          expect(task.schema.properties[field].enum).toContain(value);
        }
      }
    }
  });

  it("covers Arabic and English in every task", () => {
    // Code-point comparison rather than a regex: the Arabic block starts at
    // U+0600, a Unicode format character, and a raw one inside a regex literal
    // breaks Vite's parser with "Expected ident".
    const hasArabic = (text: string) =>
      [...text].some((ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp >= 0x0600 && cp <= 0x06ff;
      });

    for (const task of [searchIntent, bookClassify]) {
      expect(task.cases.some((c) => hasArabic(c.input))).toBe(true);
      expect(task.cases.some((c) => !hasArabic(c.input))).toBe(true);
    }
  });

  it("uses the same prompt and schema as the edge function it stands in for", () => {
    const search = readFileSync(resolve(root, "supabase/functions/library-ai-search/index.ts"), "utf8");
    const classify = readFileSync(resolve(root, "supabase/functions/library-ai-classify-book/index.ts"), "utf8");

    expect(search).toContain(searchIntent.system);
    expect(search).toContain(searchIntent.toolName);
    expect(classify).toContain(bookClassify.system);
    expect(classify).toContain(bookClassify.toolName);
  });
});

describe("harness/edge parity", () => {
  it("calls the same endpoints as the edge provider layer", () => {
    const edge = readFileSync(resolve(root, "supabase/functions/_shared/aiProvider.ts"), "utf8");
    const gemini = readFileSync(resolve(root, "supabase/functions/_shared/geminiProvider.ts"), "utf8");

    const endpoints: { url: string }[] = Object.values(OPENAI_COMPATIBLE);
    for (const { url } of endpoints) {
      expect(edge).toContain(url);
    }
    expect(gemini).toContain(GEMINI_API_BASE);
  });

  it("skips providers with no key rather than failing", () => {
    expect(availableProviders({ GROQ_API_KEY: "x" }, ["openai", "groq"])).toEqual(["groq"]);
    expect(availableProviders({}, ["openai"])).toEqual([]);
  });
});
