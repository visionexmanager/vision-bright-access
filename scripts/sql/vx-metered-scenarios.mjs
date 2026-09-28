// The metered VX money rules, executed against real PostgreSQL (PGlite).
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/vx-metered-scenarios.mjs
//
// There is no Docker or psql here, and no CI job runs the SQL, so this is how
// vx_reserve_metered / vx_settle_metered / the readiness view are proven: the
// VX ledger migration and the metering migrations are applied over minimal
// stubs of what they reference, and each money rule is driven with real calls.
// The conversion rate below (1000 VX per USD) is a TEST VALUE ONLY — nothing
// here proposes a price.
//
// Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../../supabase/migrations/", import.meta.url);
async function boot() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE public.user_points (id bigserial PRIMARY KEY, user_id uuid NOT NULL, points integer NOT NULL, reason text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.user_subscriptions (user_id uuid, plan_id text, status text, ends_at timestamptz, started_at timestamptz DEFAULT now());
    CREATE TABLE public.user_roles (user_id uuid, role text);
    CREATE FUNCTION public.has_role(_u uuid, _r text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
  `);
  for (const f of ["20261023000000_vx_central_pricing_and_ledger.sql", "20261053000000_ai_usage_metering.sql",
                   "20261054000000_ai_usage_metering_media.sql", "20261055000000_vx_metered_settlement.sql"]) {
    try { await db.exec(readFileSync(new URL(f, R), "utf8")); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  return db;
}

const db = await boot();
const q = async (s, p = []) => (await db.query(s, p)).rows;
const one = async (s, p) => (await q(s, p))[0];
const U = "00000000-0000-0000-0000-000000000001", V = "00000000-0000-0000-0000-000000000002", P = "00000000-0000-0000-0000-000000000003";
await db.exec(`INSERT INTO auth.users VALUES ('${U}'),('${V}'),('${P}');
  INSERT INTO user_points(user_id, points) VALUES ('${U}', 1000), ('${V}', 10), ('${P}', 1000);
  INSERT INTO central_pricing_registry (service_id, display_name, vx_price, enabled, pricing_mode, max_reserve_vx) VALUES ('chat_test', 'Chat test', 0, true, 'metered', 500);
  INSERT INTO central_pricing_registry (service_id, display_name, vx_price, enabled) VALUES ('fixed_test', 'Fixed', 5, true);`);
const bal = async (u = U) => (await one(`select vx_balance($1) b`, [u])).b;
const reserve = async (key, cost, u = U, svc = "chat_test") => (await one(`select vx_reserve_metered($1,$2,'website',$3,$4) r`, [u, svc, key, cost])).r;
const settle = async (id) => (await one(`select vx_settle_metered($1) r`, [id])).r;
const event = async (rid, outcome, status, cost, source = "reported") => db.query(
  `insert into ai_usage_events(function_name,operation,provider,model,outcome,usage_source,cost_status,provider_cost_usd,reservation_id,usage)
   values ('ai-chat','structured','openai','gpt-4.1',$1,$2,$3,$4,$5,'{"input_tokens":10}')`, [outcome, source, status, cost, rid]);
let failures = 0;
const ok = (label, cond, extra = "") => { if (!cond) failures++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  " + extra : ""}`); };

ok("no policy: conversion_not_configured, nothing held", (await reserve("key-nopolicy-1", 0.05)).error === "conversion_not_configured" && await bal() === 1000);
await db.exec(`INSERT INTO vx_conversion_policy (service_id, vx_per_usd) VALUES (NULL, 1000)`); // TEST VALUE ONLY

ok("fixed-mode service refuses a metered reserve", (await reserve("key-fixed-001", 0.05, U, "fixed_test")).error === "service_not_metered");
ok("idempotency key required", (await reserve(null, 0.05)).error === "idempotency_key_required");

let r = await reserve("req-success-01", 0.05);
ok("1 success: holds ceil(0.05 x 1000) = 50", r.ok && r.reserved_vx === 50 && await bal() === 950, JSON.stringify(r));
await event(r.reservation_id, "ok", "priced", 0.0123);
let s = await settle(r.reservation_id);
ok("1 success: charges ceil(12.3) = 13, refunds 37", s.consumed_vx === 13 && s.refunded_vx === 37 && await bal() === 987, JSON.stringify(s));

s = await settle(r.reservation_id);
ok("14 settle again: replay, balance unchanged", s.replayed === true && await bal() === 987);

r = await reserve("req-success-01", 0.05);
ok("11 duplicate key after settlement: replayed, no second hold", r.replayed === true && r.status === "settled" && await bal() === 987);

r = await reserve("req-failure-01", 0.05);
await event(r.reservation_id, "error", "no_usage", null, "missing");
s = await settle(r.reservation_id);
ok("3 provider failure: released in full", s.status === "failed" && await bal() === 987, JSON.stringify(s));

r = await reserve("req-fallback-1", 0.05);
await event(r.reservation_id, "error", "no_usage", null, "missing");
await event(r.reservation_id, "ok", "priced", 0.002);
s = await settle(r.reservation_id);
ok("4 fallback: charges the answer only (2 VX)", s.consumed_vx === 2 && await bal() === 985, JSON.stringify(s));

