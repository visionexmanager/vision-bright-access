// 20261058 — a customer never sees a hold — executed against real PostgreSQL (PGlite).
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/vx-hide-reservations-scenarios.mjs
//
// There is no Docker or psql here, and no CI job runs the SQL. This applies the
// VX ledger migration, the metered settlement migrations when they are present,
// and 20261058 over minimal stubs, then proves with real calls that:
//
//   - settlement leaves ONE user_points row per request: the charge, labelled
//     "VX: <service>", or no row at all when nothing was kept;
//   - the balance is exactly what the old reserve + refund pair left;
//   - a hold older than the rule still gets its refund row;
//   - the admin ledger keeps reserved_vx and refunded_vx;
//   - my_vx_usage() and my_vx_summary() return neither.
//
// Prices below are TEST VALUES ONLY. Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const R = new URL("../../supabase/migrations/", import.meta.url);
const U = "00000000-0000-0000-0000-000000000001";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
  CREATE TABLE public.user_points (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, points integer NOT NULL DEFAULT 0, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.user_subscriptions (user_id uuid, plan_id text, status text, ends_at timestamptz, started_at timestamptz DEFAULT now());
  CREATE TABLE public.user_roles (user_id uuid, role text);
  CREATE FUNCTION public.has_role(_u uuid, _r text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
  CREATE TABLE public.billing_plans (id text PRIMARY KEY, name text, is_active boolean DEFAULT true, vx_credits_monthly integer, limits jsonb DEFAULT '{}');
  CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, trial_expires_at timestamptz);
  CREATE FUNCTION public.plan_for_user(_u uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'basic' $$;
`);
const metered = ["20261053000000_ai_usage_metering.sql", "20261054000000_ai_usage_metering_media.sql",
                 "20261055000000_vx_metered_settlement.sql"];
const haveMetered = metered.every((f) => existsSync(fileURLToPath(new URL(f, R))));
for (const f of ["20261023000000_vx_central_pricing_and_ledger.sql", ...(haveMetered ? metered : []),
                 "20261058000000_vx_hide_reservations.sql"]) {
  try { await db.exec(readFileSync(new URL(f, R), "utf8")); } catch (e) { throw new Error(`${f}: ${e.message}`); }
}

const q = async (s, p = []) => (await db.query(s, p)).rows;
const one = async (s, p) => (await q(s, p))[0];
await db.exec(`INSERT INTO auth.users VALUES ('${U}');
  INSERT INTO user_points(user_id, points, reason) VALUES ('${U}', 1000, 'grant');
  INSERT INTO billing_plans (id, name, vx_credits_monthly) VALUES ('basic', 'Basic', 5000);
  INSERT INTO central_pricing_registry (service_id, display_name, vx_price, enabled) VALUES ('fixed_test', 'Fixed', 5, true);`);

const bal = async () => (await one(`select vx_balance($1) b`, [U])).b;
const reserve = async (key, units = 1) => (await one(`select vx_reserve($1,'fixed_test','website',$2,$3) r`, [U, key, units])).r;
const settle = async (id, vx) => (await one(`select vx_settle($1,$2) r`, [id, vx])).r;
const release = async (id) => (await one(`select vx_release($1) r`, [id])).r;
const rows = async () => q(`select points, reason from user_points where user_id=$1 and reason <> 'grant' order by created_at, reason`, [U]);
const holdRows = async () => (await rows()).filter((r) => r.reason.startsWith("VX reserve") || r.reason.startsWith("VX refund"));
const ledger = async (id) => one(`select reserved_vx, consumed_vx, refunded_vx, status from vx_usage_ledger where id=$1`, [id]);
const clear = () => db.exec(`DELETE FROM user_points WHERE reason <> 'grant'; UPDATE user_points SET points = 1000;`);

let failures = 0;
const ok = (label, cond, extra = "") => { if (!cond) failures++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  " + extra : ""}`); };

