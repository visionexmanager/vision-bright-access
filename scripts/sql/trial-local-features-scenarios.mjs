// 20261104000300 - the free week's local features, executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/trial-local-features-scenarios.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE public.whatsapp_identities (wa_phone text PRIMARY KEY, user_id uuid);
  -- Stand-in for the real plan resolution: the plan is whatever the test table says.
  CREATE TABLE public.plans_stub (user_id uuid PRIMARY KEY, plan text);
  CREATE FUNCTION public.plan_for_user(_u uuid) RETURNS text LANGUAGE sql AS
    $$ SELECT coalesce((SELECT plan FROM public.plans_stub WHERE user_id = _u), 'none') $$;
`);
const sql = readFileSync("supabase/migrations/20261104000300_trial_local_features.sql", "utf8");
await db.exec(sql);
await db.exec(sql); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const call = async (fn, ...args) =>
  (await db.query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as v`, args)).rows[0].v;
const mk = async (phone, plan) => {
  const id = (await db.query("INSERT INTO auth.users DEFAULT VALUES RETURNING id")).rows[0].id;
  await db.query("INSERT INTO public.whatsapp_identities VALUES ($1,$2)", [phone, id]);
  if (plan) await db.query("INSERT INTO public.plans_stub VALUES ($1,$2)", [id, plan]);
  return id;
};

const trial = await mk("96170000001", "free_trial");
let r = await call("trial_local_take", "96170000001", "office");
expect("first unit: ok, limit 3, 2 left", r.status === "ok" && r.limit === 3 && r.remaining === 2);
await call("trial_local_take", "96170000001", "office");
r = await call("trial_local_take", "96170000001", "office");
expect("third unit: ok, 0 left", r.status === "ok" && r.remaining === 0);
r = await call("trial_local_take", "96170000001", "office");
expect("fourth unit: exhausted at the limit", r.status === "exhausted" && r.used === 3 && r.remaining === 0);
expect("the count never passes the limit", (await db.query("select used from public.trial_local_usage where user_id=$1 and feature='office'", [trial])).rows[0].used === 3);

r = await call("trial_local_release", "96170000001", "office");
expect("release hands one back", r.status === "ok" && r.remaining === 1);
expect("...and it can be taken again", (await call("trial_local_take", "96170000001", "office")).status === "ok");
await call("trial_local_release", "96170000001", "barcode");
expect("releasing a feature never used does not go negative", (await db.query("select count(*)::int n from public.trial_local_usage where used < 0")).rows[0].n === 0);

expect("features are counted separately", (await call("trial_local_take", "96170000001", "read_text")).limit === 10);
expect("an unknown feature is refused", (await call("trial_local_take", "96170000001", "ai_chat")).status === "not_trial");

// Simultaneous takes cannot exceed the limit.
await mk("96170000002", "free_trial");
const burst = await Promise.all(Array.from({ length: 15 }, () => call("trial_local_take", "96170000002", "barcode")));
expect("15 simultaneous takes grant exactly 10", burst.filter((x) => x.status === "ok").length === 10 && burst.filter((x) => x.status === "exhausted").length === 5);

// Only the free week.
await mk("96170000003", "basic");
await mk("96170000004", "none");
await mk("96170000005", "admin");
for (const p of ["96170000003", "96170000004", "96170000005", "96170099999", ""]) {
  expect(`not_trial for ${p || "(empty)"}`, (await call("trial_local_take", p, "read_text")).status === "not_trial");
}

// Grants.
const can = async (role, sig) => (await db.query(`select has_function_privilege('${role}', '${sig}', 'EXECUTE') as ok`)).rows[0].ok;
for (const sig of ["public.trial_local_take(text, text)", "public.trial_local_release(text, text)", "public.trial_local_limit(text)"]) {
  expect(`${sig}: service_role only`, (await can("service_role", sig)) && !(await can("anon", sig)) && !(await can("authenticated", sig)));
}
expect("the usage table has RLS on and no policy",
  (await db.query("select relrowsecurity r from pg_class where relname='trial_local_usage'")).rows[0].r === true &&
  (await db.query("select count(*)::int n from pg_policies where tablename='trial_local_usage'")).rows[0].n === 0);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
