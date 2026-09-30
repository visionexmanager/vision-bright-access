// 20261062 + 20261063 — the AI subscription gate and the trial rule — executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/ai-subscription-gate-scenarios.mjs   (runs both migrations)
//
// Runs the migration twice over minimal stubs of the tables it reads and drives
// ai_subscription_gate / ai_subscription_gate_whatsapp through every
// subscription state the repository can represent. Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const db = new PGlite();
await db.exec(STUBS);

const sql = (process.argv.length > 2 ? process.argv.slice(2) : MIGRATIONS).map((f) => readFileSync(f, "utf8")).join("\n");
await db.exec(sql);
await db.exec(sql); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const gate = async (channel, subject, userId) =>
  (await db.query("select public.ai_subscription_gate($1,$2,$3) as v", [channel, subject, userId])).rows[0].v;
const gateWa = async (phone) =>
  (await db.query("select public.ai_subscription_gate_whatsapp($1) as v", [phone])).rows[0].v;
const sub = (n, plan, status, endsSql = "now() + interval '30 days'") =>
  db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(n)}','${plan}','${status}',${endsSql})`);

// 1/2 — new unsubscribed web user: one notice, then silence.
expect("new unsubscribed user → first notice", (await gate("web", u(1), u(1))) === "blocked_first_notice");
expect("same user again → silent", (await gate("web", u(1), u(1))) === "blocked_silent");
expect("…and again → still silent", (await gate("web", u(1), u(1))) === "blocked_silent");

// Channels are independent.
expect("same subject on another channel gets its own notice", (await gate("whatsapp", u(1), u(1))) === "blocked_first_notice");

// 7 — each paid plan.
for (const [n, plan] of [[10, "kids"], [11, "basic"], [12, "pro"], [13, "business"]]) {
  await sub(n, plan, "active");
  expect(`active ${plan} → authorized`, (await gate("web", u(n), u(n))) === "authorized");
}

// 8/9/10 — lapsed states.
await sub(20, "pro", "active", "now() - interval '1 day'");
expect("active but ends_at passed (expired) → blocked", (await gate("web", u(20), u(20))) === "blocked_first_notice");
await sub(21, "pro", "expired");
expect("status expired → blocked", (await gate("web", u(21), u(21))) === "blocked_first_notice");
await sub(22, "pro", "cancelled");
expect("status cancelled → blocked", (await gate("web", u(22), u(22))) === "blocked_first_notice");
await sub(23, "pro", "past_due");
expect("status past_due (payment failed) → blocked", (await gate("web", u(23), u(23))) === "blocked_first_notice");

// 11 — checkout started / payment details entered, order not approved.
await db.exec(`INSERT INTO subscription_orders VALUES ('${u(24)}','pro','pending'),('${u(24)}','basic','rejected')`);
expect("pending/rejected order only → blocked", (await gate("web", u(24), u(24))) === "blocked_first_notice");

// 12 — VX without a subscription.
await db.exec(`INSERT INTO user_points VALUES ('${u(25)}', 999999)`);
expect("VX balance, no subscription → blocked", (await gate("web", u(25), u(25))) === "blocked_first_notice");

// Trial, retired plan, non-paid plan.
await db.exec(`INSERT INTO profiles VALUES ('${u(26)}', now() + interval '5 days')`);
expect("free trial week → blocked (not a paid plan)", (await gate("web", u(26), u(26))) === "blocked_first_notice");
await sub(27, "legacy_basic", "active");
expect("active subscription to a retired plan → blocked", (await gate("web", u(27), u(27))) === "blocked_first_notice");
await sub(28, "free", "active");
expect("active subscription to a non-paid plan → blocked", (await gate("web", u(28), u(28))) === "blocked_first_notice");
await db.exec(`INSERT INTO profiles VALUES ('${u(29)}', now() + interval '5 days')`);
await sub(29, "basic", "active");
expect("trial AND paid subscription → authorized", (await gate("web", u(29), u(29))) === "authorized");

