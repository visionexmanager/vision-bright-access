// page_events 90-day retention: dry-run report and delete behaviour on SYNTHETIC rows,
// executed in PGlite. Nothing here deletes anything anywhere else, and the delete is
// not part of any migration: docs/audit/PAGE_EVENTS_RETENTION_PROPOSAL.md is the proposal.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/page-events-retention-scenarios.mjs
//
// It asserts: exactly which rows the predicate selects, the strict boundary, that the
// cutoff does not move with the session time zone (it is 2160 absolute hours, not
// "90 calendar days"), batching, idempotence, that nothing else is touched, that no
// foreign key or view depends on the table, and that the SQL text in the proposal is
// the SQL tested here. Ends by mutating the predicate and requiring a red result.
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

// The exact statement the scheduled job would run (also printed in the proposal).
const BATCH = 10000;
const DELETE_SQL = `DELETE FROM public.page_events
            WHERE id IN (SELECT id FROM public.page_events
                          WHERE created_at < now() - interval '2160 hours'
                          ORDER BY created_at LIMIT ${BATCH})`;
// The read-only dry run: the same predicate, no DELETE.
const DRY_RUN_SQL = `SELECT count(*)::int AS would_delete,
       min(created_at) AS oldest, max(created_at) AS newest_that_would_go,
       now() - interval '2160 hours' AS cutoff
  FROM public.page_events WHERE created_at < now() - interval '2160 hours'`;

