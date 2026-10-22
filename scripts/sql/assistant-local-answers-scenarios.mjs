// record_local_answer() and admin_assistant_local_answers(), executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/assistant-local-answers-scenarios.mjs
//
// Replays the migrations, then checks who may call each function, that the plan
// class is derived on the server (an admin is counted as an admin, a stranger
// as anonymous), that repeated answers increment one row, that the table holds
// no identity, and that the report is admin-only and labels its token figure an
// estimate. Ends with a mutation (EXECUTE granted to anon) that must be
// detected, so a pass cannot be vacuous.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "supabase/migrations");
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin; create role supabase_admin nologin;
  create schema auth; create schema extensions; create schema storage; create schema realtime; create schema vault;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
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

for (const fn of ["record_local_answer", "admin_assistant_local_answers", "plan_for_user"]) {
  const r = await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname=$1", [fn]);
  if (!r.rows[0].n) { console.log(`FAIL  function public.${fn} did not replay`); process.exit(1); }
}

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TRIAL = U(41), ADMIN = U(42), NOBODY = U(43);
await db.exec(`
  insert into auth.users(id, email) values ('${TRIAL}', 'trial@example.test'), ('${ADMIN}', 'admin@example.test'), ('${NOBODY}', 'nobody@example.test') on conflict do nothing;
  delete from public.user_roles where user_id in ('${TRIAL}','${ADMIN}','${NOBODY}');
  insert into public.user_roles(user_id, role) values ('${ADMIN}', 'admin');
`);

let fail = 0, total = 0;
const check = (name, ok) => { total++; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const canExec = async (role, sig) => (await db.query(`select has_function_privilege('${role}', '${sig}', 'execute') v`)).rows[0].v;
const REC = "public.record_local_answer(text, text, text, uuid, integer)";
const REP = "public.admin_assistant_local_answers(integer, numeric)";

check("record_local_answer: service_role only", (await canExec("service_role", REC)) && !(await canExec("anon", REC)) && !(await canExec("authenticated", REC)));
check("report: authenticated only (admin check inside), not anon, not service_role",
  (await canExec("authenticated", REP)) && !(await canExec("anon", REP)) && !(await canExec("service_role", REP)));

const plan = async (id) => (await db.query("select public.plan_for_user($1) p", [id])).rows[0].p;
const record = (user, intent = "greeting", locale = "en", tokens = 100) =>
  db.query("select public.record_local_answer('website', $1, $2, $3, $4)", [intent, locale, user, tokens]);
const rowFor = async (cls, intent = "greeting") =>
  (await db.query("select answers::int answers, est_avoided_input_tokens::int est_avoided_input_tokens from public.assistant_local_answer_daily where plan_class=$1 and intent=$2", [cls, intent])).rows[0];

check("fixture: the admin resolves to 'admin'", (await plan(ADMIN)) === "admin");
const strangerPlan = await plan(NOBODY);
check(`fixture: an account with no subscription resolves to '${strangerPlan}'`, ["none", "free_trial"].includes(strangerPlan));

await record(null); await record(null); await record(null, "thanks");
check("anonymous callers are counted as 'anonymous', one row per intent", (await rowFor("anonymous")).answers === 2 && (await rowFor("anonymous", "thanks")).answers === 1);
check("tokens add up per row", (await rowFor("anonymous")).est_avoided_input_tokens === 200);

await record(ADMIN);
check("an admin is counted as 'admin'", (await rowFor("admin"))?.answers === 1);
await record(NOBODY);
check("an account is counted by the plan the server resolves, never by anything the caller sends",
  strangerPlan === "none" ? (await rowFor("none"))?.answers === 1 : (await rowFor("free_trial"))?.answers === 1);

await record(null, "faq.trial", "ar", 999999999);
check("a token estimate is capped per answer", (await rowFor("anonymous", "faq.trial")).est_avoided_input_tokens === 200000);

let rejected = 0;
for (const [channel, intent, locale] of [["sms", "greeting", "en"], ["website", "Bad Intent!", "en"], ["website", "greeting", "english"]]) {
  try {
    await db.query("insert into public.assistant_local_answer_daily(day,channel,intent,locale,plan_class) values (current_date,$1,$2,$3,'anonymous')", [channel, intent, locale]);
  } catch { rejected++; }
}
check("the table rejects an unknown channel, a malformed intent and a malformed language", rejected === 3);

const cols = (await db.query("select column_name from information_schema.columns where table_name='assistant_local_answer_daily' order by ordinal_position")).rows.map((r) => r.column_name);
check("the table holds no identity column", !cols.some((c) => /user|email|phone|address|text|message/.test(c)));

async function as(who, sql) {
  const role = who === "anon" ? "anon" : who === "SERVICE" ? "service_role" : "authenticated";
  const sub = who === "ADMIN" ? ADMIN : who === "TRIAL" ? TRIAL : "";
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${sub}',true), set_config('request.jwt.claim.role','${role}',true);`);
    return { rows: (await db.query(sql)).rows };
  } catch (e) {
    return { error: e.message.split("\n")[0] };
  } finally {
    await db.exec("rollback");
  }
}
check("a signed-in non-admin is refused the report", !!(await as("TRIAL", "select public.admin_assistant_local_answers(7, null) r")).error);
check("anon cannot read the table directly", !!(await as("anon", "select * from public.assistant_local_answer_daily")).error);
check("an authenticated user cannot read the table directly", !!(await as("TRIAL", "select * from public.assistant_local_answer_daily")).error);
check("service_role cannot call the report (no admin identity)", !!(await as("SERVICE", "select public.admin_assistant_local_answers(7, null) r")).error);

const report = (await as("ADMIN", "select public.admin_assistant_local_answers(7, 3) r")).rows?.[0]?.r;
check("an admin gets the report", !!report);
check("the report counts every recorded answer", report?.local_answers === 6);
check("the report labels its token figure an estimate and not billing", report?.tokens_are_an_estimate === true && /not billing/.test(report?.confirmed_by ?? ""));
check("the dollar figure is computed only from the rate the admin supplied", Math.abs(Number(report?.est_usd_avoided) - (report.est_avoided_input_tokens / 1e6) * 3) < 1e-5);
const noRate = (await as("ADMIN", "select public.admin_assistant_local_answers(7, null) r")).rows?.[0]?.r;
check("with no rate supplied there is no dollar figure", !!noRate && noRate.est_usd_avoided === null);
check("the report carries aggregates only", !JSON.stringify(report).match(/@|[0-9a-f]{8}-[0-9a-f]{4}/i));

await db.exec(`grant execute on function ${REC} to anon`);
check("mutation: EXECUTE granted to anon is detected", await canExec("anon", REC));

console.log(`\n${total - fail}/${total} passed${fail ? `, ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);
