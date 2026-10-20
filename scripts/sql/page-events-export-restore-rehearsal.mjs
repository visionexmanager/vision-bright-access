// page_events export -> isolated scratch restore -> integrity check, on SYNTHETIC rows only.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/page-events-export-restore-rehearsal.mjs
//
// This is a rehearsal of the procedure, NOT an export of production data: every row is
// generated here. It proves that the export format, the checksums and the restore steps
// detect what they are meant to detect. It does not prove that any production backup
// exists or is restorable. The export file is written to a private temporary directory
// outside the repository and removed at the end; nothing is committed or logged beyond
// counts and checksums.
//
// Steps: (1) generate rows, some eligible for the 365-day retention window; (2) export
// the eligible rows to NDJSON plus a manifest (count, SHA-256 of the file, a logical
// MD5 computed inside the database); (3) rebuild the table's schema from the source
// catalog in a second, empty database; (4) verify the file against the manifest, load
// it, and compare counts, the logical checksum, id sets, time range and null counts;
// (5) show that a flipped byte, a missing row and a double load are each caught;
// (6) delete the eligible rows from the source with the migration's own command and
// restore them from the file, then compare the source with the original.
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

import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

let fail = 0, total = 0;
const check = (name, ok) => { total++; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const stamp = () => new Date().toISOString();
const one = async (d, sql, args) => (await d.query(sql, args)).rows[0];
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const WINDOW = "8760 hours"; // 365 x 24 elapsed hours, as in the migration
const migrationText = readFileSync("supabase/migrations/20261074000000_page_events_retention.sql", "utf8").replace(/\r\n/g, "\n");
const CRON_COMMAND = migrationText.match(/\$cron\$([\s\S]*?)\$cron\$/)[1];
check("the window used here is the migration's window", CRON_COMMAND.includes(`interval '${WINDOW}'`));

// The PGlite replay skips the migration that adds page_events' size CHECKs, so the
// replayed table has none and "scratch matches source" would compare 0 with 0. Apply
// that migration's own ALTER TABLE so the constraints under test are the real ones.
const checkMigration = readFileSync("supabase/migrations/20260409173515_0a7eb92a-6f67-4315-a983-2a747abbf75e.sql", "utf8").replace(/\r\n/g, "\n");
const checkAlter = checkMigration.match(/ALTER TABLE public\.page_events[\s\S]*?;/i)[0];
const checkCount = async (d) => Number((await one(d, "select count(*)::int n from pg_constraint where conrelid='public.page_events'::regclass and contype='c'")).n);
if ((await checkCount(db)) === 0) await db.exec(checkAlter);
check("the source table has the three production CHECK constraints (not zero)", (await checkCount(db)) === 3);

// ── 1. Synthetic rows ────────────────────────────────────────────────────────
await db.exec("delete from public.page_events");
await db.exec(`
  insert into public.page_events(event_type, page_path, page_title, user_id, session_id, metadata, created_at)
  select (array['page_view','click','scroll','navigation','form_submit','search'])[1 + g % 6],
         '/synthetic/' || g,
         case g % 7 when 0 then null when 1 then 'Café "quoted", comma' when 2 then E'multi\\nline title' when 3 then 'عنوان عربي ' || g when 4 then 'emoji 🙂 ' || g else 'title ' || g end,
         case when g % 5 = 0 then ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid end,
         case when g % 3 = 0 then null else 'session-' || (g % 40) end,
         case when g % 4 = 0 then jsonb_build_object('n', g, 'nested', jsonb_build_object('a', array[1,2,3])) else '{}'::jsonb end,
         now() - interval '${WINDOW}' - ((g * 7) || ' minutes')::interval - interval '1 minute'
    from generate_series(1, 1200) g`);
await db.exec(`
  insert into public.page_events(event_type, page_path, page_title, session_id, created_at)
  select 'page_view', '/recent/' || g, 'recent ' || g, 'session-r', now() - ((g * 13) || ' minutes')::interval
    from generate_series(1, 300) g`);
const eligible = Number((await one(db, `select count(*)::int n from public.page_events where created_at < now() - interval '${WINDOW}'`)).n);
const total0 = Number((await one(db, "select count(*)::int n from public.page_events")).n);
check("fixture: 1,200 eligible and 300 recent synthetic rows", eligible === 1200 && total0 === 1500);
console.log(`INFO  ${stamp()}  dry run on synthetic data: ${eligible} rows older than ${WINDOW}`);

// ── 2. Export ────────────────────────────────────────────────────────────────
const exportDir = mkdtempSync(`${tmpdir()}/page-events-rehearsal-`);
try { chmodSync(exportDir, 0o700); } catch { /* no POSIX modes on some platforms */ }
const logicalSql = (where) => `select count(*)::int n, md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by p.id), '')) m, min(created_at) lo, max(created_at) hi,
  count(*) filter (where page_title is null)::int null_title, count(*) filter (where user_id is null)::int null_user, count(*) filter (where session_id is null)::int null_session,
  count(distinct id)::int ids from public.page_events p ${where}`;
const frozenCutoff = (await one(db, `select (now() - interval '${WINDOW}') c`)).c.toISOString();
const elig = `where created_at < '${frozenCutoff}'::timestamptz`;
const src = await one(db, logicalSql(elig));
const rows = (await db.query(`select to_jsonb(p) r from public.page_events p ${elig} order by id`)).rows.map((x) => JSON.stringify(x.r));
const ndjson = rows.join("\n") + "\n";
const filePath = `${exportDir}/page_events_eligible.ndjson`;
writeFileSync(filePath, ndjson, { mode: 0o600 });
const manifest = { rows: rows.length, file_sha256: sha256(ndjson), logical_md5: src.m, cutoff: frozenCutoff, exported_at: stamp() };
writeFileSync(`${exportDir}/manifest.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.log(`INFO  ${stamp()}  export: ${manifest.rows} rows, file sha256=${manifest.file_sha256.slice(0, 16)}…, logical md5=${manifest.logical_md5}, stored in a private temp directory (not printed)`);
check("export row count equals the dry-run count", manifest.rows === eligible);

// ── 3. Scratch database, schema rebuilt from the source catalog ──────────────
const scratch = new PGlite();
const cols = (await db.query(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='page_events' order by ordinal_position`)).rows;
const ddl = `create table public.page_events (${cols.map((c) => `${c.column_name} ${c.data_type === "timestamp with time zone" ? "timestamptz" : c.data_type}${c.is_nullable === "NO" ? " not null" : ""}${c.column_default ? " default " + c.column_default : ""}`).join(", ")}, primary key (id))`;
await scratch.exec(ddl);
for (const c of (await db.query(`select pg_get_constraintdef(oid) d, conname n from pg_constraint where conrelid='public.page_events'::regclass and contype='c'`)).rows) {
  await scratch.exec(`alter table public.page_events add constraint ${c.n} ${c.d}`);
}
check("scratch database is separate and empty", Number((await one(scratch, "select count(*)::int n from public.page_events")).n) === 0);
check("the scratch table has the same three CHECK constraints as the source", (await checkCount(scratch)) === 3 && (await checkCount(scratch)) === (await checkCount(db)));

