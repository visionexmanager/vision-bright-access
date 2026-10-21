// Migrations 20261078 (trial sections + Kids row) and 20261079 (no WhatsApp notice for
// the free week), applied over an EXISTING database: what changes, what must not, that
// a second run changes nothing, and that the documented rollback restores the old state.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/trial-sections-migration-scenarios.mjs
//
// The "before" database is the real 20261062 + 20261063 + 20261075 over the shared
// plan/subscription stubs, seeded with accounts in every state (free week, expired,
// Kids, Basic, Pro, Business, admin) and with orders and points. A snapshot is taken,
// the two migrations are applied, and the snapshot is diffed: the ONLY differences allowed are
// trial_sections() and the `sections` list of the kids plan row.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS } from "./gate-stubs.mjs";

const read = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const PRE = ["20261062000000_ai_subscription_gate.sql", "20261063000000_trial_is_not_full_access.sql", "20261075000000_whatsapp_gate_renotice.sql"]
  .map((f) => read(`supabase/migrations/${f}`)).join("\n");
const M78 = read("supabase/migrations/20261078000000_trial_local_sections.sql");
const M79 = read("supabase/migrations/20261079000000_whatsapp_no_notice_for_free_week.sql");

const db = new PGlite();
await db.exec(STUBS);
await db.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;`);
await db.exec(PRE);

let fail = 0, total = 0;
const expect = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const q = async (sql, params = []) => (await db.query(sql, params)).rows;

// ── Existing data in every state ──
const ACCOUNTS = { free: u(1), expired: u(2), kids: u(3), basic: u(4), pro: u(5), business: u(6), admin: u(7) };
await db.exec(`
  INSERT INTO profiles VALUES ('${ACCOUNTS.free}', now() + interval '5 days'), ('${ACCOUNTS.expired}', now() - interval '3 days');
  INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES
    ('${ACCOUNTS.kids}','kids','active', now() + interval '30 days'), ('${ACCOUNTS.basic}','basic','active', now() + interval '30 days'),
    ('${ACCOUNTS.pro}','pro','active', now() + interval '30 days'), ('${ACCOUNTS.business}','business','active', now() + interval '30 days');
  INSERT INTO user_roles VALUES ('${ACCOUNTS.admin}','admin');
  INSERT INTO subscription_orders VALUES ('${ACCOUNTS.free}','business','pending');
  INSERT INTO user_points VALUES ('${ACCOUNTS.basic}', 5000);
  INSERT INTO whatsapp_identities VALUES ('+96279100001','${ACCOUNTS.free}'), ('+96279100002','${ACCOUNTS.kids}'), ('+96279100003','${ACCOUNTS.basic}');
