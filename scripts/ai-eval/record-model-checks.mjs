#!/usr/bin/env node
//
// Record the live route contract's per-model verdicts as ai_model_checks rows,
// the "passing live check" half of ai_model_readiness.
//
//   node scripts/ai-eval/record-model-checks.mjs model-checks.json
//
// Run by live-route-contract.yml on main only, never on a pull request: a
// branch's code cannot certify a model for production billing. It writes
// through the Supabase management API, as vx-deploy-verify.yml reads through
// it. Every value is checked against the same patterns the table's CHECKs
// enforce before any SQL is built, and the batch travels as one JSON literal
// in a dollar-quoted string, so nothing in it is ever SQL. Prints counts only:
// the repository and its logs are public.

import { readFileSync } from "node:fs";

const PROVIDER = /^[a-z0-9_-]{1,32}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const CHECK = /^[a-z0-9_-]{1,64}$/;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/;

/** The rows that may be written, and how many were refused. Exported for the test. */
export function validChecks(raw, runUrl) {
  const list = Array.isArray(raw) ? raw : [];
  const rows = list.filter((c) => c && PROVIDER.test(c.provider) && MODEL.test(c.model_id) && CHECK.test(c.check_name) && typeof c.passed === "boolean")
    .map((c) => ({ provider: c.provider, model_id: c.model_id, check_name: c.check_name, passed: c.passed, run_url: RUN_URL.test(runUrl ?? "") ? runUrl : null }));
  return { rows, refused: list.length - rows.length };
}

/** The one statement: a JSON batch, dollar-quoted, expanded by the database. */
export function insertStatement(rows) {
  const json = JSON.stringify(rows);
  if (json.includes("$checks$")) throw new Error("unexpected delimiter in batch");
  return `INSERT INTO public.ai_model_checks (provider, model_id, check_name, passed, run_url)
SELECT provider, model_id, check_name, passed, run_url
  FROM jsonb_to_recordset($checks$${json}$checks$::jsonb)
    AS c(provider text, model_id text, check_name text, passed boolean, run_url text);`;
}

async function main() {
  const file = process.argv[2];
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
  const ref = process.env.SUPABASE_PROJECT_REF ?? "";
  if (!file || !token || !ref) {
    console.log("::error::model-checks file, SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.");
    process.exit(1);
  }
  let raw;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch { console.log("no verdicts to record"); return; }
  const { rows, refused } = validChecks(raw, process.env.RUN_URL);
  if (rows.length === 0) { console.log(`nothing to record (refused ${refused})`); return; }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: insertStatement(rows) }),
  });
  if (!res.ok) {
    console.log(`::error::recording failed: HTTP ${res.status}`);
    process.exit(1);
  }
  console.log(`recorded=${rows.length} passed=${rows.filter((r) => r.passed).length} refused=${refused}`);
}

if (process.argv[1]?.endsWith("record-model-checks.mjs")) await main();