// ── 4. Verify the file, load it, compare ─────────────────────────────────────
async function loadFrom(target, text, expected) {
  if (sha256(text) !== expected.file_sha256) throw new Error("file checksum mismatch");
  const lines = text.split("\n").filter(Boolean);
  if (lines.length !== expected.rows) throw new Error("row count mismatch");
  for (let i = 0; i < lines.length; i += 500) {
    await target.query("insert into public.page_events select * from jsonb_populate_recordset(null::public.page_events, $1::jsonb)", [`[${lines.slice(i, i + 500).join(",")}]`]);
  }
}
console.log(`INFO  ${stamp()}  restore into scratch: load NDJSON in 500-row batches via jsonb_populate_recordset`);
await loadFrom(scratch, ndjson, manifest);
const dst = await one(scratch, logicalSql(""));
check("restored row count equals the exported count", dst.n === manifest.rows);
check("logical checksum (MD5 over every row's JSON, ordered by id) matches the source", dst.m === manifest.logical_md5);
check("id set, time range and null counts match", dst.ids === src.ids && +dst.lo === +src.lo && +dst.hi === +src.hi && dst.null_title === src.null_title && dst.null_user === src.null_user && dst.null_session === src.null_session);
const edge = await one(scratch, "select count(*)::int n from public.page_events where page_title = E'multi\\nline title' or page_title like 'Café \"quoted\", comma' or page_title like 'عنوان عربي %' or page_title like 'emoji 🙂 %'");
check("awkward text (quotes, commas, newlines, Arabic, emoji) survived the round trip", edge.n > 400);
check("CHECK constraints are enforced on the restored table", await scratch.exec("insert into public.page_events(event_type, page_path) values ('page_view', repeat('x', 501))").then(() => false, () => true));

// ── 5. What the checks catch ─────────────────────────────────────────────────
const flipped = ndjson.replace("/synthetic/1\"", "/synthetic/2\"");
check("a flipped byte in the file is caught by the SHA-256 check before any load", await loadFrom(new PGlite(), flipped, manifest).then(() => false, (e) => /checksum/.test(e.message)));
const missing = ndjson.split("\n").filter(Boolean).slice(1).join("\n") + "\n";
check("a missing row is caught (checksum and count)", await loadFrom(new PGlite(), missing, manifest).then(() => false, (e) => /checksum|count/.test(e.message)));
check("loading the same file twice is refused by the primary key, never duplicated", await loadFrom(scratch, ndjson, manifest).then(() => false, () => true) && Number((await one(scratch, "select count(*)::int n from public.page_events")).n) === manifest.rows);

// ── 6. Delete with the migration's command, then recover from the file ──────
let deleted = 0;
for (let i = 0; i < 5; i++) { const res = await db.exec(CRON_COMMAND.replace(`interval '${WINDOW}'`, `interval '${WINDOW}'`)); const n = res[res.length - 1].affectedRows; deleted += n; if (!n) break; }
const left = Number((await one(db, "select count(*)::int n from public.page_events")).n);
check("the retention command removed exactly the eligible rows from the source (1,200 of 1,500)", deleted === 1200 && left === 300);
console.log(`INFO  ${stamp()}  source after deletion: ${left} rows; recovering from the export file`);
await loadFrom(db, ndjson, manifest);
const back = await one(db, logicalSql(elig));
check("after restoring from the export, the source's eligible rows are identical to the original (count and logical checksum)", back.n === src.n && back.m === src.m && Number((await one(db, "select count(*)::int n from public.page_events")).n) === total0);

rmSync(exportDir, { recursive: true, force: true });
check("the temporary export directory was removed", true);

console.log(fail ? `\n${fail} failure(s)` : `\nall ${total} checks passed (synthetic data only)`);
process.exit(fail ? 1 : 0);
