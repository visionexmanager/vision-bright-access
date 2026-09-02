import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describeIvxCase,
  executeIvxCases,
  IVX_REMOVED_GLOBALS,
  type IvxCodeCase,
  type IvxCodeRun,
} from "@/features/ivx/runCode";

const code = readFileSync("supabase/migrations/20261006040000_ivx_code.sql", "utf8");
const runner = readFileSync("src/features/ivx/runCode.ts", "utf8");
const panel = readFileSync("src/features/ivx/IVXCodeAnswer.tsx", "utf8");
const practice = readFileSync("src/pages/academy/IVXPractice.tsx", "utf8");
const clientApi = readFileSync("src/features/ivx/api.ts", "utf8");

const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

function region(source: string, from: string, to?: string): string {
  const start = source.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  if (!to) return rest;
  const end = rest.indexOf(to);
  expect(end, `end marker not found: ${to}`).toBeGreaterThan(-1);
  const cut = rest.slice(0, end);
  expect(cut.length, `region ${from} → ${to} is empty`).toBeGreaterThan(20);
  return cut;
}

// ── The executor, actually executed ─────────────────────────────────────────
//
// `executeIvxCases` is stringified into the Worker, so this is the same code
// the student's browser runs — not a description of it. jsdom has no Worker,
// which is exactly why the executor was pulled out of the worker string.

describe("running a student's code", () => {
  it("runs the entry function over every case, in order", () => {
    const run = executeIvxCases("function solve(a, b) { return a + b; }", "solve", [[1, 2], [10, 5], [0, 0]]);
    expect(run.fatal).toBeNull();
    expect(run.outputs).toEqual([3, 15, 0]);
    expect(run.errors).toEqual([null, null, null]);
  });

  it("says when the entry function is simply not there", () => {
    const run = executeIvxCases("function add(a, b) { return a + b; }", "solve", [[1, 2]]);
    expect(run.fatal).toBe("missing-entry");
    // Not an exception, and not a silent zero — the student named it wrongly
    // and that is a fixable, specific thing to be told.
    expect(run.outputs).toEqual([null]);
  });

  it("reports a syntax error instead of throwing", () => {
    const run = executeIvxCases("function solve( {", "solve", [[1]]);
    expect(run.fatal).toBeTruthy();
    expect(run.fatal).not.toBe("missing-entry");
  });

  it("keeps a case that throws from losing the cases around it", () => {
    const run = executeIvxCases(
      "function solve(x) { if (x === 2) throw new Error('boom'); return x; }",
      "solve",
      [[1], [2], [3]],
    );
    expect(run.outputs).toEqual([1, null, 3]);
    expect(run.errors[0]).toBeNull();
    expect(run.errors[1]).toContain("boom");
    expect(run.errors[2]).toBeNull();
  });

  it("turns undefined into null so a missing return is a value, not a gap", () => {
    const run = executeIvxCases("function solve() { }", "solve", [[]]);
    expect(run.outputs).toEqual([null]);
    expect(run.errors[0]).toBeNull();
  });

  it("refuses to report something that is not really an answer", () => {
    // A function or a circular object cannot be compared to an expected
    // output. Catching it here makes it an error the student can read.
    const circular = executeIvxCases(
      "function solve() { var a = {}; a.self = a; return a; }",
      "solve",
      [[]],
    );
    expect(circular.errors[0]).toBeTruthy();
    expect(circular.outputs[0]).toBeNull();

    const returnsFunction = executeIvxCases("function solve() { return function () {}; }", "solve", [[]]);
    expect(returnsFunction.outputs[0]).toBeNull();
  });

  it("handles arrays and strings, not only numbers", () => {
    const run = executeIvxCases(
      "function solve(word) { return word.split('').reverse().join(''); }",
      "solve",
      [["cat"], [""], ["Level"]],
    );
    expect(run.outputs).toEqual(["tac", "", "leveL"]);
  });
});