// ── settle in full ──
let r = await reserve("k-full-000001", 2);
ok("a hold debits at once (10 of 1000)", r.ok && r.reserved_vx === 10 && await bal() === 990, JSON.stringify(r));
let s = await settle(r.reservation_id, null);
let pts = await rows();
ok("settled in full: one row, 'VX: fixed_test' -10", pts.length === 1 && pts[0].points === -10 && pts[0].reason === "VX: fixed_test", JSON.stringify(pts));
ok("...balance 990, as before", await bal() === 990);

// ── settle for part of the hold ──
await clear();
r = await reserve("k-part-000001", 2);
s = await settle(r.reservation_id, 3);
pts = await rows();
ok("settled for 3 of 10: one row -3, no refund row", pts.length === 1 && pts[0].points === -3 && (await holdRows()).length === 0, JSON.stringify(pts));
ok("...balance 997, as reserve -10 + refund +7 would leave", await bal() === 997);
const l = await ledger(r.reservation_id);
ok("...the admin ledger still records the hold and the refund", l.reserved_vx === 10 && l.consumed_vx === 3 && l.refunded_vx === 7, JSON.stringify(l));
ok("...the RPC still reports the refund to the calling function", s.refunded_vx === 7 && s.consumed_vx === 3, JSON.stringify(s));

// ── settle for nothing ──
await clear();
r = await reserve("k-zero-000001", 1);
s = await settle(r.reservation_id, 0);
ok("settled for 0: no row at all, balance 1000", (await rows()).length === 0 && await bal() === 1000, JSON.stringify(await rows()));

// ── release ──
await clear();
r = await reserve("k-rel-0000001", 1);
s = await release(r.reservation_id);
ok("released: no row at all, balance 1000", (await rows()).length === 0 && await bal() === 1000 && s.status === "failed", JSON.stringify(s));
ok("...ledger: failed, refunded 5", (await ledger(r.reservation_id)).refunded_vx === 5);

// ── replays change nothing ──
s = await release(r.reservation_id);
ok("release again: replay, balance unchanged", s.replayed === true && await bal() === 1000);
await clear();
r = await reserve("k-rep-0000001", 1);
await settle(r.reservation_id, 2);
s = await settle(r.reservation_id, 0);
ok("settle again: replay, still one row -2", s.replayed === true && (await rows()).length === 1 && await bal() === 998);

// ── two holds in one transaction for the same service and amount ──
await clear();
await db.exec(`BEGIN`);
const a = await reserve("k-twin-000001", 1), b = await reserve("k-twin-000002", 1);
await db.exec(`COMMIT`);
await settle(a.reservation_id, 4);
await release(b.reservation_id);
pts = await rows();
ok("twin holds: each settles its own row (one -4 row, no other)", pts.length === 1 && pts[0].points === -4 && await bal() === 996, JSON.stringify(pts));

// ── a hold from before the rule falls back to the refund row ──
await clear();
r = await reserve("k-legacy-0001", 2);
await db.exec(`UPDATE user_points SET created_at = created_at - interval '1 second' WHERE reason = 'VX reserve: fixed_test'`);
s = await settle(r.reservation_id, 3);
pts = await rows();
ok("legacy hold: reserve row kept, refund row +7 added", pts.length === 2 && pts.some((p) => p.points === 7 && p.reason === "VX refund: fixed_test"), JSON.stringify(pts));
ok("...balance 997 — the refund is never lost", await bal() === 997);
await clear();
r = await reserve("k-legacy-0002", 1);
await db.exec(`UPDATE user_points SET created_at = created_at - interval '1 second' WHERE reason = 'VX reserve: fixed_test'`);
await release(r.reservation_id);
ok("legacy hold released: refund row added, balance 1000", (await rows()).length === 2 && await bal() === 1000);

// ── the reaper ──
await clear();
r = await reserve("k-reap-000001", 1);
await db.exec(`UPDATE vx_usage_ledger SET created_at = created_at - interval '2 hours' WHERE id = '${r.reservation_id}';
               UPDATE user_points SET created_at = created_at - interval '2 hours' WHERE reason = 'VX reserve: fixed_test';`);
