// 20261064 — the free week no longer waives VX for a bazaar shop or a paid course.
// Executed in PGlite over minimal stubs of the tables the two functions touch.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/trial-waiver-scenarios.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  -- A user who IS on the free week, under every flag the old code looked at.
  CREATE TABLE public.users_billing (user_id uuid PRIMARY KEY, is_in_trial boolean, trial_ends_at timestamptz);
  CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, trial_expires_at timestamptz, created_at timestamptz DEFAULT now());
  CREATE TABLE public.academy_courses (id uuid PRIMARY KEY, status text, is_free boolean, price_vx integer, title text);
  CREATE TABLE public.academy_enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, course_id uuid,
    progress_percent integer DEFAULT 0, completed_at timestamptz, current_lesson_id uuid, last_position_seconds integer,
    UNIQUE (user_id, course_id));
  CREATE TABLE public.bazaar_shops (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, name text, tier text,
    description text, theme_color text, sign_style text, country text, is_active boolean,
    email_notifications boolean, whatsapp_notifications boolean, whatsapp_number text);
  CREATE TABLE public.spent (amount integer, kind text, item text);
  CREATE FUNCTION public.spend_vx(_amount integer, _kind text, _item_id text, _item_name text) RETURNS void
    LANGUAGE sql AS $$ INSERT INTO public.spent VALUES (_amount, _kind, _item_id) $$;
`);
const sql = readFileSync("supabase/migrations/20261064000000_trial_stops_waiving_vx.sql", "utf8");
await db.exec(sql);
await db.exec(sql); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const U = "00000000-0000-0000-0000-000000000001";
const paid = "00000000-0000-0000-0000-0000000000c1";
const free = "00000000-0000-0000-0000-0000000000c2";
await db.exec(`
  INSERT INTO users_billing VALUES ('${U}', true, now() + interval '5 days');
  INSERT INTO profiles VALUES ('${U}', now() + interval '5 days');
  INSERT INTO academy_courses VALUES ('${paid}', 'published', false, 3000, 'Paid'), ('${free}', 'published', true, 0, 'Free');
  select set_config('test.uid', '${U}', false);
`);
const spent = async () => (await db.query("select count(*)::int n, coalesce(sum(amount),0)::int total from public.spent")).rows[0];

await db.query("select * from public.academy_enroll_course($1)", [paid]);
let s = await spent();
expect("a trial account enrolling in a PAID course is charged the course price", s.n === 1 && s.total === 3000);
await db.query("select * from public.academy_enroll_course($1)", [free]);
s = await spent();
expect("a FREE course still costs nothing", s.n === 1);
await db.query("select * from public.academy_enroll_course($1)", [paid]);
expect("enrolling twice is idempotent and not charged twice", (await spent()).n === 1);

const shop = await db.query("select public.create_bazaar_shop('Shop', 'flagship', null, '#f59e0b', 'neon', null, true, false, null) id");
s = await spent();
expect("a trial account opening a flagship shop is charged 150,000 VX", s.n === 2 && s.total === 3000 + 150000);
expect("…and the shop exists", !!shop.rows[0].id);

let denied = 0;
for (const role of ["anon"]) {
  await db.exec(`SET ROLE ${role}`);
  for (const q of [`select * from public.academy_enroll_course('${paid}')`, "select public.create_bazaar_shop('Shop', 'kiosk')"]) {
    try { await db.query(q); } catch { denied++; }
  }
  await db.exec("RESET ROLE");
}
expect("anon can call neither function", denied === 2);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
