// Row-level security, executed as real roles in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/rls-authorization-scenarios.mjs
//
// Replays every migration in supabase/migrations over minimal Supabase stubs
// (auth schema, roles, default privileges as Supabase sets them) and then drives
// the sensitive tables as anonymous, user A, user B and an admin. Synthetic users
// only; no network, no credentials.
//
// What it proves, per table: who can read which rows, and who can write at all.
// It then MUTATES one policy at a time (turns an owner-only SELECT into
// `USING (true)`, or hands the write privilege to `authenticated`) and requires
// the matrix to go red, so a pass cannot be vacuous.
//
// Not every migration replays in PGlite (no pg_cron, pgvector, pgcrypto, a
// realtime publication). Those files fail and are skipped; the tables this script
// depends on are checked to exist, and the count of skipped files is printed.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "supabase/migrations");
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin; create role supabase_admin nologin;
  create schema auth; create schema extensions; create schema storage; create schema realtime; create schema vault;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), email_confirmed_at timestamptz, phone text, raw_app_meta_data jsonb default '{}', last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
  create function storage.filename(name text) returns text language sql as $$ select name $$;
  grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

let applied = 0;
let skipped = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(`${dir}/${f}`, "utf8")); applied++; } catch { skipped++; }
}
console.log(`migrations replayed: ${applied} applied, ${skipped} skipped (PGlite lacks pg_cron/pgvector/pgcrypto/realtime)`);

const REQUIRED = ["user_points", "credit_wallets", "user_subscriptions", "notifications", "profiles", "user_roles", "whatsapp_conversations"];
for (const t of REQUIRED) {
  const r = await db.query("select c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=$1", [t]);
  if (!r.rows[0]) { console.log(`FAIL  table public.${t} did not replay; the matrix cannot run`); process.exit(1); }
  if (!r.rows[0].rls) { console.log(`FAIL  row level security is OFF on public.${t}`); process.exit(1); }
}

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const A = U(1), B = U(2), ADMIN = U(3);

async function seed() {
  // Creating the auth user fires the project's own signup triggers (profile,
  // wallet, welcome rows). Create the users first, then clear whatever those
  // triggers made, so every probe starts from exactly the rows seeded below.
  await db.exec(`
    insert into auth.users(id,email) values ('${A}','a@example.test'),('${B}','b@example.test'),('${ADMIN}','admin@example.test') on conflict do nothing;
    delete from public.user_roles where user_id in ('${A}','${B}','${ADMIN}');
    delete from public.user_points where user_id in ('${A}','${B}');
    delete from public.credit_wallets where user_id in ('${A}','${B}');
    delete from public.user_subscriptions where user_id in ('${A}','${B}');
    delete from public.notifications where user_id in ('${A}','${B}');
    delete from public.profiles where user_id in ('${A}','${B}','${ADMIN}');
    delete from public.whatsapp_conversations where wa_phone = '+10000000001';
    insert into public.user_roles(user_id, role) values ('${ADMIN}','admin');
    insert into public.user_points(user_id, points, reason) values ('${A}', 10, 'seed'), ('${B}', 20, 'seed');
    insert into public.credit_wallets(user_id, balance_vx) values ('${A}', 100), ('${B}', 200);
    insert into public.user_subscriptions(user_id, plan_id, status) values ('${A}', 'basic', 'active'), ('${B}', 'pro', 'active');
    insert into public.notifications(user_id, title, body, type) values ('${A}', 'for A', 'x', 'info'), ('${B}', 'for B', 'x', 'info');
    insert into public.profiles(user_id, display_name, status, ban_reason, is_verified) values
      ('${A}', 'A', 'banned', 'abuse', false), ('${B}', 'B', 'active', null, false), ('${ADMIN}', 'Admin', 'active', null, false);
    insert into public.whatsapp_conversations(wa_phone) values ('+10000000001');
  `);
}

// Run one statement as a role; returns { rows } or { error }. Writes are
// rolled back so every probe starts from the seed.
async function as(who, sql) {
  const role = who === "anon" ? "anon" : "authenticated";
  const sub = who === "anon" ? "" : { A, B, ADMIN }[who];
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${sub}',true), set_config('request.jwt.claim.role','${role}',true);`);
    const r = await db.query(sql);
    return { rows: r.rows, count: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { error: e.message.split("\n")[0] };
  } finally {
    await db.exec("rollback");
  }
}

