// Eval harness core: load a task, run its golden set against a provider,
// score every case.
//
// Kept separate from run.mjs so the tests import this and never the CLI entry
// point — a module with process.argv handling and a self-execution guard is
// awkward to load from a test runner, and a library that only computes is the
// easier thing to trust anyway.

import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { structuredCompletion } from "./providers.mjs";
import { scoreCase, summarize } from "./score.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const TASK_FILES = {
  "search-intent": "./tasks/search-intent.mjs",
  "book-classify": "./tasks/book-classify.mjs",
};

export const TASK_KEYS = Object.keys(TASK_FILES);

/** Load a golden set by key. Throws on an unknown key. */
export async function loadTask(key) {
  const path = TASK_FILES[key];
  if (!path) throw new Error(`Unknown task '${key}'. Known: ${TASK_KEYS.join(", ")}`);
  // Dynamic import needs a file:// URL, not a bare absolute path: on Windows
  // `C:\...` is read as a URL with scheme `c:` and rejected.
  const mod = await import(pathToFileURL(resolve(here, path)).href);
  return mod.task;
}

/**
 * Deterministic stand-in used by --mock and by the unit tests. Answers most
 * cases correctly, one with the wrong label, and one with a malformed shape —
 * so a mock run that reports a perfect score means the scoring has gone inert,
 * and a test asserts exactly that.
 */
export function mockOutput(caseIndex, task) {
  const testCase = task.cases[caseIndex];
  const output = {};

  for (const [key, spec] of Object.entries(task.schema.properties)) {
    if (spec.type === "array") output[key] = ["alpha", "beta"];
    else if (spec.enum) output[key] = testCase.expected[key] ?? spec.enum[0];
  }

  const gradedField = task.gradedFields[0];
  if (caseIndex === 1) {
    const enumValues = task.schema.properties[gradedField].enum;
    output[gradedField] = enumValues.find((v) => v !== output[gradedField]);
  }
  if (caseIndex === 2) output[Object.keys(task.schema.properties)[0]] = "not-an-array";

  return output;
}

async function runCase({ provider, task, testCase, index, mock, env }) {
  const started = Date.now();
  try {
    const { output, usage } = mock
      ? { output: mockOutput(index, task), usage: { promptTokens: 100, completionTokens: 20 } }
      : await structuredCompletion({
          provider,
          system: task.system,
          userText: testCase.input,
          schema: task.schema,
          toolName: task.toolName,
          maxTokens: task.maxTokens,
          env,
        });

    return {
      caseId: testCase.id,
      latencyMs: Date.now() - started,
      usage,
      score: scoreCase({
        output,
        expected: testCase.expected,
        schema: task.schema,
        gradedFields: task.gradedFields,
      }),
    };
  } catch (error) {
    return {
      caseId: testCase.id,
      latencyMs: Date.now() - started,
      error: String(error?.message ?? error),
      score: {
        schemaOk: false,
        schemaErrors: [],
        // A call that never returned still had questions to answer. Counting
        // them keeps a failed provider out of the denominator's blind spot:
        // otherwise 2 correct answers out of 12 attempts reads as 100%.
        graded: task.gradedFields.filter((f) => f in testCase.expected).length,
        correct: 0,
        allCorrect: false,
        fields: {},
      },
    };
  }
}

/** Run one task across providers. Returns per-provider results and summaries. */
export async function runTask({ task, providers, mock = false, repeat = 1, env = {} }) {
  const perProvider = {};

  for (const provider of providers) {
    const results = [];
    for (let round = 0; round < repeat; round += 1) {
      // Sequential on purpose: parallel calls distort latency measurements and
      // trip the per-minute limits that free tiers apply.
      for (const [index, testCase] of task.cases.entries()) {
        results.push(await runCase({ provider, task, testCase, index, mock, env }));
      }
    }
    perProvider[provider] = { results, summary: summarize(results) };
  }

  return perProvider;
}

/** Per-case detail for anything that errored, missed a label, or broke schema. */
export function collectMisses(perProvider) {
  return Object.fromEntries(
    Object.entries(perProvider).map(([provider, { results }]) => [
      provider,
      results
        .filter((r) => r.error || !r.score.allCorrect || !r.score.schemaOk)
        .map((r) => ({
          case: r.caseId,
          error: r.error ?? null,
          schemaErrors: r.score.schemaErrors,
          fields: r.score.fields,
        })),
    ]),
  );
}