// Admin.
await db.exec(`INSERT INTO user_roles VALUES ('${u(30)}','admin'),('${u(31)}','moderator')`);
expect("admin role → authorized", (await gate("web", u(30), u(30))) === "authorized");
expect("moderator role → blocked", (await gate("web", u(31), u(31))) === "blocked_first_notice");

// Anonymous.
expect("anonymous (no user id) → first notice", (await gate("web_anon", "iphash-a", null)) === "blocked_first_notice");
expect("anonymous again → silent", (await gate("web_anon", "iphash-a", null)) === "blocked_silent");
expect("empty subject → silent, never served", (await gate("web_anon", " ", null)) === "blocked_silent");
expect("null subject → silent", (await gate("web", null, u(10))) === "blocked_silent");

// 6 — subscribe after the notice, then lapse again.
await sub(1, "basic", "active");
expect("user subscribes after the notice → authorized", (await gate("web", u(1), u(1))) === "authorized");
const left = (await db.query(`select count(*)::int c from ai_subscription_gate_notices where channel='web' and subject='${u(1)}'`)).rows[0].c;
expect("…and the notice row is cleared", left === 0);
await db.exec(`UPDATE user_subscriptions SET status='expired' WHERE user_id='${u(1)}'`);
expect("lapses again → exactly one fresh notice", (await gate("web", u(1), u(1))) === "blocked_first_notice");
expect("…then silent", (await gate("web", u(1), u(1))) === "blocked_silent");

// 3/4/5 — WhatsApp.
expect("unlinked WhatsApp sender → first notice", (await gateWa("96171111111")) === "blocked_first_notice");
expect("second WhatsApp message → silent", (await gateWa("96171111111")) === "blocked_silent");
const burst = await Promise.all(Array.from({ length: 10 }, () => gateWa("96172222222")));
expect("10 simultaneous messages → exactly one notice", burst.filter((v) => v === "blocked_first_notice").length === 1
  && burst.filter((v) => v === "blocked_silent").length === 9);
await db.exec(`INSERT INTO whatsapp_identities VALUES ('96173333333','${u(12)}'),('96174444444','${u(21)}'),('96175555555',NULL)`);
expect("WhatsApp linked to an active Pro account → authorized", (await gateWa("96173333333")) === "authorized");
expect("WhatsApp linked to an expired account → blocked", (await gateWa("96174444444")) === "blocked_first_notice");
expect("WhatsApp link pending (user_id null) → blocked", (await gateWa("96175555555")) === "blocked_first_notice");
expect("owner handset → authorized", (await gateWa("+96170000001")) === "authorized");
expect("empty WhatsApp sender → silent", (await gateWa("")) === "blocked_silent");
await db.exec(`INSERT INTO whatsapp_identities VALUES ('96171111111','${u(13)}')`);
expect("WhatsApp sender links a Business account after the notice → authorized", (await gateWa("96171111111")) === "authorized");

// Constraint and permissions.
let rejected = false;
try { await gate("Bad Channel!", "x", null); } catch { rejected = true; }
expect("malformed channel label rejected by the check constraint", rejected);

for (const role of ["anon", "authenticated"]) {
  let denied = false;
  await db.exec(`SET ROLE ${role}`);
  try { await gate("web", u(99), u(12)); } catch { denied = true; }
  let tableDenied = false;
  try { await db.query("select * from ai_subscription_gate_notices"); } catch { tableDenied = true; }
  let entitledDenied = false;
  try { await db.query(`select public.ai_user_entitled('${u(12)}')`); } catch { entitledDenied = true; }
  await db.exec("RESET ROLE");
  expect(`${role} cannot call the gate, read the table, or probe entitlement`, denied && tableDenied && entitledDenied);
}
await db.exec("SET ROLE service_role");
let serviceOk = false;
try { serviceOk = (await gate("web", u(12), u(12))) === "authorized"; } catch { serviceOk = false; }
await db.exec("RESET ROLE");
expect("service_role can call the gate", serviceOk);

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
