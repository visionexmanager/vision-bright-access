// The free week is not "every section": executed in PGlite against the real
// 20261062 (gate) and 20261063 (trial rule) migrations.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/trial-entitlement-scenarios.mjs
//
// The stub plan table starts with the OLD free_trial row (all eighteen sections,
// a 200-a-day WhatsApp allowance), so every check below is against a database
// that had the obsolete rule and was then migrated. Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const db = new PGlite();
await db.exec(STUBS);
await db.exec(`
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
`);
const migration = MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n");
await db.exec(migration);
await db.exec(migration); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const plan = async (id) => (await one("select public.plan_for_user($1) v", [id])).v;
const sections = async (id) => (await one("select public.user_sections($1) v", [id])).v;
const gate = async (id) => (await one("select public.ai_subscription_gate('web', $1::text, $1::uuid) v", [id])).v;
const asUser = (id) => db.exec(`select set_config('test.uid', '${id ?? ""}', false)`);
const wa = async (phone) => (await one("select public.whatsapp_entitlements($1) v", [phone])).v;

const FREE = ["assistive", "community", "news"];
const ALL_EIGHTEEN = ["academy", "arcade", "assistant", "assistive", "career", "community", "finance", "kids", "library",
  "marketplace", "mediaStudio", "messages", "news", "professional", "radio", "simulations", "studio", "tv"];
const sorted = (xs) => [...xs].sort();

// ── The plan row was migrated off "every section" ──
const row = await one("select limits, description, features from public.billing_plans where id = 'free_trial'");
expect("free_trial row: sections are the three free ones, not eighteen", JSON.stringify(sorted(row.limits.sections)) === JSON.stringify(FREE));
expect("free_trial row: the 200-a-day WhatsApp allowance is gone (0 would mean unlimited, so the key is removed)", !("whatsapp_daily_messages" in row.limits));
expect("free_trial row: copy no longer promises every section", !/every section/i.test(JSON.stringify(row.features)) && !/every section (open|of)/i.test(row.description));

// ── 1. Trial only ──
await db.exec(`INSERT INTO profiles VALUES ('${u(1)}', now() + interval '5 days')`);
expect("trial only → plan free_trial", (await plan(u(1))) === "free_trial");
expect("trial only → sections are exactly the trial's three", JSON.stringify(sorted(await sections(u(1)))) === JSON.stringify(FREE));
expect("trial only → AI refused (first notice)", (await gate(u(1))) === "blocked_first_notice");
expect("trial only → AI refused again (silent)", (await gate(u(1))) === "blocked_silent");
const trialSections = await sections(u(1));
for (const s of ["assistant", "academy", "library", "arcade", "marketplace", "kids", "career", "tv", "radio", "messages", "simulations", "mediaStudio", "studio", "professional", "finance"]) {
  if (trialSections.includes(s)) { fail++; console.log(`FAIL  trial must not open ${s}`); }
}
expect("trial opens none of the fifteen paid/AI sections", !ALL_EIGHTEEN.filter((s) => !FREE.includes(s)).some((s) => trialSections.includes(s)));

// ── 2. Tampering with the plan row cannot reopen everything ──
await db.exec(`UPDATE public.billing_plans SET limits = jsonb_set(limits, '{sections}', to_jsonb(ARRAY[${ALL_EIGHTEEN.map((s) => `'${s}'`).join(",")}]::text[])) WHERE id = 'free_trial'`);
expect("plan row edited back to all eighteen sections → the trial STILL gets three (free_trial can never resolve to all sections)",
  JSON.stringify(sorted(await sections(u(1)))) === JSON.stringify(FREE));
expect("…and still no AI", (await gate(u(1))) === "blocked_silent");

// ── 3. Paid eligible plan ──
await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(2)}','basic','active', now() + interval '30 days')`);
expect("basic → plan basic", (await plan(u(2))) === "basic");
const basic = await sections(u(2));
expect("basic → opens the assistant, academy, library, arcade, marketplace", ["assistant", "academy", "library", "arcade", "marketplace"].every((s) => basic.includes(s)));
expect("basic → does not open pro/business sections", !["kids", "career", "tv", "mediaStudio", "finance"].some((s) => basic.includes(s)));
expect("basic → AI authorized", (await gate(u(2))) === "authorized");

// ── 4. A subscription inside the free week wins over the trial ──
await db.exec(`INSERT INTO profiles VALUES ('${u(3)}', now() + interval '5 days')`);
await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(3)}','pro','active', now() + interval '30 days')`);
expect("trial AND pro subscription → plan pro (the trial no longer masks a subscription)", (await plan(u(3))) === "pro");
expect("…AI authorized", (await gate(u(3))) === "authorized");
expect("…sections are pro's, not the trial's", (await sections(u(3))).includes("career"));

