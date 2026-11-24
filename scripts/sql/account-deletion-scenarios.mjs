// 20261112 — account deletion, executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/account-deletion-scenarios.mjs
//
// Runs the migration twice over minimal stubs and drives every function: the
// request is idempotent, the 14 days hold, the reason survives the person, a
// returning address gets no free week, and nothing is callable by a browser.
// Exit status 1 on failure.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const mig = fs.readFileSync(new URL("../../supabase/migrations/20261112000000_account_deletion.sql", import.meta.url), "utf8");
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now());
 create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade, trial_expires_at timestamptz);
 create table public.whatsapp_identities(wa_phone text primary key, user_id uuid references auth.users(id), verified_at timestamptz);
 create function public.has_role(u uuid, r text) returns boolean language sql as $$ select false $$;
 create function public.trial_period_days() returns int language sql as $$ select 7 $$;
 create function public.profiles_anchor_trial() returns trigger language plpgsql as $$ begin return new; end $$;
 create trigger profiles_anchor_trial before insert on public.profiles for each row execute function public.profiles_anchor_trial();
`);
await db.exec(mig);
await db.exec(mig); // re-runnable
const q = async (s, p) => (await db.query(s, p)).rows;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

const [{ id: u1 }] = await q(`insert into auth.users(email) values ('A@Example.com') returning id`);
await q(`insert into public.profiles(user_id) values ($1)`, [u1]);
let [p] = await q(`select trial_expires_at > now() as live from public.profiles where user_id=$1`, [u1]);
ok(p.live, "new address gets the free week");

const r1 = (await q(`select public.request_account_deletion($1,'privacy','  because ','web') r`, [u1]))[0].r;
ok(r1.already === false, "request created");
const r2 = (await q(`select public.request_account_deletion($1,'other',null,'web') r`, [u1]))[0].r;
ok(r2.already === true && r2.request_id === r1.request_id, "second request is idempotent");
ok((await q(`select count(*)::int c from public.due_account_deletions(10)`))[0].c === 0, "not due inside 14 days");
ok((await q(`select public.cancel_account_deletion($1) b`, [u1]))[0].b === true, "cancel works");
ok((await q(`select public.account_deletion_status($1) s`, [u1]))[0].s === null, "no pending after cancel");
await q(`select public.request_account_deletion($1,'not_using','x','whatsapp')`, [u1]);
await q(`update public.account_deletion_requests set purge_after = now() - interval '1 minute' where status='pending'`);
const due = await q(`select * from public.due_account_deletions(10)`);
ok(due.length === 1, "due after 14 days");
await q(`select public.begin_account_purge($1)`, [due[0].request_id]);
await q(`delete from auth.users where id=$1`, [u1]);
await q(`select public.finish_account_purge($1,'completed')`, [due[0].request_id]);
const [row] = await q(`select user_id, email, status, reason_code from public.account_deletion_requests where id=$1`, [due[0].request_id]);
ok(row.user_id === null && row.email === null && row.status === "completed" && row.reason_code === "not_using", "reason survives the person, identity does not");

const [{ id: u2 }] = await q(`insert into auth.users(email) values (' a@example.COM ') returning id`);
await q(`insert into public.profiles(user_id) values ($1)`, [u2]);
[p] = await q(`select trial_expires_at > now() as live from public.profiles where user_id=$1`, [u2]);
ok(!p.live, "returning address gets NO free week");
const [{ id: u3 }] = await q(`insert into auth.users(email) values ('other@example.com') returning id`);
await q(`insert into public.profiles(user_id) values ($1)`, [u3]);
[p] = await q(`select trial_expires_at > now() as live from public.profiles where user_id=$1`, [u3]);
ok(p.live, "a different address still gets the week");
let bad = false; try { await q(`select public.request_account_deletion(gen_random_uuid(),'other',null)`); } catch { bad = true; }
ok(bad, "unknown user refused");
for (const fn of ["request_account_deletion(uuid,text,text,text)", "cancel_account_deletion(uuid)", "due_account_deletions(integer)", "begin_account_purge(uuid)", "finish_account_purge(uuid,text)"]) {
  const [g] = await q(`select has_function_privilege('anon', '${fn}', 'execute') a, has_function_privilege('authenticated', '${fn}', 'execute') u, has_function_privilege('service_role', '${fn}', 'execute') s`);
  ok(!g.a && !g.u && g.s, `${fn} is service-role only`);
}

// ── From WhatsApp: only a number linked by an emailed code may ask ──
const [{ id: w1 }] = await q(`insert into auth.users(email) values ('wa@example.com') returning id`);
await q(`insert into public.whatsapp_identities values ('111', $1, now()), ('222', $1, null), ('333', null, null)`, [w1]);
const bad1 = (await q(`select public.whatsapp_request_account_deletion('222','other') r`))[0].r;
const bad2 = (await q(`select public.whatsapp_request_account_deletion('333','other') r`))[0].r;
const bad3 = (await q(`select public.whatsapp_request_account_deletion('999','other') r`))[0].r;
ok(bad1.error === "not_linked" && bad2.error === "not_linked" && bad3.error === "not_linked", "unverified, unlinked and unknown numbers are refused");
const wr = (await q(`select public.whatsapp_request_account_deletion('111','too_expensive') r`))[0].r;
ok(!wr.error && wr.already === false && wr.email === "wa@example.com", "a linked number files the request");
const [wrow] = await q(`select channel, reason_code from public.account_deletion_requests where id=$1`, [wr.request_id]);
ok(wrow.channel === "whatsapp" && wrow.reason_code === "too_expensive", "the channel and reason are recorded");
ok((await q(`select public.whatsapp_cancel_account_deletion('111') r`))[0].r.cancelled === true, "a linked number cancels it");
ok((await q(`select public.whatsapp_cancel_account_deletion('111') r`))[0].r.cancelled === false, "cancelling twice says nothing was pending");
ok((await q(`select public.whatsapp_cancel_account_deletion('333') r`))[0].r.error === "not_linked", "an unlinked number cannot cancel");
for (const fn of ["whatsapp_request_account_deletion(text,text,text)", "whatsapp_cancel_account_deletion(text)"]) {
  const [g] = await q(`select has_function_privilege('anon', '${fn}', 'execute') a, has_function_privilege('authenticated', '${fn}', 'execute') u, has_function_privilege('service_role', '${fn}', 'execute') s`);
  ok(!g.a && !g.u && g.s, `${fn} is service-role only`);
}
