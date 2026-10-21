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
    const phone = `96279${String(80000000 + i)}`;
    const t = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    if (t.first !== 1 || t.silent !== CONNS - 1 || t.other !== 0) badWa++;
  }
  const wa = (await admin.query("select count(*)::int n from public.ai_subscription_gate_notices where channel = 'whatsapp'")).rows[0].n;
  expect("100 rounds x 10 simultaneous WhatsApp requests: each round exactly 1 notice", badWa === 0);
  expect("100 whatsapp notice rows, no duplicates", wa === 100);

  // The 10-minute renotice under concurrency (20261075): once the clock has run out,
  // ten simultaneous messages win exactly ONE notice between them, then it restarts.
  let badRenotice = 0;
  for (let i = 0; i < 50; i++) {
    const phone = `96279${String(80000000 + i)}`;
    await admin.query("UPDATE public.ai_subscription_gate_notices SET notified_at = now() - interval '11 minutes' WHERE channel='whatsapp' AND subject=$1", [phone]);
    const t = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    const again = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    if (t.first !== 1 || t.silent !== CONNS - 1 || again.first !== 0) badRenotice++;
  }
  expect("50 rounds x 10 simultaneous WhatsApp requests after the 10 minutes: exactly 1 renotice each, none on the next burst", badRenotice === 0);

  // The daily cap (20261082) under concurrency: at the cap nobody wins; one below it exactly one wins and the count lands on six.
  let capBad = 0, lastBad = 0;
  for (let i = 0; i < 30; i++) {
    const phone = `96279${String(80000000 + i)}`;
    await admin.query("UPDATE public.ai_subscription_gate_notices SET notified_at = now() - interval '11 minutes', renotice_count = 6, renotice_window_start = now() - interval '1 hour' WHERE channel='whatsapp' AND subject=$1", [phone]);
    const atCap = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    if (atCap.first !== 0) capBad++;
    await admin.query("UPDATE public.ai_subscription_gate_notices SET notified_at = now() - interval '11 minutes', renotice_count = 5, renotice_window_start = now() - interval '1 hour' WHERE channel='whatsapp' AND subject=$1", [phone]);
    const below = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])));
    const count = (await admin.query("select renotice_count n from public.ai_subscription_gate_notices where channel='whatsapp' and subject=$1", [phone])).rows[0].n;
    if (below.first !== 1 || count !== 6) lastBad++;
  }
  expect("30 rounds x 10 simultaneous messages from a number AT its daily cap: nobody is re-told", capBad === 0);
  expect("30 rounds x 10 simultaneous messages one below the cap: exactly one is re-told and the count lands on six", lastBad === 0);

  // The global budget (20261083) under concurrency: thirty different new numbers in three simultaneous
  // bursts against a budget of 7 must be told exactly seven times between them, and the refused ones
  // must hand their claim back (no notice row), however the transactions interleave.
  await admin.query("INSERT INTO public.ops_limits (key, value_int) VALUES ('whatsapp_notice_global_per_hour', 7) ON CONFLICT (key) DO UPDATE SET value_int = 7");
  let told = 0;
  for (let burst = 0; burst < 3; burst++) {
    const rs = await Promise.all(clients.map((c, k) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [`96277${String(20000000 + burst * 10 + k)}`])));
    told += rs.filter((r) => r.rows[0].v === "blocked_first_notice").length;
  }
  const budgetRows = (await admin.query("select count(*)::int n from public.ai_subscription_gate_notices where channel='whatsapp' and subject like '96277%'")).rows[0].n;
  const budgetLog = (await admin.query("select count(*)::int n from public.whatsapp_notice_log where sent_at > now() - interval '1 hour'")).rows[0].n;
  expect("budget 7, 30 different numbers in three simultaneous bursts: exactly 7 are told", told === 7);
  expect("…only those 7 hold a notice row (the refused claims were handed back) and the counter reads 7", budgetRows === 7 && budgetLog === 7);
  // re-notices spend the same budget, concurrently
  await admin.query("UPDATE public.ai_subscription_gate_notices SET notified_at = now() - interval '11 minutes' WHERE channel='whatsapp' AND subject like '96277%'");
  const reTold = tally(await race((c) => c.query("select public.ai_subscription_gate_whatsapp('96277' || '20000000') as v"))).first;
  expect("…and with the budget spent, ten simultaneous re-notice attempts are all refused", reTold === 0);
  await admin.query("DELETE FROM public.ops_limits WHERE key = 'whatsapp_notice_global_per_hour'");
  await admin.query("DELETE FROM public.whatsapp_notice_log");

  // A linked account in its free week (20261079) is never sent the notice, however they race.
  let badFreeWeek = 0;
  for (let i = 0; i < 50; i++) {
    const id = `00000000-0000-4000-8000-${String(7000 + i).padStart(12, "0")}`;
    const phone = `96278${String(10000000 + i)}`;
    await admin.query("INSERT INTO public.profiles VALUES ($1, now() + interval '5 days')", [id]);
    await admin.query("INSERT INTO public.whatsapp_identities VALUES ($1, $2)", [phone, id]);
    const vs = await race((c) => c.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone]));
    if (!vs.every((v) => v === "blocked_silent")) badFreeWeek++;
  }
  const fwRows = (await admin.query("select count(*)::int n from public.ai_subscription_gate_notices where channel='whatsapp' and subject like '96278%'")).rows[0].n;
  expect("50 rounds x 10 simultaneous WhatsApp requests from free-week accounts: all silent, never a notice", badFreeWeek === 0);
  expect("…and not one notice row was written for them", fwRows === 0);

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
  // 20261078: the free set plus the stored-content sections. Still never an AI service and never every section.
  expect("a trial account's sections are exactly the free set plus academy, arcade, library",
    JSON.stringify([...trialSecs].sort()) === JSON.stringify(["academy", "arcade", "assistive", "community", "library", "news"]));

  // Seller notifications (20261081): the limit is decided atomically, so a burst cannot all read
  // the same count and pass.
  const claimAs = (c, user, shop, event, product, key) => c.query("select public.bazaar_notify_claim($1,$2,$3,$4,$5) as v", [user, shop, event, product, key]);
  const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let dupBad = 0;
  for (let i = 0; i < 30; i++) {
    const rs = await Promise.all(clients.map((c) => claimAs(c, uid(9000 + i), uid(9500 + i), "add_to_cart", uid(1), null)));
    if (rs.filter((r) => r.rows[0].v.allowed === true).length !== 1) dupBad++;
  }
  expect("30 rounds x 10 simultaneous IDENTICAL seller notifications: exactly 1 allowed each (the rest are duplicates)", dupBad === 0);

  let rateBad = 0;
  for (let i = 0; i < 20; i++) {
    const rs = await Promise.all(clients.map((c, k) => claimAs(c, uid(9100 + i), uid(9600 + i), "message", null, `k${k}`)));
    if (rs.filter((r) => r.rows[0].v.allowed === true).length !== 5) rateBad++;
  }
  expect("20 rounds x 10 simultaneous DIFFERENT notifications from one user to one shop: exactly 5 allowed each (the hourly ceiling)", rateBad === 0);

  let externalGranted = 0, inAppAllowed = 0;
  const shop = uid(9700);
  for (let batch = 0; batch < 3; batch++) {
    const rs = await Promise.all(clients.map((c, k) => claimAs(c, uid(9200 + batch * 10 + k), shop, "review", uid(2), null)));
    for (const r of rs) { if (r.rows[0].v.allowed) inAppAllowed++; if (r.rows[0].v.allowed && r.rows[0].v.external) externalGranted++; }
  }
  expect("30 users notify one shop in three simultaneous bursts: all 30 in-app notifications allowed", inAppAllowed === 30);
  expect("…and e-mail/WhatsApp is granted to exactly 20 (the shop-wide ceiling cannot be raced past)", externalGranted === 20);

  // An event that names an ORDER (20261084): ten simultaneous retries of one order's notification win once.
  let keyedBad = 0;
  for (let i = 0; i < 30; i++) {
    const rs = await Promise.all(clients.map((c) => claimAs(c, uid(9300 + i), uid(9800 + i), "order_paid", null, `order-${i}`)));
    if (rs.filter((r) => r.rows[0].v.allowed === true).length !== 1) keyedBad++;
  }
  expect("30 rounds x 10 simultaneous retries of ONE order's notification (same order key): exactly 1 accepted each", keyedBad === 0);

  // A claim inside a transaction that rolls back leaves nothing behind: a failed attempt cannot burn the slot.
  const rbUser = uid(9400), rbShop = uid(9900);
  await clients[0].query("BEGIN");
  const inTx = (await claimAs(clients[0], rbUser, rbShop, "message", null, "tx")).rows[0].v;
  await clients[0].query("ROLLBACK");
  const afterRollback = (await claimAs(clients[1], rbUser, rbShop, "message", null, "tx")).rows[0].v;
  const ledger = (await admin.query("select count(*)::int n from public.bazaar_notification_log where user_id = $1", [rbUser])).rows[0].n;
  expect("a claim made in a transaction that is rolled back is not remembered: the retry is accepted, and the ledger holds exactly one row", inTx.allowed === true && afterRollback.allowed === true && ledger === 1);

  // Concurrent claims for one user and shop never block each other for long (the lock order is fixed): ten different shops at once all finish.
  const t0 = Date.now();
  const many = await Promise.all(clients.map((c, k) => claimAs(c, uid(9500), uid(9950 + k), "wishlist", uid(3), null)));
  expect("ten simultaneous claims by one user across ten different shops all complete and are all accepted (no deadlock)", many.every((r) => r.rows[0].v.allowed === true) && Date.now() - t0 < 10_000);

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
