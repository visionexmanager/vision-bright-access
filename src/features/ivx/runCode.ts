/**
 * Running a student's code.
 *
 * ── Where this runs, and why that is safe ───────────────────────────────────
 *
 * In the student's own browser, in a Web Worker built from a blob. The worker
 * has no DOM, no access to this page's variables, and has its network
 * functions deleted before the student's code is compiled. A worker that never
 * finishes is terminated by the timeout below, which costs a terminated worker
 * and nothing else — the page keeps responding, because it was never the thing
 * doing the work.
 *
 * The part that makes this trustworthy is not the isolation, though. It is
 * that **this file does not decide anything**. It runs the code and reports
 * the outputs it produced; `ivx_answer_matches` compares them, in the
 * database, against expected outputs that were never sent here. Somebody who
 * bypasses all of this and posts outputs by hand has to invent the right ones
 * for every case — which is the same work as solving the problem.
 *
 * So the sandbox protects the student from their own infinite loop. The
 * grading is protected by not being here.
 */

export interface IvxCodeCase {
  /** The arguments the function is called with. */
  in: unknown[];
  /** Present only on a worked example. */
  out?: unknown;
  example: boolean;
}

export interface IvxCodeRun {
  /** One entry per case, in order. `null` where that case did not produce one. */
  outputs: unknown[];
  /** One entry per case: an error message, or null. */
  errors: Array<string | null>;
  /** True when the whole run was cut short. No outputs are trustworthy then. */
  timedOut: boolean;
  /** Set when the code could not be compiled or the entry point was missing. */
  fatal: string | null;
}

/**
 * Compile the student's code and run it over the cases.
 *
 * This is the function that actually executes inside the worker — it is
 * stringified into the worker below rather than duplicated there, so what a
 * test drives is the same code the student's browser runs. That is the whole
 * reason it is written as a self-contained function with no imports and no
 * references to anything outside itself: `Function.prototype.toString` gives
 * back its source, and source that closed over a module would not run.
 *
 * It decides nothing about correctness. It reports what happened.
 */
export function executeIvxCases(
  source: string,
  entry: string,
  inputs: unknown[][],
): { outputs: unknown[]; errors: Array<string | null>; fatal: string | null } {
  let fn: unknown;
  try {
    fn = new Function(
      `${source}\n;return typeof ${entry} === 'function' ? ${entry} : null;`,
    )();
  } catch (error) {
    return {
      outputs: inputs.map(() => null),
      errors: inputs.map(() => null),
      fatal: String(error && (error as Error).message ? (error as Error).message : error),
    };
  }

  if (typeof fn !== "function") {
    return { outputs: inputs.map(() => null), errors: inputs.map(() => null), fatal: "missing-entry" };
  }

  const outputs: unknown[] = [];
  const errors: Array<string | null> = [];
  for (let i = 0; i < inputs.length; i += 1) {
    try {
      const produced = (fn as (...args: unknown[]) => unknown)(...inputs[i]);
      // Normalised through JSON so that what is reported is what the database
      // can compare. A function, a symbol or a circular object is not an
      // answer, and this is where that becomes visible rather than at the
      // structured-clone boundary as an opaque failure.
      outputs.push(JSON.parse(JSON.stringify(produced === undefined ? null : produced)));
      errors.push(null);
    } catch (error) {
      outputs.push(null);
      errors.push(String(error && (error as Error).message ? (error as Error).message : error));
    }
  }
  return { outputs, errors, fatal: null };
}

/** The globals a code exercise has no use for, removed before it compiles. */
export const IVX_REMOVED_GLOBALS = [
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource",
  "importScripts", "indexedDB", "caches", "navigator",
] as const;

/**
 * The worker, assembled from the function above.
 *
 * The globals go before the compile, not after: taking `fetch` away from code
 * that has already captured it achieves nothing.
 */
const WORKER_SOURCE = `
var executeIvxCases = ${executeIvxCases.toString()};
self.onmessage = function (event) {
  ${IVX_REMOVED_GLOBALS.map((name) => `try { delete self.${name}; } catch (ignored) {}`).join("\n  ")}
  var payload = event.data;
  self.postMessage(executeIvxCases(payload.source, payload.entry, payload.cases));
};
`;

/** Beyond this the run is abandoned. Generous for a teaching exercise, short
 *  enough that a runaway loop is noticed rather than waited out. */
export const IVX_CODE_TIMEOUT_MS = 3000;

export async function runIvxCode(
  source: string,
  entry: string,
  cases: IvxCodeCase[],
  timeoutMs: number = IVX_CODE_TIMEOUT_MS,
): Promise<IvxCodeRun> {
  const empty = (fatal: string | null): IvxCodeRun => ({
    outputs: cases.map(() => null),
    errors: cases.map(() => null),
    timedOut: false,
    fatal,
  });

  if (typeof Worker === "undefined" || typeof URL.createObjectURL !== "function") {
    return empty("no-worker");
  }

  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  const worker = new Worker(url);

  try {
    return await new Promise<IvxCodeRun>((resolve) => {
      const timer = window.setTimeout(() => {
        worker.terminate();
        resolve({ ...empty(null), timedOut: true });
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent) => {
        window.clearTimeout(timer);
        const data = event.data as Partial<IvxCodeRun> & { fatal?: string };
        if (data.fatal) {
          resolve(empty(data.fatal));
          return;
        }
        resolve({
          outputs: data.outputs ?? cases.map(() => null),
          errors: data.errors ?? cases.map(() => null),
          timedOut: false,
          fatal: null,
        });
      };

      worker.onerror = (event) => {
        window.clearTimeout(timer);
        resolve(empty(event.message || "worker-error"));
      };

      worker.postMessage({ source, entry, cases: cases.map((c) => c.in) });
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}

/** How a case's outcome reads to somebody who cannot see a red or green tick. */
export function describeIvxCase(
  index: number,
  testCase: IvxCodeCase,
  run: IvxCodeRun,
): string {
  const args = testCase.in.map((value) => JSON.stringify(value)).join(", ");
  const error = run.errors[index];
  if (error) return `${args} → ${error}`;
  const produced = JSON.stringify(run.outputs[index]);
  if (testCase.example && "out" in testCase) {
    const expected = JSON.stringify(testCase.out);
    return produced === expected
      ? `${args} → ${produced}`
      : `${args} → ${produced} (expected ${expected})`;
  }
  return `${args} → ${produced}`;
}
