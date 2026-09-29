// 20261060 — the provider registry says what can actually run — executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/provider-registry-truth-scenarios.mjs supabase/migrations/20261060000000_provider_registry_truth.sql
//
// Runs the migration twice over a minimal ph_providers and checks that only the
// three false 'active' rows change. Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
await db.exec(`
  CREATE TABLE public.ph_providers (slug text PRIMARY KEY, status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','degraded','error')), config jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now());
  INSERT INTO ph_providers (slug, status, config) VALUES
    ('luma-video','active','{"models":["ray-2"]}'), ('mock-tts','active','{}'), ('mock-vc','active','{}'),
    ('openai-tts','active','{}'), ('mistral-vc','active','{}'), ('openai-video','inactive','{"retired":"2026-09-24"}');
`);
const sql = readFileSync(process.argv[2], "utf8");
await db.exec(sql);
await db.exec(sql); // re-runnable
const rows = (await db.query("select slug, status, config from ph_providers order by slug")).rows;
let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
expect("luma-video inactive, its config kept and a reason added", by["luma-video"].status === "inactive" && by["luma-video"].config.models?.[0] === "ray-2" && /LUMA_API_KEY/.test(by["luma-video"].config.inactive_reason));
expect("mock-tts and mock-vc inactive", by["mock-tts"].status === "inactive" && by["mock-vc"].status === "inactive");
expect("every other row untouched", by["openai-tts"].status === "active" && by["mistral-vc"].status === "active" && by["openai-video"].status === "inactive" && !by["openai-tts"].config.inactive_reason);
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
