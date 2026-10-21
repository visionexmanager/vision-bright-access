// bazaar_notify_claim (20261081): the limit and ledger behind bazaar-notify-seller,
// executed in PGlite against the real migration.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/bazaar-notify-claim-scenarios.mjs
//
// Asserts: normal delivery is granted; a repeat within 10 minutes is a duplicate and a
// repeat after it is not; two real orders (distinct keys) are both announced; the
// per-user-per-shop hourly ceiling (5) and per-user daily ceiling (30) hold; the
// shop-wide external ceiling (20 an hour, all senders) withdraws e-mail/WhatsApp but
// never the in-app notification; users and shops are independent; the ledger prunes
// itself; nobody but the service role can call the function or read the table; the
// migration is idempotent; and its documented rollback removes it. Ends with a mutation
// proof. (Real concurrency is in ai-subscription-gate-concurrency.mjs, on real Postgres.)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const FILE = "supabase/migrations/20261081000000_bazaar_notify_limits.sql";
const SQL = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

async function fresh(sql) {
  const db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;");
  await db.exec(sql);
  await db.exec(sql); // re-runnable
  return db;
}
const db = await fresh(SQL);

let fail = 0, total = 0;
const expect = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const U = (n) => id(100 + n), SHOP = (n) => id(200 + n), PROD = (n) => id(300 + n);
const claim = async (d, user, shop, event, product = null, key = null) =>
  (await d.query("select public.bazaar_notify_claim($1,$2,$3,$4,$5) v", [user, shop, event, product, key])).rows[0].v;
const rows = async (d) => Number((await d.query("select count(*)::int n from public.bazaar_notification_log")).rows[0].n);
const age = (d, minutes) => d.exec(`update public.bazaar_notification_log set created_at = created_at - interval '${minutes} minutes'`);

// ── Normal delivery ──
let r = await claim(db, U(1), SHOP(1), "add_to_cart", PROD(1));
expect("a first notification is allowed, with e-mail/WhatsApp granted", r.allowed === true && r.external === true && r.reason === "ok");
expect("…and it is written to the ledger", (await rows(db)) === 1);

// ── Duplicates ──
r = await claim(db, U(1), SHOP(1), "add_to_cart", PROD(1));
expect("the same user, shop, event and product again → duplicate, nothing granted", r.allowed === false && r.reason === "duplicate" && r.external === false);
expect("…and nothing was written", (await rows(db)) === 1);
r = await claim(db, U(1), SHOP(1), "add_to_cart", PROD(2));
expect("a different product is a different event → allowed", r.allowed === true);
await age(db, 11);
r = await claim(db, U(1), SHOP(1), "add_to_cart", PROD(1));
expect("the same event 11 minutes later is allowed again", r.allowed === true);

// ── Two real orders are both announced (distinct keys), a repeat of one is not ──
r = await claim(db, U(2), SHOP(2), "order_paid", null, "order-A");
expect("order_paid for order A → allowed", r.allowed === true);
r = await claim(db, U(2), SHOP(2), "order_paid", null, "order-B");
expect("order_paid for a second, different order within minutes → also allowed", r.allowed === true);
r = await claim(db, U(2), SHOP(2), "order_paid", null, "order-A");
expect("order A announced twice → duplicate", r.allowed === false && r.reason === "duplicate");

// ── Per user per shop per hour: 5 ──
let granted = 0;
for (let i = 0; i < 12; i++) if ((await claim(db, U(3), SHOP(3), "message", null, `m${i}`)).allowed) granted++;
expect("12 different messages from one user to one shop in an hour: exactly 5 allowed", granted === 5);
r = await claim(db, U(3), SHOP(3), "message", null, "m99");
expect("…the refusal says why (user_shop_rate)", r.allowed === false && r.reason === "user_shop_rate");
r = await claim(db, U(3), SHOP(4), "message", null, "m0");
expect("…but the same user may still notify a DIFFERENT shop", r.allowed === true);
r = await claim(db, U(4), SHOP(3), "message", null, "m0");
expect("…and a different user may notify that shop", r.allowed === true);
await age(db, 61);
r = await claim(db, U(3), SHOP(3), "message", null, "later");
expect("an hour later the user may notify the shop again", r.allowed === true);

