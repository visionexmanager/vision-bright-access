// Monthly realtime-minute allowance (migration 20261077), executed in PGlite
// against the real plan_for_user (20261063) and the real new migration.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/realtime-minutes-scenarios.mjs
//
// Asserts: no cap configured changes nothing and records nothing; a cap
// reserves, refuses at the limit, and shrinks a reservation to the SERVER's
// clock (the client's own duration is not an input); a failed provider session
// costs nothing; months are UTC and independent; users are independent; a
// non-owner cannot end someone else's session; turning the cap off again
// restores today's behaviour; concurrent reservations cannot oversell; the
// tables and functions are not reachable by anon/authenticated. Ends with a
// mutation proof. Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const NEW = "supabase/migrations/20261077000000_realtime_monthly_minutes.sql";

async function fresh(migrationText) {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  `);
  await db.exec(MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n"));
  await db.exec(migrationText);
  await db.exec(migrationText); // re-runnable
  return db;
}

const text = readFileSync(NEW, "utf8").replace(/\r\n/g, "\n");
const db = await fresh(text);

let fail = 0, total = 0;
const expect = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const reserve = async (id) => (await one("select public.realtime_reserve($1) v", [id])).v;
const end = async (id, rid, failed = false) => (await one("select public.realtime_end($1,$2,$3) v", [id, rid, failed])).v;
const rows = async (id) => Number((await one("select count(*)::int n from public.realtime_sessions where user_id=$1", [id])).n);
const setCap = (plan, patch) => db.exec(`UPDATE public.billing_plans SET limits = limits || '${JSON.stringify(patch)}'::jsonb WHERE id='${plan}'`);
const clearCap = (plan) => db.exec(`UPDATE public.billing_plans SET limits = limits - 'realtime_monthly_minutes' - 'realtime_session_minutes' WHERE id='${plan}'`);

for (let i = 1; i <= 8; i++) await db.exec(`INSERT INTO auth.users VALUES ('${u(i)}')`);
for (const i of [1, 2, 3, 5, 6]) {
  await db.exec(`INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(i)}','pro','active', now() + interval '30 days')`);
}
await db.exec(`INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(4)}','basic','active', now() + interval '30 days')`);
await db.exec(`INSERT INTO public.user_roles VALUES ('${u(7)}','admin')`);

// ── 1. The migration sets no value: applying it changes nothing ──
const noKeys = (await db.query("select id from public.billing_plans where limits ? 'realtime_monthly_minutes'")).rows;
expect("the migration configures no plan (no realtime_monthly_minutes key anywhere)", noKeys.length === 0);
let r = await reserve(u(1));
expect("no cap → allowed, uncapped", r.allowed === true && r.capped === false);
expect("no cap → nothing recorded", (await rows(u(1))) === 0);

// ── 2. A cap reserves, and refuses at the limit ──
await setCap("pro", { realtime_monthly_minutes: 25 });
r = await reserve(u(1));
expect("cap 25, session default 10 → first session reserves 10, 15 left", r.allowed && r.capped && r.reserved_minutes === 10 && r.remaining_minutes === 15);
const first = r.reservation_id;
r = await reserve(u(1));
expect("second session reserves 10, 5 left", r.allowed && r.reserved_minutes === 10 && r.remaining_minutes === 5);
r = await reserve(u(1));
expect("third session reserves only what is left (5), 0 after", r.allowed && r.reserved_minutes === 5 && r.remaining_minutes === 0);
r = await reserve(u(1));
expect("fourth is refused: monthly_limit, nothing recorded", r.allowed === false && r.reason === "monthly_limit" && (await rows(u(1))) === 3);

// ── 3. Ending shrinks the reservation to the SERVER's clock ──
await db.exec(`UPDATE public.realtime_sessions SET started_at = now() - interval '3 minutes 20 seconds' WHERE id = '${first}'`);
let e = await end(u(1), first);
expect("ended after 3m20s of server time → counts 4 minutes (rounded up), not 10", e.ended === true && e.minutes === 4);
expect("ending twice is a no-op (a client cannot re-open and re-shrink)", (await end(u(1), first)).ended === false);
r = await reserve(u(1));
expect("the 6 refunded minutes are available again (reserves 6)", r.allowed && r.reserved_minutes === 6 && r.remaining_minutes === 0);

// ── 4. The client's duration is not an input; a lying end cannot erase time ──
await db.exec(`UPDATE public.realtime_sessions SET started_at = now() - interval '9 minutes' WHERE id = (SELECT id FROM public.realtime_sessions WHERE user_id='${u(1)}' AND ended_at IS NULL ORDER BY started_at LIMIT 1)`);
const lyingId = (await one(`SELECT id FROM public.realtime_sessions WHERE user_id='${u(1)}' AND ended_at IS NULL ORDER BY started_at LIMIT 1`)).id;
e = await end(u(1), lyingId);
expect("session that really ran 9 minutes and 'ends' now still counts ~9-10 (cannot be reported as 0)", e.minutes >= 9);
expect("realtime_end takes no duration argument at all",
  (await db.query("select pronargs from pg_proc where proname='realtime_end'")).rows[0].pronargs === 3);

// ── 5. A session never reported stays charged in full ──
const before = await one(`select sum(public.realtime_session_minutes_used(reserved_minutes, started_at, ended_at))::int m from public.realtime_sessions where user_id='${u(1)}'`);
expect("an unreported reservation counts its full reservation", before.m >= 20);