let fail = 0, total = 0;
const check = (name, ok) => { total++; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const ids = async () => (await db.query("select page_path p from public.page_events order by page_path")).rows.map((r) => r.p);
const insertAged = (label, interval) =>
  db.query("insert into public.page_events(event_type, page_path, created_at) values ('page_view', $1, now() + $2::interval)", [label, interval]);

const proposal = readFileSync("docs/audit/PAGE_EVENTS_RETENTION_PROPOSAL.md", "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ");
check("the SQL in the proposal is the SQL tested here", proposal.includes(DELETE_SQL.replace(/\s+/g, " ")));

// ── Which rows ───────────────────────────────────────────────────────────────
await db.exec("delete from public.page_events");
const FIX = [
  ["new-now", "0 seconds", true], ["1d", "-1 day", true], ["89d", "-89 days", true],
  ["just-inside-90d", "-2159 hours -59 minutes", true], ["just-past-90d", "-2160 hours -1 minute", false],
  ["120d", "-120 days", false], ["400d", "-400 days", false], ["future-clock-skew", "2 days", true],
];
for (const [l, i] of FIX) await insertAged(l, i);
const dry = await one(DRY_RUN_SQL);
check("dry run: 3 of 8 synthetic rows would be deleted (just past 90 days, 120 days, 400 days)", dry.would_delete === 3);
check("dry run changed nothing", (await ids()).length === 8);
console.log(`INFO  dry-run report on synthetic data: would_delete=${dry.would_delete} oldest=${dry.oldest.toISOString()} cutoff=${dry.cutoff.toISOString()}`);

const other = async () => JSON.stringify(await one(`select (select count(*) from public.user_points)::int up, (select count(*) from public.ai_budgets)::int ab, (select count(*) from public.profiles)::int pr, (select count(*) from public.notifications)::int nt`));
const beforeOther = await other();
const del1 = await db.query(DELETE_SQL);
const kept = await ids();
check("the delete removes exactly the rows the dry run counted", del1.affectedRows === 3);
check("rows inside 90 days (including 89 days and a minute inside the line) and future-dated rows are kept", ["1d", "89d", "future-clock-skew", "just-inside-90d", "new-now"].every((l) => kept.includes(l)) && kept.length === 5);
check("a second run deletes nothing (idempotent)", (await db.query(DELETE_SQL)).affectedRows === 0);
check("no other table was touched", (await other()) === beforeOther);

// ── Boundary and time zones ─────────────────────────────────────────────────
await db.exec("delete from public.page_events");
await db.exec("begin");
await db.exec("insert into public.page_events(event_type, page_path, created_at) values ('page_view', 'exactly-cutoff', now() - interval '2160 hours')");
const edge = await db.query(DELETE_SQL);
await db.exec("rollback");
check("a row exactly on the cutoff instant is kept (strictly older rows only)", edge.affectedRows === 0);

const deletedUnder = async (tz) => {
  await db.exec("delete from public.page_events");
  for (const [l, i] of FIX) await insertAged(l, i);
  await db.exec("begin");
  await db.exec(`set local timezone = '${tz}'`);
  const r = await db.query(`${DELETE_SQL.replace("DELETE FROM public.page_events", "DELETE FROM public.page_events")} RETURNING page_path`);
  await db.exec("rollback");
  return r.rows.map((x) => x.page_path).sort().join(",");
};
const utc = await deletedUnder("UTC");
check("the deleted set is identical under UTC, America/New_York and Pacific/Auckland", utc === await deletedUnder("America/New_York") && utc === await deletedUnder("Pacific/Auckland") && utc.split(",").length === 3);
// Why 2160 hours and not "90 days": across a DST change the two differ by an hour.
await db.exec("begin");
await db.exec("set local timezone = 'America/New_York'");
const dstGap = await one(`select extract(epoch from ((timestamptz '2026-04-20 12:00:00-04') - interval '90 days') - ((timestamptz '2026-04-20 12:00:00-04') - interval '2160 hours'))/3600 as hours`);
await db.exec("rollback");
console.log(`INFO  in America/New_York, "90 days" and 2160 hours differ by ${dstGap.hours} h when the 90 days cross the March DST change; the proposal uses 2160 hours so the cutoff never depends on the time zone`);
check("calendar-day arithmetic would have moved the cutoff by an hour in a DST zone (why 2160 hours is used)", Math.abs(Number(dstGap.hours)) === 1);

// ── Batching ─────────────────────────────────────────────────────────────────
await db.exec("delete from public.page_events");
await db.exec(`insert into public.page_events(event_type, page_path, created_at)
  select 'page_view', 'old-' || g, now() - interval '200 days' - (g || ' seconds')::interval from generate_series(1, 25000) g`);
await insertAged("recent", "-1 day");
const runs = [];
for (let i = 0; i < 6; i++) { const r = await db.query(DELETE_SQL); runs.push(r.affectedRows); if (!r.affectedRows) break; }
check("a 25,000-row backlog drains in batches of 10,000 over three runs, then stops", JSON.stringify(runs) === JSON.stringify([10000, 10000, 5000, 0]));
check("the recent row survives the whole drain", (await ids()).join() === "recent");

// ── Dependencies ─────────────────────────────────────────────────────────────
const fks = await one("select count(*)::int n from pg_constraint where confrelid = 'public.page_events'::regclass");
const deps = await one(`select count(*)::int n from pg_depend d join pg_rewrite r on r.oid = d.objid where d.refobjid = 'public.page_events'::regclass and d.deptype = 'n'`);
check("no foreign key references page_events", fks.n === 0);
check("no view or rule depends on page_events", deps.n === 0);
const idx = await one("select count(*)::int n from pg_indexes where tablename='page_events' and indexdef ilike '%(created_at DESC)%'");
check("created_at is indexed (the batch sub-select does not scan the table)", idx.n === 1);

// ── Mutation proof ───────────────────────────────────────────────────────────
await db.exec("delete from public.page_events");
for (const [l, i] of FIX) await insertAged(l, i);
const mutated = DELETE_SQL.replace("2160 hours", "216 hours");
const n = (await db.query(mutated)).affectedRows;
console.log(`${n !== 3 ? "PASS" : "FAIL"}  mutation "cutoff 216 hours instead of 2160" deletes ${n} rows, so the 3-row check above would go red`);
if (n === 3) fail++;

console.log(fail ? `\n${fail} failure(s)` : `\nall ${total} checks and 1 mutation proof passed`);
process.exit(fail ? 1 : 0);
