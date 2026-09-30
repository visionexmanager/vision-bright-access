// The one-notice claim under REAL concurrency: a real Postgres server, many
// separate connections, all asking the gate for the same (channel, subject) at
// the same moment. PGlite is one connection, so it cannot race; this can.
//
//   npm i --no-save embedded-postgres pg
//   node scripts/sql/ai-subscription-gate-concurrency.mjs
//
// Uses the shared table stubs in gate-stubs.mjs and runs both migrations.
// Exit status 1 on any failure.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";
const stubs = STUBS;
const migration = (process.argv.length > 2 ? process.argv.slice(2) : MIGRATIONS).map((f) => readFileSync(f, "utf8")).join("\n");

const dir = mkdtempSync(join(tmpdir(), "gate-pg-"));
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: 54390, persistent: false, onLog: () => {}, onError: () => {}, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
await server.initialise();
await server.start();

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };

try {
  const admin = new pg.Client({ host: "127.0.0.1", port: 54390, user: "postgres", password: "pw", database: "postgres" });
  await admin.connect();
  await admin.query(stubs);
  await admin.query(migration);
  await admin.query(migration);
  const version = (await admin.query("show server_version")).rows[0].server_version;
  console.log(`real PostgreSQL ${version}, migration applied twice`);

  const CONNS = 10;
  const clients = await Promise.all(Array.from({ length: CONNS }, async () => {
    const c = new pg.Client({ host: "127.0.0.1", port: 54390, user: "postgres", password: "pw", database: "postgres" });
    await c.connect();
    await c.query("SET ROLE service_role");
    return c;
  }));
  const pids = new Set(await Promise.all(clients.map(async (c) => (await c.query("select pg_backend_pid() p")).rows[0].p)));
  expect(`${CONNS} distinct backend connections`, pids.size === CONNS);

  const race = async (call) => {
    const verdicts = await Promise.all(clients.map((c) => call(c)));
    return verdicts.map((r) => r.rows[0].v);
  };
  const tally = (vs) => ({ first: vs.filter((v) => v === "blocked_first_notice").length, silent: vs.filter((v) => v === "blocked_silent").length, other: vs.filter((v) => !["blocked_first_notice", "blocked_silent"].includes(v)).length });

  // Many independent subjects, so a rare interleaving has room to show itself.
  const ROUNDS = 200;
  let bad = 0, dupes = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const subject = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const t = tally(await race((c) => c.query("select public.ai_subscription_gate('web', $1, $2) as v", [subject, subject])));
    if (t.first !== 1 || t.silent !== CONNS - 1 || t.other !== 0) bad++;
  }
  const rows = (await admin.query("select count(*)::int n, count(distinct (channel, subject))::int d from public.ai_subscription_gate_notices")).rows[0];
  dupes = rows.n - rows.d;
  expect(`${ROUNDS} rounds x ${CONNS} simultaneous web requests: each round exactly 1 blocked_first_notice + ${CONNS - 1} blocked_silent`, bad === 0);
  expect(`notice rows = ${ROUNDS}, one per subject, ${dupes} duplicates`, rows.n === ROUNDS && dupes === 0);

  // The WhatsApp entry point, same race.
  let badWa = 0;
  for (let i = 0; i < 100; i++) {
    const phone = `+96279${String(80000000 + i)}`;
    const t = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    if (t.first !== 1 || t.silent !== CONNS - 1 || t.other !== 0) badWa++;
  }
  const wa = (await admin.query("select count(*)::int n from public.ai_subscription_gate_notices where channel = 'whatsapp'")).rows[0].n;
  expect("100 rounds x 10 simultaneous WhatsApp requests: each round exactly 1 notice", badWa === 0);
  expect("100 whatsapp notice rows, no duplicates", wa === 100);

  // The free week under concurrency: ten simultaneous requests from accounts that
  // are ON the trial can never win an "authorized", however they interleave.
  let trialBad = 0;
  for (let i = 0; i < 100; i++) {
    const id = `00000000-0000-4000-8000-${String(5000 + i).padStart(12, "0")}`;
    await admin.query("INSERT INTO public.profiles VALUES ($1, now() + interval '5 days')", [id]);
    const vs = await race((c) => c.query("select public.ai_subscription_gate('web', $1::text, $1::uuid) as v", [id]));
    const tt = tally(vs);
    if (vs.includes("authorized") || tt.first !== 1 || tt.silent !== CONNS - 1) trialBad++;
  }
  expect("100 rounds x 10 simultaneous requests from trial-only accounts: never authorized, exactly 1 notice each", trialBad === 0);
  const trialSecs = (await admin.query("select public.user_sections('00000000-0000-4000-8000-000000005000'::uuid) s")).rows[0].s;
  expect("a trial account's sections are still exactly the three free ones", trialSecs.length === 3);

  // Subscribing mid-flight: a subscriber is never told and the re-arm never double-fires.
  const sub = "00000000-0000-4000-8000-0000000000ff";
  await admin.query("INSERT INTO public.user_subscriptions (user_id, plan_id, status, ends_at) VALUES ($1,'pro','active', now() + interval '30 days')", [sub]);
  const t = tally(await race((c) => c.query("select public.ai_subscription_gate('web', $1::text, $1::uuid) as v", [sub])));
  const authorized = (await race((c) => c.query("select public.ai_subscription_gate('web', $1::text, $1::uuid) as v", [sub]))).every((v) => v === "authorized");
  expect("10 simultaneous requests from an active subscriber: all authorized, no notice", authorized && t.first === 0);

  for (const c of clients) await c.end();
  await admin.end();
} finally {
  try { await server.stop(); } catch { /* Windows keeps the data dir locked for a moment; it is a temp dir */ }
}
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