// ── 6. A failed provider session costs nothing ──
await setCap("pro", { realtime_monthly_minutes: 10 });
r = await reserve(u(2));
expect("fresh user, cap 10 → reserves 10", r.reserved_minutes === 10);
e = await end(u(2), r.reservation_id, true);
expect("provider refused (failed=true) → costs 0 minutes", e.ended === true && e.minutes === 0);
r = await reserve(u(2));
expect("…and the full 10 minutes are available again", r.allowed && r.reserved_minutes === 10);

// ── 7. Ownership ──
const otherId = r.reservation_id;
e = await end(u(3), otherId);
expect("another user cannot end someone else's reservation", e.ended === false);
expect("…and it stays open", (await one("select ended_at from public.realtime_sessions where id=$1", [otherId])).ended_at === null);

// ── 8. Months are UTC and independent ──
await db.exec(`INSERT INTO public.realtime_sessions (user_id, started_at, reserved_minutes) VALUES ('${u(5)}', date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc' - interval '1 second', 10)`);
r = await reserve(u(5));
expect("a reservation from the last second of last month does not count", r.allowed && r.reserved_minutes === 10);
await db.exec(`INSERT INTO public.realtime_sessions (user_id, started_at, reserved_minutes) VALUES ('${u(6)}', date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc', 10)`);
r = await reserve(u(6));
expect("a reservation from the first second of this month does count (cap 10 → refused)", r.allowed === false);

// ── 9. Users and plans are independent ──
r = await reserve(u(4));
expect("a basic user on a plan with no cap is unaffected by pro's cap", r.allowed && r.capped === false);
await setCap("basic", { realtime_monthly_minutes: 0 });
r = await reserve(u(4));
expect("cap 0 means no realtime voice on that plan", r.allowed === false && r.reason === "monthly_limit");

// ── 10. A configurable session length ──
await setCap("pro", { realtime_monthly_minutes: 100, realtime_session_minutes: 3 });
r = await reserve(u(5));
expect("realtime_session_minutes=3 → a session reserves 3", r.reserved_minutes === 3);

// ── 11. Admins are exempt; a user with no plan is not capped (the gate already refused them) ──
await setCap("pro", { realtime_monthly_minutes: 1 });
r = await reserve(u(7));
expect("admin → allowed, uncapped", r.allowed && r.capped === false);
r = await reserve(u(8));
expect("no plan (the subscription gate refuses them before this) → not capped here", r.allowed && r.capped === false);

// ── 12. Garbage settings fail towards no cap, not towards a crash ──
await db.exec(`UPDATE public.billing_plans SET limits = limits || '{"realtime_monthly_minutes":"lots"}'::jsonb WHERE id='pro'`);
r = await reserve(u(3));
expect("non-numeric cap → treated as no cap", r.allowed && r.capped === false);

// ── 13. Turning the cap off restores today's behaviour ──
await clearCap("pro");
const before13 = await rows(u(3));
r = await reserve(u(3));
expect("cap removed → allowed, uncapped, nothing recorded", r.allowed && r.capped === false && (await rows(u(3))) === before13);

// ── 14. Concurrent reservations cannot oversell ──
await setCap("pro", { realtime_monthly_minutes: 30 });
await db.exec(`INSERT INTO auth.users VALUES ('${u(9)}')`);
await db.exec(`INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(9)}','pro','active', now() + interval '30 days')`);
const results = await Promise.all(Array.from({ length: 8 }, () => reserve(u(9))));
const granted = results.filter((x) => x.allowed).reduce((s, x) => s + x.reserved_minutes, 0);
expect(`8 simultaneous requests against 30 minutes grant exactly 30 (granted ${granted}; PGlite is single-connection, so this proves the arithmetic, the advisory lock is the same pattern as check_ai_rate_limit)`, granted === 30);

// ── 15. Privileges ──
const acl = async (obj, role) => (await one(`select has_function_privilege('${role}', '${obj}', 'EXECUTE') v`)).v;
for (const fn of ["public.realtime_reserve(uuid)", "public.realtime_end(uuid,uuid,boolean)"]) {
  expect(`${fn}: anon and authenticated cannot execute`, !(await acl(fn, "anon")) && !(await acl(fn, "authenticated")));
  expect(`${fn}: service_role can`, await acl(fn, "service_role"));
}
const tabAcl = async (role) => (await one(`select has_table_privilege('${role}', 'public.realtime_sessions', 'SELECT') v`)).v;
expect("realtime_sessions: anon and authenticated cannot read it", !(await tabAcl("anon")) && !(await tabAcl("authenticated")));
expect("realtime_sessions: row-level security is on", (await one("select relrowsecurity v from pg_class where oid='public.realtime_sessions'::regclass")).v === true);

// ── 16. Mutation proof: a broken month boundary must turn a check red ──
const mutated = text.replace("started_at >= _month", "true");
const mdb = await fresh(mutated);
await mdb.exec(`INSERT INTO auth.users VALUES ('${u(1)}')`);
await mdb.exec(`INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(1)}','pro','active', now() + interval '30 days')`);
await mdb.exec(`UPDATE public.billing_plans SET limits = limits || '{"realtime_monthly_minutes":10}'::jsonb WHERE id='pro'`);
await mdb.exec(`INSERT INTO public.realtime_sessions (user_id, started_at, reserved_minutes) VALUES ('${u(1)}', now() - interval '40 days', 10)`);
const mr = (await mdb.query("select public.realtime_reserve($1) v", [u(1)])).rows[0].v;
expect("MUTATION: with the month filter removed, last month's session wrongly blocks (the real test above would go red)", mr.allowed === false);

console.log(`\n${total - fail}/${total} passed`);
process.exit(fail ? 1 : 0);
