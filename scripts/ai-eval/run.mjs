#!/usr/bin/env node
//
// AI provider eval harness — CLI entry point.
//
// Runs a golden set against several providers and reports label accuracy,
// schema conformance and latency, so a routing decision rests on measurements
// instead of on which vendor's page was read most recently.
//
//   node scripts/ai-eval/run.mjs                            # every task, every provider with a key
//   node scripts/ai-eval/run.mjs --task search-intent       # one task
//   node scripts/ai-eval/run.mjs --providers groq,openai    # one comparison
//   node scripts/ai-eval/run.mjs --mock                     # no network, no keys — checks the harness itself
//   node scripts/ai-eval/run.mjs --out results.json         # machine-readable results
//   node scripts/ai-eval/run.mjs --repeat 3                 # average over rounds
//
// Providers whose key is absent are skipped with a note, never failed: the
// harness has to be usable by someone holding one key.
//
// Cost: one run is (cases x providers) calls against cheap-tier models — a few
// hundred short completions. Small, but not free, and --repeat multiplies it.
//
// All the logic lives in harness.mjs; this file only parses arguments and
// prints.

import { writeFileSync } from "node:fs";

import { ALL_PROVIDERS, DEFAULT_MODELS, availableProviders, envKeyFor } from "./providers.mjs";
import { TASK_KEYS, collectMisses, loadTask, runTask } from "./harness.mjs";
import { toMarkdownTable } from "./score.mjs";

export function parseArgs(argv) {
  const args = { tasks: null, providers: null, mock: false, out: null, repeat: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mock") args.mock = true;
    else if (arg === "--task") args.tasks = argv[++i]?.split(",");
    else if (arg === "--providers") args.providers = argv[++i]?.split(",");
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--repeat") args.repeat = Number(argv[++i]) || 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const taskKeys = args.tasks ?? TASK_KEYS;
  const requested = args.providers ?? ALL_PROVIDERS;

  // In mock mode nothing is called, so a missing key must not exclude a
  // provider from the comparison.
  const providers = args.mock ? requested : availableProviders(process.env, requested);
  const skipped = requested.filter((p) => !providers.includes(p));

  if (providers.length === 0) {
    console.error(`No provider keys found. Set one of: ${requested.map(envKeyFor).join(", ")}`);
    process.exit(1);
  }

  const lines = [];
  const report = {
    startedAt: new Date().toISOString(),
    mock: args.mock,
    repeat: args.repeat,
    models: Object.fromEntries(providers.map((p) => [p, DEFAULT_MODELS[p]])),
    tasks: {},
  };

  if (skipped.length) lines.push(`> Skipped (no key configured): ${skipped.join(", ")}`, "");

  for (const key of taskKeys) {
    const task = await loadTask(key);
    const perProvider = await runTask({ task, providers, mock: args.mock, repeat: args.repeat, env: process.env });
    const summaries = Object.fromEntries(Object.entries(perProvider).map(([p, v]) => [p, v.summary]));

    report.tasks[key] = {
      description: task.description,
      cases: task.cases.length,
      gradedFields: task.gradedFields,
      providers: summaries,
      // Naming the cases a provider got wrong is what makes a bad score
      // actionable, rather than only knowing how many it missed.
      misses: collectMisses(perProvider),
    };

    lines.push(
      `### ${task.description}`,
      "",
      `${task.cases.length} cases x ${args.repeat} round(s), graded on: ${task.gradedFields.join(", ")}`,
      "",
      toMarkdownTable(summaries),
      "",
    );
  }

  const output = lines.join("\n");
  console.log(output);

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(report, null, 2));
    console.log(`Wrote ${args.out}`);
  }

  // GitHub Actions renders this on the run page, so the numbers are readable
  // without downloading an artifact.
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## AI provider eval\n\n${output}\n`, { flag: "a" });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