const reaped = (await one(`select vx_reap_stale_reservations() n`)).n;
ok("reaper: expires the hold and removes its row", reaped === 1 && (await rows()).length === 0 && await bal() === 1000);

// ── metered, when 20261053–55 are present ──
if (haveMetered) {
  await clear();
  await db.exec(`INSERT INTO central_pricing_registry (service_id, display_name, vx_price, enabled, pricing_mode, max_reserve_vx) VALUES ('chat_test', 'Chat test', 0, true, 'metered', 500);
                 INSERT INTO vx_conversion_policy (service_id, vx_per_usd) VALUES (NULL, 1000);`); // TEST VALUE ONLY
  r = (await one(`select vx_reserve_metered($1,'chat_test','website','k-metered-001',0.05) r`, [U])).r;
  await db.query(`insert into ai_usage_events(function_name,operation,provider,model,outcome,usage_source,cost_status,provider_cost_usd,reservation_id,usage)
                  values ('ai-chat','structured','openai','gpt-4.1','ok','reported','priced',0.0123,$1,'{"input_tokens":10}')`, [r.reservation_id]);
  s = (await one(`select vx_settle_metered($1) r`, [r.reservation_id])).r;
  pts = await rows();
  ok("metered: held 50, charged 13 — one row 'VX: chat_test' -13", pts.length === 1 && pts[0].points === -13 && pts[0].reason === "VX: chat_test", JSON.stringify(pts));
  ok("...balance 987", await bal() === 987);
} else {
  console.log("SKIP  metered path (20261053–55 not in this checkout)");
}

// ── what a customer can read ──
await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${U}'::uuid $$`);
const usage = await q(`select * from my_vx_usage(50, 0)`);
const cols = Object.keys(usage[0] ?? {});
ok("my_vx_usage: rows, with consumed_vx", usage.length > 0 && cols.includes("consumed_vx"), cols.join(","));
ok("my_vx_usage: no reserved_vx, refunded_vx, provider or cost", !cols.some((c) => /reserved|refunded|provider|cost/.test(c)), cols.join(","));
const summary = (await one(`select my_vx_summary() s`)).s;
ok("my_vx_summary: consumed and requests, no refund", summary.ok && "consumed_vx" in summary.today && !("refunded_vx" in summary.today) && !("refunded_vx" in summary.month), JSON.stringify(summary.today));

// ── grants ──
const can = async (role, fn) => (await one(`select has_function_privilege($1, $2, 'EXECUTE') x`, [role, fn])).x;
ok("vx_hold_points_row: service_role only", await can("service_role", "public.vx_hold_points_row(uuid)")
   && !(await can("authenticated", "public.vx_hold_points_row(uuid)")) && !(await can("anon", "public.vx_hold_points_row(uuid)")));
ok("vx_settle / vx_release: service_role only", await can("service_role", "public.vx_settle(uuid,integer,integer,text,numeric)")
   && !(await can("authenticated", "public.vx_settle(uuid,integer,integer,text,numeric)"))
   && await can("service_role", "public.vx_release(uuid,text,text)") && !(await can("authenticated", "public.vx_release(uuid,text,text)")));
ok("my_vx_usage / my_vx_summary: signed in, never anon", await can("authenticated", "public.my_vx_usage(integer,integer)")
   && !(await can("anon", "public.my_vx_usage(integer,integer)")) && await can("service_role", "public.my_vx_usage(integer,integer)")
   && await can("authenticated", "public.my_vx_summary()") && !(await can("anon", "public.my_vx_summary()")));

// ── the migration runs twice ──
try { await db.exec(readFileSync(new URL("20261058000000_vx_hide_reservations.sql", R), "utf8")); ok("re-runs cleanly", true); }
catch (e) { ok("re-runs cleanly", false, e.message); }

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
if (failures) process.exit(1);
