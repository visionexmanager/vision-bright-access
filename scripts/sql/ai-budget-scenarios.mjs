// check_ai_budget against the rows the code really writes, executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/ai-budget-scenarios.mjs
//
// docs/audit/VISIONEX_AI_COST_FLOW.md (G1, G4) says the global budget cannot see
// `ai-chat`: its token and request legs read `ai_interactions` (written by the Career
// AI code) while `ai-chat` writes `ai_usage_events`. No test executed the function, so
// the claim rested on reading the source. These scenarios execute it. Synthetic rows
// and invented limits only; nothing here is a price or a recommended ceiling.
//
// Lines labelled "CURRENT BEHAVIOUR" record what the function does today so that
// changing it is a deliberate decision. They are NOT endorsements: the gaps are
// documented, and fixing them needs the owner's approval. The run ends by mutating
// the function and requiring a red result, so a pass cannot be vacuous.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "supabase/migrations");
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin; create role supabase_admin nologin;
  create schema auth; create schema extensions; create schema storage; create schema realtime; create schema vault;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), email_confirmed_at timestamptz, phone text, raw_app_meta_data jsonb default '{}', last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
  create function storage.filename(name text) returns text language sql as $$ select name $$;
  grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
let applied = 0, skipped = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(`${dir}/${f}`, "utf8")); applied++; } catch { skipped++; }
}
console.log(`migrations replayed: ${applied} applied, ${skipped} skipped (PGlite lacks pg_cron/pgvector/pgcrypto/realtime)`);

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const USER = U(21);
await db.exec(`insert into auth.users(id, email) values ('${USER}', 'budget-test@example.invalid')`);
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const budgetOk = async () => (await one("select public.check_ai_budget() ok")).ok;
const setBudget = async (tokens, requests, vx = null, active = true) => {
  await db.exec("delete from public.ai_budgets where scope='global'");
  await db.query("insert into public.ai_budgets(scope, daily_token_limit, daily_request_limit, daily_vx_limit, active) values ('global',$1,$2,$3,$4)", [tokens, requests, vx, active]);
};
let fail = 0, total = 0;
const check = (name, ok) => { total++; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const clearRows = async () => {
  await db.exec("delete from public.ai_interactions; delete from public.ai_usage_events; delete from public.vx_usage_ledger");
};
// What ai-chat's provider layer writes for one answered call (usageRecording.ts).
const aiChatEvent = (tokens = 1000) => db.query(
  `insert into public.ai_usage_events(function_name, operation, provider, model, outcome, usage, usage_source, provider_cost_usd, cost_status)
   values ('ai-chat','stream','groq','llama-3.3-70b-versatile','ok',$1::jsonb,'reported',0.001,'priced')`,
  [JSON.stringify({ input_tokens: tokens, output_tokens: tokens, total_tokens: 2 * tokens })]);
const aiInteraction = (tokens = 1000) => db.query(
  "insert into public.ai_interactions(user_id, service, provider, prompt_tokens, completion_tokens) values ($1,'career','groq',$2,$2)", [USER, tokens]);

await clearRows();

// 1. Baseline.
await setBudget(10_000, 5);
check("a fresh day with a budget row is within budget", (await budgetOk()) === true);

// 2. The leg that works: Career AI rows in ai_interactions.
for (let i = 0; i < 6; i++) await aiInteraction(10);
check("6 ai_interactions rows against a 5-request limit: refused (the Career AI path is counted)", (await budgetOk()) === false);
await clearRows();
await aiInteraction(6_000);
check("12,000 tokens in ai_interactions against a 10,000 token limit: refused", (await budgetOk()) === false);
await clearRows();

// 3. G1. ai-chat's own usage, far over both limits.
await setBudget(10_000, 5);
for (let i = 0; i < 50; i++) await aiChatEvent(5_000);
const seen = (await one("select coalesce(sum((usage->>'total_tokens')::bigint),0)::bigint t from public.ai_usage_events")).t;
check("fixture: 50 ai-chat events recorded, 500,000 tokens (50x the token limit, 10x the request limit)", Number(seen) === 500_000);
check("CURRENT BEHAVIOUR (G1): that spend is invisible to check_ai_budget: still within budget", (await budgetOk()) === true);
await clearRows();

// 4. G4. Missing / inactive row, and a fault.
await db.exec("delete from public.ai_budgets where scope='global'");
for (let i = 0; i < 6; i++) await aiInteraction(10);
check("CURRENT BEHAVIOUR (G4): no global budget row at all: always within budget", (await budgetOk()) === true);
await setBudget(10_000, 5, null, false);
check("CURRENT BEHAVIOUR (G4): the global row exists but is inactive: always within budget", (await budgetOk()) === true);
await setBudget(10_000, 5);
check("same rows, row active: refused (so the two results above come from the row, not the data)", (await budgetOk()) === false);
await db.exec("begin");
await db.exec("alter table public.ai_interactions rename to ai_interactions_gone");
const faulted = await budgetOk();
await db.exec("rollback");
check("CURRENT BEHAVIOUR (G4): an exception inside the function (table unreadable) reads as within budget (fail-open)", faulted === true);
check("after the rollback the same data is refused again", (await budgetOk()) === false);
await clearRows();

// 5. The VX leg: reserved VX in the ledger, refunded and expired rows excluded.
await setBudget(null, null, 100);
const ledgerRow = (status, vx) => db.query(
  "insert into public.vx_usage_ledger(user_id, service_id, reserved_vx, status, source) values ($1,'ai_chat',$2,$3,'website')", [USER, vx, status]);
await ledgerRow("settled", 60);
check("60 VX reserved against a 100 VX limit: within budget", (await budgetOk()) === true);
await ledgerRow("refunded", 500);
await ledgerRow("expired", 500);
check("refunded and expired holds are not counted", (await budgetOk()) === true);
await ledgerRow("reserved", 40);
check("60 + 40 reserved VX reach the 100 VX limit: refused", (await budgetOk()) === false);
await clearRows();
for (let i = 0; i < 50; i++) await aiChatEvent(5_000);
check("CURRENT BEHAVIOUR: ai-chat events with no ledger row (shadow mode) do not reach the VX leg either", (await budgetOk()) === true);
await clearRows();

// 6. Only today counts.
await setBudget(null, 5);
for (let i = 0; i < 6; i++) await aiInteraction(10);
await db.exec("update public.ai_interactions set created_at = now() - interval '2 days'");
check("rows from two days ago are not counted", (await budgetOk()) === true);
await clearRows();

// 7. Who may call it. Information for the design: the caller is the service role.
const canExec = async (role) => (await one("select has_function_privilege($1, 'public.check_ai_budget()', 'execute') ok", [role])).ok;
console.log(`INFO  execute on check_ai_budget(): anon=${await canExec("anon")} authenticated=${await canExec("authenticated")} service_role=${await canExec("service_role")} (PGlite default privileges; the production grants were not read)`);

// 8. Event-table guards that matter for cost accuracy.
const bad = (sql) => db.exec(sql).then(() => false, () => true);
check("an unpriced event cannot carry a dollar cost", await bad(`insert into public.ai_usage_events(function_name, operation, provider, model, outcome, usage_source, provider_cost_usd, cost_status) values ('ai-chat','stream','groq','m1','ok','reported',0.5,'unpriced')`));
check("a priced event must carry a dollar cost", await bad(`insert into public.ai_usage_events(function_name, operation, provider, model, outcome, usage_source, cost_status) values ('ai-chat','stream','groq','m1','ok','reported','priced')`));
for (let i = 0; i < 2; i++) {
  await db.exec(`insert into public.ai_usage_events(function_name, operation, provider, model, outcome, usage_source, cost_status) values ('ai-chat','stream','gemini','gemini-flash-latest','ok','reported','unpriced')`);
}
check("CURRENT BEHAVIOUR: an event has no uniqueness, so a duplicate delivery is stored twice (the code has no retry path that would do it)", Number((await one("select count(*)::int n from public.ai_usage_events")).n) === 2);
await clearRows();

// Mutation proof: remove the request leg and require a red result.
const def = (await one("select pg_get_functiondef('public.check_ai_budget()'::regprocedure) d")).d;
const mutated = def.replace(/IF _budget\.daily_request_limit IS NOT NULL AND _requests >= _budget\.daily_request_limit THEN\s+RETURN false;\s+END IF;/i, "");
if (mutated === def) {
  fail++;
  console.log("FAIL  mutation changed nothing (the pattern no longer matches)");
} else {
  await db.exec(mutated);
  await setBudget(null, 5);
  for (let i = 0; i < 6; i++) await aiInteraction(10);
  const detected = (await budgetOk()) === true; // the 6-request refusal check would now fail
  console.log(`${detected ? "PASS" : "FAIL"}  mutation "request leg removed" turns the 6-request check red`);
  if (!detected) fail++;
  await db.exec(def);
  check("restored: the 6 requests are refused again", (await budgetOk()) === false);
  await clearRows();
}

console.log(fail ? `\n${fail} failure(s)` : `\nall ${total} checks and 1 mutation proof passed`);
process.exit(fail ? 1 : 0);
