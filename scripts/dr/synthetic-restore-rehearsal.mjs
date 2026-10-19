// Synthetic restore rehearsal, run entirely in memory (PGlite). No network, no
// credentials, no production data.
//
//   npm i --no-save @electric-sql/pglite @electric-sql/pglite-tools
//   node scripts/dr/synthetic-restore-rehearsal.mjs
//
// Rehearses the logical-backup path in docs/audit/VISIONEX_BACKUP_RESTORE_RUNBOOK.md
// on invented rows: replay the migrations into a source database, insert synthetic
// users/points/wallets/subscriptions, take a data-only dump of those tables plus
// auth.users, encrypt it (AES-256-GCM with a throwaway key), prove a flipped byte
// is detected, decrypt, restore into a SECOND database that got its schema from the
// same migrations, and compare per-table row counts, content hashes, RLS/policy/
// function counts. Prints the measured times.
//
// What it does NOT prove: that pg_dump / the Supabase pooler / Storage export work
// against the real platform, that auth.users restores with its real columns, or any
// recovery time on production. A whole-schema pg_dump of the 445 replayed tables
// did not finish in PGlite within 280 s, so only data is dumped here; schema comes
// from the migrations, which is also what the runbook prescribes (step C3).
import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { readdirSync, readFileSync } from "node:fs";
const dir = process.argv[2] ?? "supabase/migrations";
const STUB = `
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
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`;
const t0 = Date.now();
const src = new PGlite(); await src.exec(STUB);
let ok = 0; for (const f of readdirSync(dir).filter(x=>x.endsWith(".sql")).sort()) { try { await src.exec(readFileSync(`${dir}/${f}`,"utf8")); ok++; } catch {} }
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
await src.exec(`insert into auth.users(id,email) values ('${U(1)}','a@example.test'),('${U(2)}','b@example.test') on conflict do nothing;
 delete from public.user_points where user_id in ('${U(1)}','${U(2)}'); delete from public.credit_wallets where user_id in ('${U(1)}','${U(2)}'); delete from public.user_subscriptions where user_id in ('${U(1)}','${U(2)}');
 insert into public.user_points(user_id,points,reason) values ('${U(1)}',10,'seed'),('${U(2)}',20,'seed'),('${U(2)}',-5,'seed2');
 insert into public.credit_wallets(user_id,balance_vx) values ('${U(1)}',100),('${U(2)}',200);
 insert into public.user_subscriptions(user_id,plan_id,status) values ('${U(1)}','basic','active'),('${U(2)}','pro','active');`);
const fp = async (db) => {
  const tabs = (await db.query(`select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`)).rows.map(r=>r.t);
  const counts = {}; for (const t of tabs) counts[t] = Number((await db.query(`select count(*) c from public."${t}"`)).rows[0].c);
  const sum = async (q) => (await db.query(q)).rows[0].v;
  return { tabs: tabs.length, counts,
    pointsHash: await sum(`select md5(string_agg(user_id||':'||points||':'||reason, ',' order by user_id,points,reason)) v from public.user_points`),
    walletHash: await sum(`select md5(string_agg(user_id||':'||balance_vx, ',' order by user_id)) v from public.credit_wallets`),
    rls: await sum(`select count(*) v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity`),
    policies: await sum(`select count(*) v from pg_policies where schemaname='public'`),
    funcs: await sum(`select count(*) v from pg_proc where pronamespace='public'::regnamespace`) };
};
const before = await fp(src);
console.log("source ready: migrations applied", ok, "tables", before.tabs, "ms", Date.now()-t0);
const t1 = Date.now();
const dump = await pgDump({ pg: src, args: ["--data-only", "-t", "auth.users", "-t", "public.user_points", "-t", "public.credit_wallets", "-t", "public.user_subscriptions"] });
const sql = await dump.text();
console.log("dump bytes", sql.length, "ms", Date.now()-t1);
// encrypt / decrypt round trip with a throwaway key
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const key = randomBytes(32) /* throwaway, never saved */, iv = randomBytes(12);
const c = createCipheriv("aes-256-gcm", key, iv); const enc = Buffer.concat([c.update(sql,"utf8"), c.final()]); const tag = c.getAuthTag();
const d = createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag); const plain = Buffer.concat([d.update(enc), d.final()]).toString("utf8");
console.log("encrypt/decrypt identical:", plain === sql);
const bad = Buffer.from(enc); bad[10] ^= 1; let tamper = "undetected"; try { const d2 = createDecipheriv("aes-256-gcm", key, iv); d2.setAuthTag(tag); Buffer.concat([d2.update(bad), d2.final()]); } catch { tamper = "detected"; }
console.log("tampered ciphertext:", tamper);
const t2 = Date.now();
const dst = new PGlite(); await dst.exec(STUB); for (const f of readdirSync(dir).filter(x=>x.endsWith(".sql")).sort()) { try { await dst.exec(readFileSync(`${dir}/${f}`,"utf8")); } catch {} } await dst.exec("delete from public.user_points; delete from public.credit_wallets; delete from public.user_subscriptions; delete from auth.users");
let restoreErr = null; try { await dst.exec(plain); } catch (e) { restoreErr = e.message.split("\n")[0]; }
console.log("restore", restoreErr ? "ERROR: " + restoreErr : "ok", "ms", Date.now()-t2);
if (restoreErr || plain !== sql || tamper !== "detected") process.exitCode = 1;
if (!restoreErr) {
  const after = await fp(dst);
  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log("fingerprints identical:", same);
  if (!same) process.exitCode = 1;
  if (!same) { for (const k of Object.keys(before)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) console.log(" differs:", k, JSON.stringify(before[k]).slice(0,200), "=>", JSON.stringify(after[k]).slice(0,200)); }
}
