// Scoring for the AI provider eval harness.
//
// Pure functions only — no network, no keys, no clock. Everything here is
// exercised by src/test/ai-eval-scoring.test.ts, so a routing decision is never
// justified by a metric nobody checked.

/**
 * Minimal JSON Schema check covering exactly what our task schemas use:
 * required properties, `type`, `enum` membership, and array `maxItems`.
 *
 * Deliberately not a full validator. A provider that returns a shape this
 * misses would be caught by the graded-field comparison anyway, and a real
 * validator would add a dependency to a script whose whole point is to be
 * auditable at a glance.
 */
export function validateAgainstSchema(value, schema) {
  const errors = [];

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["result is not a JSON object"] };
  }

  for (const key of schema.required ?? []) {
    if (!(key in value)) errors.push(`missing required field '${key}'`);
  }

  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    if (!(key in value)) continue;
    const actual = value[key];

    if (spec.type === "array") {
      if (!Array.isArray(actual)) {
        errors.push(`'${key}' should be an array`);
        continue;
      }
      if (spec.maxItems !== undefined && actual.length > spec.maxItems) {
        errors.push(`'${key}' has ${actual.length} items, max ${spec.maxItems}`);
      }
      if (spec.items?.type === "string" && actual.some((v) => typeof v !== "string")) {
        errors.push(`'${key}' should contain only strings`);
      }
      continue;
    }

    if (spec.type === "string" && typeof actual !== "string") {
      errors.push(`'${key}' should be a string`);
      continue;
    }

    if (spec.enum && !spec.enum.includes(actual)) {
      errors.push(`'${key}' is '${actual}', not one of ${spec.enum.join(" | ")}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Score one case. `gradedFields` are the fields with an objectively correct
 * answer — enums, in practice. Free-text fields (synonyms, keywords) are
 * checked for shape only: there is no defensible single right answer for them,
 * and grading them by string equality would measure agreement with whoever
 * wrote the fixture rather than quality.
 */
export function scoreCase({ output, expected, schema, gradedFields }) {
  const validation = validateAgainstSchema(output, schema);
  const fields = {};
  let graded = 0;
  let correct = 0;

  for (const field of gradedFields) {
    if (!(field in expected)) continue;
    graded += 1;
    const hit = validation.ok && output?.[field] === expected[field];
    if (hit) correct += 1;
    fields[field] = { expected: expected[field], actual: output?.[field] ?? null, correct: hit };
  }

  return {
    schemaOk: validation.ok,
    schemaErrors: validation.errors,
    graded,
    correct,
    allCorrect: graded > 0 && correct === graded,
    fields,
  };
}

/** Nearest-rank percentile. Returns null for an empty sample. */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

/**
 * Aggregate per-case results for one provider.
 *
 * Two different denominators, on purpose:
 *
 *   * Accuracy counts every case, including ones whose call failed. A provider
 *     that answered 2 of 12 questions correctly and errored on the other 10
 *     scored 2/12, not 100% — the first version of this file reported the
 *     latter, which flattered a provider that was mostly rate-limited.
 *   * Latency percentiles use successful calls only, because a provider that
 *     fails fast would otherwise look like a provider that responds fast.
 *
 * `schemaOkRate` stays over completed calls: it answers "when this provider
 * replies, is the reply well-formed", which the error count already covers
 * from the other side.
 */
export function summarize(cases) {
  const ok = cases.filter((c) => !c.error);
  const latencies = ok.map((c) => c.latencyMs);
  const graded = cases.reduce((n, c) => n + c.score.graded, 0);
  const correct = cases.reduce((n, c) => n + c.score.correct, 0);
  const schemaOk = ok.filter((c) => c.score.schemaOk).length;

  const tokens = ok.reduce(
    (acc, c) => ({
      prompt: acc.prompt + (c.usage?.promptTokens ?? 0),
      completion: acc.completion + (c.usage?.completionTokens ?? 0),
      reported: acc.reported + (c.usage ? 1 : 0),
    }),
    { prompt: 0, completion: 0, reported: 0 },
  );

  return {
    cases: cases.length,
    errors: cases.length - ok.length,
    schemaOkRate: ok.length ? schemaOk / ok.length : 0,
    accuracy: graded ? correct / graded : 0,
    gradedFields: graded,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    // null rather than 0 when no provider reported usage, so a missing number
    // never reads as a free request.
    promptTokens: tokens.reported ? tokens.prompt : null,
    completionTokens: tokens.reported ? tokens.completion : null,
  };
}

/** Render a summary map as a GitHub-flavoured markdown table. */
export function toMarkdownTable(summaries) {
  const pct = (n) => `${(n * 100).toFixed(0)}%`;
  const ms = (n) => (n === null ? "—" : `${n} ms`);
  const num = (n) => (n === null ? "—" : String(n));

  const rows = Object.entries(summaries).map(([provider, s]) =>
    `| ${provider} | ${pct(s.accuracy)} | ${pct(s.schemaOkRate)} | ${ms(s.latencyP50)} | ${ms(s.latencyP95)} | ${s.errors}/${s.cases} | ${num(s.completionTokens)} |`,
  );

  return [
    "| Provider | Accuracy (all cases) | Valid schema (of replies) | p50 | p95 | Errors | Completion tokens |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}
