// The WhatsApp subscription notice: who is sent one, how often, and who never is.
// Executed in PGlite against the real 20261062 / 20261063 / 20261075 / 20261079.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/whatsapp-notice-scenarios.mjs
//
// Why it matters: the notice is an OUTBOUND WhatsApp message, and Meta bills
// delivered service messages beyond 1,000 a month per business number from
// 2026-10-01 (rate for Visionex's markets unverified). So: a linked account in its
// free week is never sent it; every other unentitled sender gets it at most once
// per 10 minutes; an entitled sender and the owner are authorized.
// (Real concurrency is in ai-subscription-gate-concurrency.mjs, on real Postgres.)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const db = new PGlite();
await db.exec(STUBS);
await db.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;`);
const migration = MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n");
await db.exec(migration);
await db.exec(migration); // re-runnable

let fail = 0, total = 0;
const expect = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const gate = async (phone) => (await one("select public.ai_subscription_gate_whatsapp($1) v", [phone])).v;
const notices = async (phone) => Number((await one("select count(*)::int n from public.ai_subscription_gate_notices where channel='whatsapp' and subject=$1", [phone])).n);
const age = (phone, minutes) => db.exec(`update public.ai_subscription_gate_notices set notified_at = now() - interval '${minutes} minutes' where channel='whatsapp' and subject='${phone}'`);

const UNLINKED = "+96279000001";
const FREEWEEK = "+96279000002";
const PAID = "+96279000003";
const EXPIRED = "+96279000004";
const OWNER = "+961 70 000 001";

await db.exec(`INSERT INTO profiles VALUES ('${u(1)}', now() + interval '5 days')`);                    // free week
await db.exec(`INSERT INTO whatsapp_identities VALUES ('${FREEWEEK}', '${u(1)}')`);
await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(2)}','basic','active', now() + interval '30 days')`);
await db.exec(`INSERT INTO whatsapp_identities VALUES ('${PAID}', '${u(2)}')`);
await db.exec(`INSERT INTO profiles VALUES ('${u(3)}', now() - interval '3 days')`);                    // expired trial
await db.exec(`INSERT INTO whatsapp_identities VALUES ('${EXPIRED}', '${u(3)}')`);

// ── An unlinked number: told, then at most once per 10 minutes ──
expect("unlinked number, first message → blocked_first_notice", (await gate(UNLINKED)) === "blocked_first_notice");
expect("…the notice is recorded once", (await notices(UNLINKED)) === 1);
expect("…the next message at once → blocked_silent", (await gate(UNLINKED)) === "blocked_silent");
for (let i = 0; i < 20; i++) await gate(UNLINKED);
expect("…twenty more in the same minute → still one notice row, still silent", (await notices(UNLINKED)) === 1 && (await gate(UNLINKED)) === "blocked_silent");
await age(UNLINKED, 9);
expect("…9 minutes later → still silent (inside the window)", (await gate(UNLINKED)) === "blocked_silent");
await age(UNLINKED, 11);
expect("…11 minutes later → told again (blocked_first_notice)", (await gate(UNLINKED)) === "blocked_first_notice");
expect("…and then silent again straight away (the clock restarted)", (await gate(UNLINKED)) === "blocked_silent");
expect("…never more than one row for the number", (await notices(UNLINKED)) === 1);

// ── A linked account in its free week: never sent the notice ──
const seen = new Set();
for (let i = 0; i < 25; i++) seen.add(await gate(FREEWEEK));
expect("free-week sender, 25 messages → always blocked_silent, never a notice", seen.size === 1 && seen.has("blocked_silent"));
expect("…no notice row was ever created", (await notices(FREEWEEK)) === 0);
await db.exec(`UPDATE public.ai_subscription_gate_notices SET notified_at = now() - interval '2 hours'`);
expect("…even with every other clock aged two hours, still silent", (await gate(FREEWEEK)) === "blocked_silent" && (await notices(FREEWEEK)) === 0);

// ── A pre-existing notice row for a number that later links in its free week is not revived ──
await db.exec(`INSERT INTO public.ai_subscription_gate_notices (channel, subject, notified_at) VALUES ('whatsapp', '${FREEWEEK}', now() - interval '2 hours')`);
expect("a stale notice row for a free-week sender is not turned into a renotice", (await gate(FREEWEEK)) === "blocked_silent");
await db.exec(`DELETE FROM public.ai_subscription_gate_notices WHERE subject = '${FREEWEEK}'`);

// ── Paying, expired, owner ──
expect("paid, linked (Basic) → authorized, no notice row", (await gate(PAID)) === "authorized" && (await notices(PAID)) === 0);
expect("linked account whose free week has ended → told once (unchanged behaviour)", (await gate(EXPIRED)) === "blocked_first_notice" && (await gate(EXPIRED)) === "blocked_silent");
expect("owner handset → authorized", (await gate(OWNER)) === "authorized");
expect("empty number → blocked_silent", (await gate("")) === "blocked_silent");

// ── The trial is still refused by the entitlement reader too (no AI for the free week) ──
const ent = (await one("select public.whatsapp_entitlements($1) v", [FREEWEEK])).v;
expect("whatsapp_entitlements for a free-week sender: not allowed", ent.allowed === false);

// ── Mutation proof: without the free-week branch the first check must fail ──
const mutated = readFileSync("supabase/migrations/20261079000000_whatsapp_no_notice_for_free_week.sql", "utf8")
  .replace("IF _user_id IS NOT NULL AND public.plan_for_user(_user_id) = 'free_trial' THEN", "IF false THEN");
const mdb = new PGlite();
await mdb.exec(STUBS);
await mdb.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;`);
await mdb.exec(MIGRATIONS.slice(0, -1).map((f) => readFileSync(f, "utf8")).join("\n"));
await mdb.exec(mutated);
await mdb.exec(`INSERT INTO profiles VALUES ('${u(1)}', now() + interval '5 days')`);
await mdb.exec(`INSERT INTO whatsapp_identities VALUES ('${FREEWEEK}', '${u(1)}')`);
const mv = (await mdb.query("select public.ai_subscription_gate_whatsapp($1) v", [FREEWEEK])).rows[0].v;
expect("MUTATION: with the free-week branch removed the sender WOULD be sent a notice (the real test above goes red)", mv === "blocked_first_notice");

console.log(`\n${total - fail}/${total} passed`);
process.exit(fail ? 1 : 0);