r = await reserve("req-failbill-1", 0.05);
await event(r.reservation_id, "error", "priced", 0.004, "estimated");
await event(r.reservation_id, "ok", "priced", 0.002);
s = await settle(r.reservation_id);
ok("failed attempt that used tokens: NOT billed by default", s.consumed_vx === 2 && await bal() === 983);
await db.exec(`UPDATE vx_conversion_policy SET bill_failed_billable_attempts = true`);
r = await reserve("req-failbill-2", 0.05);
await event(r.reservation_id, "error", "priced", 0.004, "estimated");
await event(r.reservation_id, "ok", "priced", 0.002);
s = await settle(r.reservation_id);
ok("...billed only when the policy says so (6 VX)", s.consumed_vx === 6 && await bal() === 977);
await db.exec(`UPDATE vx_conversion_policy SET bill_failed_billable_attempts = false`);

r = await reserve("req-zero-0001", 0.05);
await event(r.reservation_id, "ok", "priced", 0);
s = await settle(r.reservation_id);
ok("6 zero usage: 0 charged, hold returned", s.consumed_vx === 0 && await bal() === 977);

r = await reserve("req-missing-01", 0.05);
await event(r.reservation_id, "ok", "no_usage", null, "missing");
await event(r.reservation_id, "ok", "unpriced", null, "reported");
s = await settle(r.reservation_id);
const meta = (await one(`select metadata from vx_usage_ledger where id=$1`, [r.reservation_id])).metadata;
ok("7 missing / unpriced usage: released, the gap counted in metadata", s.status === "failed" && await bal() === 977 && meta.unpriced_billable_attempts === 1, JSON.stringify(meta));

r = await reserve("req-partial-01", 0.05);
await event(r.reservation_id, "error", "priced", 0.003, "estimated");
s = await settle(r.reservation_id);
ok("8 partial (stream cut, estimated): released by default", s.status === "failed" && await bal() === 977);

r = await reserve("req-clamp-001", 0.01);
await event(r.reservation_id, "ok", "priced", 0.5);
s = await settle(r.reservation_id);
ok("actual cost above the hold: charges only the hold (10)", s.consumed_vx === 10 && s.refunded_vx === 0 && await bal() === 967, JSON.stringify(s));

r = await reserve("req-expensive1", 1.0);
ok("9 very expensive: over_reserve_cap, nothing held", r.error === "over_reserve_cap" && await bal() === 967, JSON.stringify(r));

r = await reserve("req-free-00001", 0.001);
await event(r.reservation_id, "ok", "free", 0);
s = await settle(r.reservation_id);
ok("10 free model: 0 charged", s.consumed_vx === 0 && await bal() === 967);

r = await reserve("req-poor-00001", 0.05, V);
ok("13 insufficient VX: refused, no debit", r.error === "insufficient_vx" && await bal(V) === 10, JSON.stringify(r));

r = await reserve("req-success-01", 0.05, P);
ok("a key already used by another user: refused, no debit", r.error === "idempotency_key_conflict" && await bal(P) === 1000);

const open = await one(`select count(*)::int n from vx_usage_ledger where status='reserved'`);
const within = await one(`select bool_and(consumed_vx + refunded_vx <= reserved_vx) ok from vx_usage_ledger`);
const sum = await one(`select (select coalesce(sum(points),0) from user_points where user_id=$1)::int b, (select coalesce(sum(consumed_vx),0) from vx_usage_ledger where user_id=$1)::int c`, [U]);
ok("no hold left open; consumed + refunded <= reserved everywhere", open.n === 0 && within.ok === true);
ok("balance = starting 1000 minus everything consumed (no double charge anywhere)", sum.b === 1000 - sum.c, JSON.stringify(sum));

for (const role of ["anon", "authenticated"]) {
  await db.exec(`SET ROLE ${role}`);
  let refused = 0;
  for (const s2 of [`select vx_reserve_metered('${U}','chat_test','website','abcdefgh12',0.01)`, `select vx_settle_metered(gen_random_uuid())`, `select * from vx_conversion_policy`, `select * from ai_model_readiness`, `select * from ai_model_checks`, `select vx_metered_charge('chat_test', 1)`]) {
    try { await db.query(s2); } catch { refused++; }
  }
  await db.exec(`RESET ROLE`);
  ok(`${role}: every metered RPC, table and view refused`, refused === 6, `${refused}/6`);
}

// readiness: priced, reported usage and a recent passing check — all three
await db.exec(`insert into ai_usage_events(function_name,operation,provider,model,outcome,usage_source,cost_status,provider_cost_usd) values ('ai-chat','structured','openai','gpt-4o-mini','ok','reported','priced',0.001)`);
let ready = await one(`select production_ready, usage_reported, live_check_passed from ai_model_readiness where model_id='gpt-4o-mini'`);
ok("readiness: priced + reported usage but no live check is NOT ready", ready.production_ready === false && ready.usage_reported === true);
await db.exec(`insert into ai_model_checks(provider,model_id,check_name,passed) values ('openai','gpt-4o-mini','stream_usage',true)`);
ready = await one(`select production_ready from ai_model_readiness where model_id='gpt-4o-mini'`);
ok("readiness: with a passing live check it is ready", ready.production_ready === true);
await db.exec(`insert into ai_model_checks(provider,model_id,check_name,passed) values ('openai','gpt-4o-mini','stream_usage',false)`);
ready = await one(`select production_ready from ai_model_readiness where model_id='gpt-4o-mini'`);
ok("readiness: a later failing check makes it not ready", ready.production_ready === false);
const unpriced = await one(`select count(*)::int n from ai_model_readiness where model_id='gemini-flash-lite-latest'`);
ok("readiness: a model with no price is not even listed", unpriced.n === 0);

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
if (failures) process.exit(1);