// ── 5. No trial, no plan; lapsed ──
await db.exec(`INSERT INTO profiles VALUES ('${u(4)}', now() - interval '1 day')`);
expect("expired trial → plan none → free sections", (await plan(u(4))) === "none" && JSON.stringify(sorted(await sections(u(4)))) === JSON.stringify(FREE));
expect("unknown user → none", (await plan(u(99))) === "none");
await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(5)}','pro','active', now() - interval '1 day')`);
expect("subscription past ends_at → none", (await plan(u(5))) === "none");
await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status) VALUES ('${u(6)}','legacy_basic','active')`);
expect("subscription to a retired plan → none", (await plan(u(6))) === "none");

// ── 6. Admin ──
await db.exec(`INSERT INTO user_roles VALUES ('${u(7)}','admin')`);
expect("admin → plan admin", (await plan(u(7))) === "admin");
expect("admin → every section any PAID plan names (never read from the trial row)", JSON.stringify(sorted(await sections(u(7)))) === JSON.stringify(ALL_EIGHTEEN));
expect("admin → AI authorized", (await gate(u(7))) === "authorized");

// ── 7. What the browser reads ──
await asUser(u(1));
let mine = (await one("select public.my_plan_access() v")).v;
expect("my_plan_access, trial: plan free_trial, trial_active, three sections", mine.plan === "free_trial" && mine.trial_active === true && mine.sections.length === 3);
await asUser(u(3));
mine = (await one("select public.my_plan_access() v")).v;
expect("my_plan_access, pro inside the free week: plan pro, trial_active false (no trial banner)", mine.plan === "pro" && mine.trial_active === false && mine.sections.includes("career"));
await asUser(u(4));
mine = (await one("select public.my_plan_access() v")).v;
expect("my_plan_access, nothing: plan none, three sections", mine.plan === "none" && mine.sections.length === 3);
await asUser(null);
mine = (await one("select public.my_plan_access() v")).v;
expect("my_plan_access, signed out: no sections", mine.signed_in === false && mine.sections.length === 0);

// ── 8. WhatsApp: the same plan ──
await db.exec(`INSERT INTO whatsapp_identities VALUES ('96181000001','${u(1)}'),('96181000002','${u(2)}'),('96181000003','${u(3)}'),('96181000004','${u(7)}'),('96181000005','${u(4)}')`);
let e = await wa("96181000001");
expect("WhatsApp trial → not allowed, plan free_trial", e.allowed === false && e.plan === "free_trial");
expect("WhatsApp trial → limit is 1 with 0 remaining, never 0 (which every caller reads as unlimited)", e.daily_limit === 1 && e.remaining === 0);
e = await wa("96181000002");
expect("WhatsApp basic → allowed with its 150 a day", e.allowed === true && e.plan === "basic" && e.daily_limit === 150);
e = await wa("96181000003");
expect("WhatsApp pro inside the free week → pro's allowance, not the trial's", e.allowed === true && e.plan === "pro" && e.daily_limit === 400);
e = await wa("96181000004");
expect("WhatsApp admin → unmetered", e.allowed === true && e.plan === "admin" && e.remaining === -1);
e = await wa("96170000001");
expect("WhatsApp owner handset → unmetered", e.allowed === true && e.plan === "owner");
e = await wa("96199999999");
expect("WhatsApp unlinked number → the free floor, not a trial", e.plan === "none" && e.linked === false);
e = await wa("96181000005");
expect("WhatsApp lapsed trial → none", e.plan === "none");
const waGate = async (phone) => (await one("select public.ai_subscription_gate_whatsapp($1) v", [phone])).v;
expect("WhatsApp trial sender → subscription notice (first)", (await waGate("96181000001")) === "blocked_first_notice");
expect("WhatsApp trial sender → then silent", (await waGate("96181000001")) === "blocked_silent");
expect("WhatsApp basic sender → authorized", (await waGate("96181000002")) === "authorized");

// ── 9. Nothing here leaks to the browser roles ──
for (const role of ["anon", "authenticated"]) {
  let denied = 0;
  await db.exec(`SET ROLE ${role}`);
  for (const q of ["select public.plan_for_user('" + u(1) + "')", "select public.user_sections('" + u(1) + "')", "select public.whatsapp_entitlements('96181000001')"]) {
    try { await db.query(q); } catch { denied++; }
  }
  await db.exec("RESET ROLE");
  expect(`${role} cannot ask for anybody's plan, sections or WhatsApp entitlement`, denied === 3);
}

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