// ── Per user per day: 30 across shops ──
let day = 0;
for (let i = 0; i < 45; i++) if ((await claim(db, U(5), SHOP(10 + i), "wishlist", PROD(i))).allowed) day++;
expect("45 notifications from one user to 45 different shops in a day: exactly 30 allowed", day === 30);
r = await claim(db, U(5), SHOP(99), "wishlist", PROD(1));
expect("…then refused (user_daily)", r.allowed === false && r.reason === "user_daily");

// ── Shop-wide external ceiling: e-mail/WhatsApp stop at 20 an hour, in-app never does ──
let external = 0, inApp = 0;
for (let i = 0; i < 30; i++) {
  const x = await claim(db, U(200 + i), SHOP(5), "review", PROD(i));
  if (x.allowed) inApp++;
  if (x.allowed && x.external) external++;
}
expect("30 different users notify one shop in an hour: every in-app notification is allowed", inApp === 30);
expect("…but e-mail/WhatsApp is granted to exactly 20 of them (a flood cannot cost more)", external === 20);
await age(db, 61);
r = await claim(db, U(300), SHOP(5), "review", PROD(1));
expect("an hour later the shop's external budget is back", r.allowed === true && r.external === true);

// ── Invalid input ──
expect("a missing user is refused", (await claim(db, null, SHOP(1), "message")).allowed === false);
expect("an empty event is refused", (await claim(db, U(1), SHOP(1), " ")).allowed === false);

// ── Pruning ──
await db.exec(`insert into public.bazaar_notification_log (user_id, shop_id, event_type, created_at) values ('${U(900)}', '${SHOP(900)}', 'message', now() - interval '8 days')`);
await claim(db, U(901), SHOP(900), "message");
const left = Number((await db.query(`select count(*)::int n from public.bazaar_notification_log where shop_id='${SHOP(900)}' and created_at < now() - interval '7 days'`)).rows[0].n);
expect("a claim prunes that shop's rows older than 7 days", left === 0);

// ── Privileges ──
const fn = "public.bazaar_notify_claim(uuid,uuid,text,uuid,text)";
const can = async (role, sql) => (await db.query(sql.replace("ROLE", role))).rows[0].v;
for (const role of ["anon", "authenticated"]) {
  expect(`${role} cannot execute the function`, !(await can(role, `select has_function_privilege('ROLE', '${fn}', 'EXECUTE') v`)));
  expect(`${role} cannot read or write the ledger`, !(await can(role, "select has_table_privilege('ROLE', 'public.bazaar_notification_log', 'SELECT') v")) && !(await can(role, "select has_table_privilege('ROLE', 'public.bazaar_notification_log', 'INSERT') v")));
}
expect("the service role can execute it", await can("service_role", `select has_function_privilege('ROLE', '${fn}', 'EXECUTE') v`));
expect("row-level security is on and the ledger has no policy", (await db.query("select relrowsecurity v from pg_class where oid='public.bazaar_notification_log'::regclass")).rows[0].v === true
  && Number((await db.query("select count(*)::int n from pg_policies where tablename='bazaar_notification_log'")).rows[0].n) === 0);

// ── Rollback exactly as documented ──
const rollback = [...SQL.matchAll(/^--\s+(DROP [^\n]+;)$/gm)].map((m) => m[1]);
expect("the migration documents two rollback statements", rollback.length === 2);
for (const stmt of rollback) await db.exec(stmt);
expect("rollback removes the function and the ledger",
  (await db.query("select to_regclass('public.bazaar_notification_log') r")).rows[0].r === null
  && Number((await db.query("select count(*)::int n from pg_proc where proname='bazaar_notify_claim'")).rows[0].n) === 0);

// ── Mutation proof: remove the hourly ceiling and the 5-a-shop check must go red ──
const mutated = SQL.replace("IF _n >= _per_shop_hour THEN", "IF false THEN");
const mdb = await fresh(mutated);
let mg = 0;
for (let i = 0; i < 12; i++) if ((await claim(mdb, U(3), SHOP(3), "message", null, `m${i}`)).allowed) mg++;
expect("MUTATION: with the hourly ceiling removed all 12 would be allowed (the real test above goes red)", mg === 12);

console.log(`\n${total - fail}/${total} passed`);
process.exit(fail ? 1 : 0);
