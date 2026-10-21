// The monthly realtime-minute allowance (migration 20261077) under REAL concurrency: a real
// Postgres server and many separate connections. realtime-minutes-scenarios.mjs runs in PGlite,
// which is one connection, so it cannot race; this can.
//
//   npm i --no-save embedded-postgres pg
//   node scripts/sql/realtime-minutes-concurrency.mjs
//
// Asserts: simultaneous reservations for one user never reserve more than the cap, every
// refusal is a clean monthly_limit, other users are unaffected, ending a reservation from many
// connections at once ends it exactly once, and a reserve racing an end never leaves the user
// over the cap. Writes only to a throwaway database. Exit status 1 on any failure.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const NEW = process.env.RT_MIGRATION ?? "supabase/migrations/20261077000000_realtime_monthly_minutes.sql";
const migration = [...MIGRATIONS, NEW].map((f) => readFileSync(f, "utf8")).join("\n");

const dir = mkdtempSync(join(tmpdir(), "rt-pg-"));
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: 54391, persistent: false, onLog: () => {}, onError: () => {}, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
await server.initialise();
await server.start();

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

try {
  const admin = new pg.Client({ host: "127.0.0.1", port: 54391, user: "postgres", password: "pw", database: "postgres" });
  await admin.connect();
  await admin.query(STUBS);
  await admin.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  `);
  await admin.query(migration);
  await admin.query(readFileSync(NEW, "utf8")); // re-runnable
  console.log(`real PostgreSQL ${(await admin.query("show server_version")).rows[0].server_version}, migration applied twice`);

  for (let i = 1; i <= 6; i++) await admin.query("INSERT INTO auth.users VALUES ($1)", [u(i)]);
  for (const i of [1, 2, 3, 4, 5, 6]) {
    await admin.query("INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ($1,'pro','active', now() + interval '30 days')", [u(i)]);
  }

  const CONNS = 12;
  const clients = await Promise.all(Array.from({ length: CONNS }, async () => {
    const c = new pg.Client({ host: "127.0.0.1", port: 54391, user: "postgres", password: "pw", database: "postgres" });
    await c.connect();
    await c.query("SET ROLE service_role");
    return c;
  }));
  const pids = new Set(await Promise.all(clients.map(async (c) => (await c.query("select pg_backend_pid() p")).rows[0].p)));
  expect(`${CONNS} distinct backend connections`, pids.size === CONNS);

  const reserve = (c, id) => c.query("select public.realtime_reserve($1) v", [id]).then((r) => r.rows[0].v);
  const reserved = async (id) => Number((await admin.query(
    "select coalesce(sum(public.realtime_session_minutes_used(reserved_minutes, started_at, ended_at)),0)::int m from public.realtime_sessions where user_id=$1", [id])).rows[0].m);

  // With no cap configured, nothing is recorded however many ask at once.
  const none = await Promise.all(clients.map((c) => reserve(c, u(1))));
  expect("no cap configured: every simultaneous request allowed, uncapped", none.every((v) => v.allowed === true && v.capped === false));
  expect("no cap configured: nothing recorded", (await admin.query("select count(*)::int n from public.realtime_sessions")).rows[0].n === 0);

  // Cap 25, session 10: exactly 10 + 10 + 5 can be handed out, whatever the interleaving.
  await admin.query(`UPDATE public.billing_plans SET limits = limits || '{"realtime_monthly_minutes":25}'::jsonb WHERE id='pro'`);
  let badRounds = 0;
  const ROUNDS = 40;
  for (let round = 0; round < ROUNDS; round++) {
    const user = u(2 + (round % 4));
    await admin.query("DELETE FROM public.realtime_sessions WHERE user_id=$1", [user]);
    const verdicts = await Promise.all(clients.map((c) => reserve(c, user)));
    const allowed = verdicts.filter((v) => v.allowed === true);
    const refused = verdicts.filter((v) => v.allowed === false);
    const total = allowed.reduce((s, v) => s + v.reserved_minutes, 0);
    const okRefusals = refused.every((v) => v.reason === "monthly_limit");
    if (allowed.length !== 3 || total !== 25 || refused.length !== CONNS - 3 || !okRefusals || (await reserved(user)) !== 25) badRounds++;
  }
  expect(`${ROUNDS} rounds x ${CONNS} simultaneous reservations: always exactly 3 allowed (10+10+5 = 25), the rest monthly_limit`, badRounds === 0);

  // Another user is not affected by one user's exhausted month.
  await Promise.all(clients.map((c) => reserve(c, u(2))));
  const other = await reserve(clients[0], u(6));
  expect("a different user still gets a full first session", other.allowed === true && other.reserved_minutes === 10);

  // Ending: many connections end the same reservation at once; exactly one wins.
  await admin.query("DELETE FROM public.realtime_sessions WHERE user_id=$1", [u(5)]);
  const id = (await reserve(clients[1], u(5))).reservation_id;
  expect("a reservation to end exists", typeof id === "string");
  const ends = await Promise.all(clients.map((c) => c.query("select public.realtime_end($1,$2,false) v", [u(5), id]).then((r) => r.rows[0].v)));
  expect("12 simultaneous ends of one reservation: exactly one reports ended", ends.filter((e) => e.ended === true).length === 1);
  const foreign = await clients[2].query("select public.realtime_end($1,$2,false) v", [u(4), id]).then((r) => r.rows[0].v);
  expect("another user cannot end it (and it is already ended anyway)", foreign.ended === false);

  // A reserve racing an end can never push the month over the cap.
  let overs = 0;
  for (let round = 0; round < 25; round++) {
    const user = u(3);
    await admin.query("DELETE FROM public.realtime_sessions WHERE user_id=$1", [user]);
    const first = (await reserve(clients[0], user)).reservation_id;
    await admin.query("UPDATE public.realtime_sessions SET started_at = now() - interval '4 minutes' WHERE id=$1", [first]);
    await Promise.all([
      ...clients.slice(0, 6).map((c) => reserve(c, user)),
      ...clients.slice(6).map((c) => c.query("select public.realtime_end($1,$2,false) v", [user, first])),
    ]);
    if ((await reserved(user)) > 25) overs++;
  }
  expect("25 rounds of reservations racing an end: the month never exceeds the cap (25)", overs === 0);

  // The functions answer only to service_role.
  const anon = new pg.Client({ host: "127.0.0.1", port: 54391, user: "postgres", password: "pw", database: "postgres" });
  await anon.connect();
  await anon.query("SET ROLE authenticated");
  let denied = false;
  try { await anon.query("select public.realtime_reserve($1)", [u(1)]); } catch { denied = true; }
  expect("an authenticated session cannot call realtime_reserve (service_role only)", denied);
  await anon.end();

  for (const c of clients) await c.end();
  await admin.end();
} finally {
  await server.stop();
}

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
process.exit(fail ? 1 : 0);
