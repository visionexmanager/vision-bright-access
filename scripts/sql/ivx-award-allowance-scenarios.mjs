// 20261059 — the IVX rewards draw from the daily VX allowance — executed
// against real PostgreSQL (PGlite).
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/ivx-award-allowance-scenarios.mjs
//
// There is no Docker or psql here, and no CI job runs the SQL. This applies
// 20261043 (the allowance) and 20261059 over stubs of the IVX tables, with
// ivx_grade stubbed to a fixed 25 XP, and drives both rewards with real calls.
// Exit status 1 on any failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const R = new URL("../../supabase/migrations/", import.meta.url);
const U = "00000000-0000-0000-0000-000000000001";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
  CREATE TABLE public.user_points (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, points integer NOT NULL, reason text NOT NULL, created_at timestamptz DEFAULT now());
  CREATE TABLE public.academy_xp_events (user_id uuid, amount integer, reason text);
  CREATE TABLE public.academy_profiles (user_id uuid PRIMARY KEY, xp_total integer DEFAULT 0, last_active timestamptz);
  CREATE TABLE public.ivx_sessions (user_id uuid, channel text, open_question uuid);
  CREATE TABLE public.ivx_projects (slug text PRIMARY KEY, xp_award integer);
  CREATE TABLE public.ivx_project_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, project_slug text,
    status text, score numeric, feedback jsonb, xp_awarded integer DEFAULT 0, graded_at timestamptz, updated_at timestamptz);
  CREATE FUNCTION public.ivx_wa_user(_p text) RETURNS uuid LANGUAGE sql AS $$ SELECT CASE WHEN _p = '+100' THEN '${U}'::uuid END $$;
  CREATE FUNCTION public.ivx_grade(_u uuid, _q uuid, _g text, _h integer, _t integer, _l text, _c text) RETURNS jsonb
    LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'correct', true, 'xp', 25) $$;
`);
for (const f of ["20261043000000_vx_self_award_daily_allowance.sql", "20261059000000_ivx_awards_through_allowance.sql"]) {
  try { await db.exec(readFileSync(new URL(f, R), "utf8")); } catch (e) { throw new Error(`${f}: ${e.message}`); }
}
await db.exec(`INSERT INTO academy_profiles (user_id) VALUES ('${U}');
  INSERT INTO ivx_sessions VALUES ('${U}', 'whatsapp', gen_random_uuid());
  INSERT INTO ivx_projects VALUES ('big', 1500), ('small', 300);`);

const one = async (s, p) => (await db.query(s, p)).rows[0];
const vx = async () => Number((await one(`select coalesce(sum(points),0) s from user_points where user_id=$1`, [U])).s);
const xpTotal = async () => (await one(`select xp_total from academy_profiles where user_id=$1`, [U])).xp_total;
const events = async () => Number((await one(`select coalesce(sum(amount),0) s from academy_xp_events where user_id=$1`, [U])).s);
const answer = async () => (await one(`select ivx_wa_submit_answer('+100', '3/4') r`)).r;
const submit = (slug) => db.query(`INSERT INTO ivx_project_submissions (user_id, project_slug, status) VALUES ($1, $2, 'submitted')
                                   ON CONFLICT DO NOTHING`, [U, slug]);
const grade = async (slug, score) => (await one(`select ivx_project_grade($1, $2, $3, '{}') r`, [U, slug, score])).r;

let failures = 0;
const ok = (label, cond, extra = "") => { if (!cond) failures++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  " + extra : ""}`); };

let r = await answer();
ok("one WhatsApp answer credits 25 VX, 25 XP, one event", r.ok && await vx() === 25 && await xpTotal() === 25 && await events() === 25, JSON.stringify(r));

await submit("big");
r = await grade("big", 90);
ok("a 1,500 project credits 1,500 (1,525 of 2,000 used)", r.xp === 1500 && await vx() === 1525, JSON.stringify(r));

for (let i = 0; i < 30; i++) await answer();
ok("30 more answers stop at the 2,000 allowance", await vx() === 2000, String(await vx()));
ok("...and XP, events and VX stay one figure", await xpTotal() === 2000 && await events() === 2000);
r = await answer();
ok("over the allowance the answer is still graded — only the reward stops", r.ok === true && await vx() === 2000);

await submit("small");
r = await grade("small", 80);
const sub = await one(`select status, xp_awarded from ivx_project_submissions where project_slug='small'`);
ok("a project graded over the allowance: graded, 0 credited, 0 recorded", r.ok && r.xp === 0 && sub.status === "graded" && sub.xp_awarded === 0 && await vx() === 2000, JSON.stringify(sub));

// The next UTC day: a regrade tops up to the award, because 0 was recorded.
await db.exec(`UPDATE vx_self_award_daily SET day = day - 1; UPDATE ivx_project_submissions SET status = 'submitted' WHERE project_slug = 'small';`);
r = await grade("small", 80);
ok("next day, a regrade tops up the trimmed project (300)", r.xp === 300 && await vx() === 2300, JSON.stringify(r));

r = await one(`select ivx_wa_submit_answer('+999', '1') r`).then((x) => x.r);
ok("an unlinked number: not_linked, nothing credited", r.reason === "not_linked" && await vx() === 2300);

// Grants are unchanged by CREATE OR REPLACE; the allowance itself stays service-only.
const can = async (role, fn) => (await one(`select has_function_privilege($1, $2, 'EXECUTE') x`, [role, fn])).x;
ok("vx_self_award_take stays service_role only", await can("service_role", "public.vx_self_award_take(uuid,integer)")
   && !(await can("authenticated", "public.vx_self_award_take(uuid,integer)")) && !(await can("anon", "public.vx_self_award_take(uuid,integer)")));

try { await db.exec(readFileSync(new URL("20261059000000_ivx_awards_through_allowance.sql", R), "utf8")); ok("re-runs cleanly", true); }
catch (e) { ok("re-runs cleanly", false, e.message); }

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
if (failures) process.exit(1);