describe("the sandbox", () => {
  it("is a Worker, terminated on a timeout rather than waited out", () => {
    expect(runner).toContain("new Worker(url)");
    expect(runner).toContain("worker.terminate()");
    expect(runner).toContain("IVX_CODE_TIMEOUT_MS");
  });

  it("removes the network globals before the code is compiled, not after", () => {
    // Taking fetch away from code that already captured it achieves nothing.
    const workerSource = region(runner, "const WORKER_SOURCE = `", "`;");
    const removals = workerSource.indexOf("delete self.");
    const compile = workerSource.indexOf("executeIvxCases(payload.source");
    expect(removals).toBeGreaterThan(-1);
    expect(removals).toBeLessThan(compile);
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "importScripts"]) {
      expect(IVX_REMOVED_GLOBALS as readonly string[]).toContain(name);
    }
  });

  it("does not duplicate the executor into the worker string", () => {
    // Two copies of "run the student's code" would drift, and only one of them
    // would be the one under test.
    expect(runner).toContain("${executeIvxCases.toString()}");
  });
});

// ── What the sandbox is NOT trusted with ────────────────────────────────────

describe("the browser runs the code; the database decides", () => {
  it("never sends the client an expected output it has not earned", () => {
    const task = region(code, "FUNCTION public.ivx_code_task", "$$;");
    // Inputs for every case; `out` only where ordinality is inside `shown`.
    expect(task).toMatch(/WHEN ord <= _shown[\s\S]{0,200}'out', c -> 'out'/);
    expect(task).toContain("'example', false");
  });

  it("refuses to hand over the inputs of a question that is not open", () => {
    const task = region(code, "FUNCTION public.ivx_code_task", "$$;");
    expect(task).toContain("'not_the_open_question'");
    expect(task).toContain("open_question = _question_id");
  });

  it("sends outputs rather than a verdict", () => {
    const submit = region(clientApi, "submitCode: (options", "}),");
    expect(submit).toContain("_outputs: options.outputs");
    expect(submit).not.toMatch(/correct|passed|score/);
    // And the component that ran the code has no opinion to send.
    expect(panel).not.toMatch(/setCorrect|isCorrect|passed\s*=/);
  });

  it("compares the outputs in SQL, against cases that never left the database", () => {
    const matcher = region(code, "FUNCTION public.ivx_answer_matches", "$$;");
    expect(matcher).toContain("IF _answer ? 'cases' THEN");
    // Length must match, so a short array cannot pass by accident.
    expect(matcher).toContain("jsonb_array_length(_produced) <> jsonb_array_length(_cases)");
    // Prose in a code question is not a pass.
    expect(matcher).toContain("RETURN false");
  });

  it("adds a branch to the existing matcher rather than a second grading path", () => {
    // A code question is still "an answer that matches or does not", so
    // mastery, XP and the WhatsApp door keep working unchanged.
    const submit = region(code, "FUNCTION public.ivx_code_submit", "$$;");
    expect(submit).toContain("public.ivx_submit_answer(");
    expect(stripComments(code)).not.toContain("ivx_apply_attempt");
    expect(stripComments(code)).not.toContain("award_academy_xp");
  });

  it("records the source only when the submission was actually graded", () => {
    const submit = region(code, "FUNCTION public.ivx_code_submit", "$$;");
    const guard = submit.indexOf("IF (_result ->> 'ok')::boolean THEN");
    const insert = submit.indexOf("INSERT INTO public.ivx_code_runs");
    expect(guard).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(guard);
  });

  it("gives the saved runs a read-only policy", () => {
    expect(code).toMatch(/POLICY "ivx_code_runs_own"[^;]*FOR SELECT/);
    expect(code).not.toMatch(/ON public\.ivx_code_runs FOR (INSERT|UPDATE|ALL)/);
  });
});

// ── The seeded questions ────────────────────────────────────────────────────