async function matrix() {
  const out = [];
  const check = (label, cond) => out.push({ label, ok: !!cond });
  const sees = async (who, table, col, val) => ((await as(who, `select 1 from public.${table} where ${col}='${val}'`)).rows ?? []).length;
  const wrote = async (who, sql) => { const r = await as(who, sql); return !r.error && (r.count ?? 0) > 0; };

  for (const [table, col] of [["user_points", "user_id"], ["credit_wallets", "user_id"], ["user_subscriptions", "user_id"], ["notifications", "user_id"], ["profiles", "user_id"]]) {
    check(`${table}: A reads own row`, (await sees("A", table, col, A)) === 1);
    check(`${table}: A cannot read B's row`, (await sees("A", table, col, B)) === 0);
    check(`${table}: anonymous reads nothing`, (await sees("anon", table, col, A)) === 0);
  }
  check("profiles: admin reads another user's profile", (await sees("ADMIN", "profiles", "user_id", A)) === 1);
  check("notifications: admin can see everyone's notifications", (await sees("ADMIN", "notifications", "user_id", B)) === 1);

  // Money and entitlement tables are written by the server only.
  check("user_points: A cannot add points to self", !(await wrote("A", `insert into public.user_points(user_id, points, reason) values ('${A}', 1000000, 'x') returning 1`)));
  check("user_points: A cannot edit own points", !(await wrote("A", `update public.user_points set points = 1000000 where user_id='${A}' returning 1`)));
  check("user_points: A cannot delete own history", !(await wrote("A", `delete from public.user_points where user_id='${A}' returning 1`)));
  check("credit_wallets: A cannot raise own balance", !(await wrote("A", `update public.credit_wallets set balance_vx = 999999 where user_id='${A}' returning 1`)));
  check("credit_wallets: A cannot create a wallet row", !(await wrote("A", `insert into public.credit_wallets(user_id, balance_vx) values ('${U(9)}', 5) returning 1`)));
  check("user_subscriptions: A cannot upgrade own plan", !(await wrote("A", `update public.user_subscriptions set plan_id='business' where user_id='${A}' returning 1`)));
  check("user_subscriptions: A cannot grant self a subscription", !(await wrote("A", `insert into public.user_subscriptions(user_id, plan_id, status) values ('${U(9)}','pro','active') returning 1`)));
  check("user_subscriptions: anonymous cannot write", !(await wrote("anon", `update public.user_subscriptions set status='active' returning 1`)));

  // Roles.
  check("user_roles: A cannot make self admin", !(await wrote("A", `insert into public.user_roles(user_id, role) values ('${A}','admin') returning 1`)));
  check("user_roles: A cannot promote an existing row", !(await wrote("A", `update public.user_roles set role='admin' where user_id='${ADMIN}' returning 1`)));
  check("user_roles: A cannot read the admin's role row", (await sees("A", "user_roles", "user_id", ADMIN)) === 0);

  // Profiles: own display fields yes, moderation fields no, other people no.
  check("profiles: A can rename self", await wrote("A", `update public.profiles set display_name='A2' where user_id='${A}' returning 1`));
  check("profiles: A cannot edit B", !(await wrote("A", `update public.profiles set display_name='x' where user_id='${B}' returning 1`)));
  check("profiles: banned A cannot lift own ban", !(await wrote("A", `update public.profiles set status='active', ban_reason=null where user_id='${A}' returning 1`)));
  check("profiles: A cannot self-verify", !(await wrote("A", `update public.profiles set is_verified=true where user_id='${A}' returning 1`)));

  // Notifications: mark own read, nothing else, nobody else's, no forging.
  check("notifications: A can mark own as read", await wrote("A", `update public.notifications set is_read=true where user_id='${A}' returning 1`));
  check("notifications: A cannot touch B's", !(await wrote("A", `update public.notifications set is_read=true where user_id='${B}' returning 1`)));
  check("notifications: A cannot send one to B", !(await wrote("A", `insert into public.notifications(user_id, title, body, type) values ('${B}','phish','x','info') returning 1`)));

  // WhatsApp conversations hold phone numbers: admins only.
  check("whatsapp_conversations: A reads none", (await as("A", "select 1 from public.whatsapp_conversations")).rows?.length === 0);
  check("whatsapp_conversations: anonymous reads none", (await as("anon", "select 1 from public.whatsapp_conversations")).rows?.length === 0);
  check("whatsapp_conversations: admin reads", (await as("ADMIN", "select 1 from public.whatsapp_conversations")).rows?.length === 1);
  return out;
}

let fail = 0;
await seed();
const base = await matrix();
for (const r of base) { if (!r.ok) fail++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }

// Mutation proof: each change below must turn at least one check red.
const mutations = [
  ["user_points readable by everyone", `drop policy "Users can view their own points" on public.user_points; create policy zz_open on public.user_points for select using (true)`, `drop policy zz_open on public.user_points; create policy "Users can view their own points" on public.user_points for select using (auth.uid() = user_id)`],
  ["credit_wallets writable by authenticated", `grant update on public.credit_wallets to authenticated; create policy zz_w on public.credit_wallets for update using (true) with check (true)`, `drop policy zz_w on public.credit_wallets; revoke update on public.credit_wallets from authenticated`],
  ["user_roles insertable by authenticated", `create policy zz_r on public.user_roles for insert with check (true)`, `drop policy zz_r on public.user_roles`],
  ["whatsapp_conversations readable by everyone", `create policy zz_wa on public.whatsapp_conversations for select using (true)`, `drop policy zz_wa on public.whatsapp_conversations`],
];
for (const [name, apply, undo] of mutations) {
  await db.exec(apply);
  const red = (await matrix()).filter((r) => !r.ok).length;
  await db.exec(undo);
  const detected = red > 0;
  if (!detected) fail++;
  console.log(`${detected ? "PASS" : "FAIL"}  mutation "${name}" turns the matrix red (${red} checks)`);
}
const after = (await matrix()).filter((r) => !r.ok).length;
if (after !== 0) { fail++; console.log(`FAIL  matrix not green again after undoing mutations (${after} red)`); }

console.log(fail ? `\n${fail} failure(s)` : `\nall ${base.length} checks and ${mutations.length} mutation proofs passed`);
process.exit(fail ? 1 : 0);