`);

async function snapshot() {
  const plans = await q("select id, is_active, name, price_monthly_usd::text price, description, features, limits from public.billing_plans order by id");
  const accountState = {};
  for (const [k, id] of Object.entries(ACCOUNTS)) {
    accountState[k] = {
      plan: (await q("select public.plan_for_user($1) v", [id]))[0].v,
      sections: [...(await q("select public.user_sections($1) v", [id]))[0].v].sort(),
      ai: (await q("select public.ai_user_entitled($1) v", [id]))[0].v,
    };
  }
  const wa = {};
  for (const phone of ["+96279100001", "+96279100002", "+96279100003"]) wa[phone] = (await q("select public.whatsapp_entitlements($1) v", [phone]))[0].v;
  const counts = {
    subscriptions: (await q("select count(*)::int n from user_subscriptions"))[0].n,
    orders: (await q("select count(*)::int n from subscription_orders"))[0].n,
    points: (await q("select coalesce(sum(balance),0)::int n from user_points"))[0].n,
    profiles: (await q("select count(*)::int n from profiles"))[0].n,
    identities: (await q("select count(*)::int n from whatsapp_identities"))[0].n,
  };
  return { plans, accountState, wa, counts, trial: [...(await q("select public.trial_sections() v"))[0].v].sort() };
}
const norm = (plans) => plans.map((p) => ({ ...p, limits: { ...p.limits, ...(p.limits.sections ? { sections: [...p.limits.sections].sort() } : {}) } }));
const without = (plans, drop) => plans.map((p) => ({ ...p, limits: Object.fromEntries(Object.entries(p.limits).filter(([k]) => k !== drop)) }));

const before = await snapshot();
expect("before: the free week has the three free sections", JSON.stringify(before.trial) === JSON.stringify(["assistive", "community", "news"]));
expect("before: the kids plan lists four sections", before.plans.find((p) => p.id === "kids").limits.sections.length === 4);

// ── Apply the two migrations; then apply them again ──
await db.exec(M78);
await db.exec(M79);
const after = await snapshot();
await db.exec(M78);
await db.exec(M79);
const again = await snapshot();
expect("applying both a second time changes nothing at all", JSON.stringify(again) === JSON.stringify(after));

// ── What changed ──
expect("after: the free week has academy, arcade, library besides the free set", JSON.stringify(after.trial) === JSON.stringify(["academy", "arcade", "assistive", "community", "library", "news"]));
const kidsAfter = after.plans.find((p) => p.id === "kids");
expect("after: the kids plan keeps its four and gains academy, arcade, library", JSON.stringify([...kidsAfter.limits.sections].sort()) === JSON.stringify(["academy", "arcade", "assistive", "community", "kids", "library", "news"]));

// ── What must not change ──
expect("every plan's price, name, description, features and active flag are identical",
  JSON.stringify(before.plans.map(({ limits, ...rest }) => rest)) === JSON.stringify(after.plans.map(({ limits, ...rest }) => rest)));
expect("every plan's limits are identical apart from the kids row's section list",
  JSON.stringify(without(before.plans, "sections")) === JSON.stringify(without(after.plans, "sections")));
expect("the section lists of free_trial, basic, pro and business are identical",
  ["free_trial", "basic", "pro", "business"].every((id) => JSON.stringify(before.plans.find((p) => p.id === id).limits.sections) === JSON.stringify(after.plans.find((p) => p.id === id).limits.sections)));
expect("WhatsApp daily allowances are unchanged (kids 50, basic 150, pro 400, business unlimited)",
  JSON.stringify(after.plans.filter((p) => p.id !== "free_trial" && p.id !== "free" && !p.id.startsWith("legacy")).map((p) => [p.id, p.limits.whatsapp_daily_messages])) === JSON.stringify([["basic", 150], ["business", 0], ["kids", 50], ["pro", 400]]));
expect("subscriptions, orders, points, profiles and linked numbers: row counts and the balance are identical", JSON.stringify(before.counts) === JSON.stringify(after.counts));
expect("each paid account keeps the same plan and the same AI entitlement",
  ["kids", "basic", "pro", "business", "admin", "expired"].every((k) => before.accountState[k].plan === after.accountState[k].plan && before.accountState[k].ai === after.accountState[k].ai));
expect("basic, pro, business and admin keep exactly the same sections",
  ["basic", "pro", "business"].every((k) => JSON.stringify(before.accountState[k].sections) === JSON.stringify(after.accountState[k].sections)));
expect("the expired account still has only the free sections", JSON.stringify(after.accountState.expired.sections) === JSON.stringify(["assistive", "community", "news"]));
expect("the free-week account's AI entitlement stays false", after.accountState.free.ai === false);
expect("the Kids subscriber gains the three sections and keeps VisionKids", ["academy", "arcade", "library", "kids"].every((s) => after.accountState.kids.sections.includes(s)));
expect("whatsapp_entitlements is identical for the free-week, Kids and Basic senders",
  JSON.stringify(before.wa) === JSON.stringify(after.wa));

// ── The sections gained never include an AI service, a paid section or the assistant ──
const gainedTrial = after.trial.filter((s) => !before.trial.includes(s));
expect("the free week gains exactly three sections, none of them the assistant or a paid one", JSON.stringify(gainedTrial) === JSON.stringify(["academy", "arcade", "library"]) && !after.accountState.free.sections.includes("assistant"));

// ── Rollback: the SQL in the migration's own header comment, then 20261075's function ──
const rollbackKids = /UPDATE public\.billing_plans SET limits = jsonb_set\(limits, '\{sections\}',\n--\s+'\[[^\n]*\]'::jsonb\) WHERE id = 'kids';/.exec(M78)?.[0];
expect("the Kids rollback statement is present in the migration's header", !!rollbackKids);
const rollbackKidsSql = rollbackKids.replace(/\n--\s+/g, " ");
const rollbackTrial = read("supabase/migrations/20261063000000_trial_is_not_full_access.sql");
const trialFn = /CREATE OR REPLACE FUNCTION public\.trial_sections\(\)[\s\S]*?\$\$;/.exec(rollbackTrial)[0];
await db.exec(rollbackKidsSql);
await db.exec(trialFn);
await db.exec(read("supabase/migrations/20261075000000_whatsapp_gate_renotice.sql"));
const rolled = await snapshot();
expect("rollback: the free week is back to the three free sections", JSON.stringify(rolled.trial) === JSON.stringify(before.trial));
expect("rollback: the kids row lists exactly what it did before", JSON.stringify([...rolled.plans.find((p) => p.id === "kids").limits.sections].sort()) === JSON.stringify([...before.plans.find((p) => p.id === "kids").limits.sections].sort()));
expect("rollback: every plan row, account state, WhatsApp answer and count equals the 'before' snapshot",
  JSON.stringify(norm(rolled.plans)) === JSON.stringify(norm(before.plans))
  && JSON.stringify(rolled.accountState) === JSON.stringify(before.accountState)
  && JSON.stringify(rolled.wa) === JSON.stringify(before.wa)
  && JSON.stringify(rolled.counts) === JSON.stringify(before.counts));
// …and the WhatsApp function is the 20261075 one again: a free-week sender is told, as before 20261079.
const rolledGate = (await q("select public.ai_subscription_gate_whatsapp('+96279100001') v"))[0].v;
expect("rollback of 20261079: a free-week sender is sent the notice again (the pre-079 behaviour)", rolledGate === "blocked_first_notice");

console.log(`\n${total - fail}/${total} passed`);
process.exit(fail ? 1 : 0);