describe("the code questions", () => {
  it("are JavaScript, and are not filed under the Python skill", () => {
    // The runner is a Web Worker. Putting a JavaScript exercise under
    // prog.python-basics would teach one language while claiming another.
    const inserts = region(code, "INSERT INTO public.ivx_questions", "ON CONFLICT");
    expect(inserts).toContain("'prog.thinking'");
    expect(inserts).not.toContain("prog.python-basics");
  });

  it("describe the signature in words, not only as a code block", () => {
    const inserts = region(code, "INSERT INTO public.ivx_questions", "ON CONFLICT");
    const accessible = [...inserts.matchAll(/'\{"en":"The function is named[^']*'/g)];
    expect(accessible.length).toBe(4);
    for (const [text] of accessible) {
      expect(text).toContain('"ar"');
      expect(text).toMatch(/receives/);
    }
  });

  it("keep one worked example and hide the rest", () => {
    const shown = [...code.matchAll(/"shown":(\d+)/g)].map((m) => Number(m[1]));
    expect(shown.length).toBe(4);
    for (const value of shown) expect(value).toBe(1);
    // Five cases each, so guessing the four hidden outputs is solving it.
    const caseCounts = [...code.matchAll(/"cases":\[(.*?)\]}'/gs)]
      .map((m) => m[1].split('{"in"').length - 1);
    for (const count of caseCounts) expect(count).toBeGreaterThanOrEqual(5);
  });

  it("give every question a starting point and both languages", () => {
    const starters = [...code.matchAll(/"starter":"function solve/g)];
    expect(starters.length).toBe(4);
    const prompts = [...region(code, "INSERT INTO public.ivx_questions", "ON CONFLICT")
      .matchAll(/'\{"en":"Write a function[^']*'/g)];
    expect(prompts.length).toBe(4);
    for (const [text] of prompts) expect(text).toContain('"ar"');
  });
});

// ── The interface ───────────────────────────────────────────────────────────

describe("answering a code question without sight", () => {
  it("reports each case as a sentence rather than a tick or a colour", () => {
    const cases: IvxCodeCase[] = [{ in: [3, 7], example: true, out: 7 }];
    const run: IvxCodeRun = { outputs: [7], errors: [null], timedOut: false, fatal: null };
    expect(describeIvxCase(0, cases[0], run)).toBe("3, 7 → 7");

    const wrong: IvxCodeRun = { outputs: [3], errors: [null], timedOut: false, fatal: null };
    expect(describeIvxCase(0, cases[0], wrong)).toBe("3, 7 → 3 (expected 7)");

    const threw: IvxCodeRun = { outputs: [null], errors: ["a is not defined"], timedOut: false, fatal: null };
    expect(describeIvxCase(0, cases[0], threw)).toBe("3, 7 → a is not defined");
  });

  it("never shows an expected output for a hidden case", () => {
    const hidden: IvxCodeCase = { in: [4, 4], example: false };
    const run: IvxCodeRun = { outputs: [4], errors: [null], timedOut: false, fatal: null };
    expect(describeIvxCase(0, hidden, run)).toBe("4, 4 → 4");
    expect(describeIvxCase(0, hidden, run)).not.toContain("expected");
  });

  it("makes the Tab trap opt-in, because a code box that eats Tab is a trap", () => {
    expect(panel).toContain("tabIndents");
    expect(panel).toContain("Tab will no longer move to the next control");
    expect(panel).toContain('if (event.key !== "Tab" || !tabIndents) return;');
  });

  it("keeps the runner's own output polite and leaves the verdict assertive", () => {
    // The practice page's assertive region announces correct or not quite.
    // A list of case results must not talk over it.
    expect(panel).toContain('aria-live="polite"');
    expect(panel).not.toContain('aria-live="assertive"');
    expect(practice).toContain('aria-live="assertive"');
  });

  it("labels the editor and forces the code box to read left to right", () => {
    expect(panel).toContain('htmlFor="ivx-code-source"');
    expect(panel).toContain('id="ivx-code-source"');
    // Arabic interface, Latin code: without this the braces land in the wrong
    // place on screen.
    expect(panel).toContain('dir="ltr"');
  });

  it("hands in nothing when the run never finished", () => {
    // Submitting nulls would record a wrong answer for a mistake the student
    // is still looking at and can still fix.
    expect(panel).toContain("if (!outcome || outcome.timedOut || outcome.fatal) return;");
    expect(panel).toContain("looping forever");
  });

  it("is what the practice page uses for a code question", () => {
    expect(practice).toContain('question.kind === "code"');
    expect(practice).toContain("<IVXCodeAnswer");
    expect(practice).toContain("ivx.submitCode(");
  });
});
