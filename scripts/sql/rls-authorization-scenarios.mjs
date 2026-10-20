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
// FUNCTION COVERAGE (this is not full authorization coverage). SECURITY DEFINER
// functions that write user_points / credit_wallets / user_subscriptions and that
// anon or authenticated can still EXECUTE after the hardening migrations:
//   exercised here:  admin_adjust_vx, admin_grant_points, admin_user_balances, award_points, spend_vx,
//                    settle_file_conversion, refund_stale_file_conversions
//   privilege only:  system_deduct_vx, billing_grant_credits/consume/refund,
//                    arcade_append_vx, vx_balance (no EXECUTE for anon/authenticated)
//   NOT exercised:   approve_subscription_order, approve_vx_coin_order,
//                    charge_file_conversion, subscribe_radio, subscribe_tv,
//                    award_academy_xp, award_library_xp, award_kids_xp,
//                    award_kids_coins, buy_kids_item, claim_kids_gift,
//                    purchase_kids_product, kids_coin_balance, get_leaderboard,
//                    get_kids_world_stats, vx_account_parity_detail,
//                    vx_wallet_migration_report, vx_wallet_parity_report
//   Also not exercised: the vx_reserve / vx_settle / vx_release family and
//   ivx_*, plan_for_user (no EXECUTE for the public roles; not asserted), the
//   Edge Functions that call these with the service role, and every function
//   that lives only in a migration PGlite cannot replay.
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

// The two privilege-hardening migrations are what take EXECUTE away from anon and
// authenticated on the money and admin functions. They name functions that live in
// migrations PGlite cannot replay, so on their own they abort and the replayed
// database would keep Supabase's default "everyone may execute". Without them the
// function checks below would test a schema production does not have. For these
// two files only, create a do-nothing stand-in for each function they name and
// retry. The stand-ins are never called; they exist so the REVOKE statements run.
const HARDENING = /^(20260906000000_rpc_execute_isolation|20261017000000_rpc_and_storage_least_privilege)\.sql$/;
async function standIn(msg) {
  let m = msg.match(/no function named public\.(\w+) exists/);
  if (m) { await db.exec(`create function public.${m[1]}() returns void language sql as 'select 1'`); return m[1]; }
  m = msg.match(/function public\.(\w+)\(([^)]*)\) does not exist/);
  if (m) {
    const args = m[2].split(",").map((s, i) => `a${i} ${s.trim()}`).join(",");
    await db.exec(`create function public.${m[1]}(${args}) returns void language sql as 'select 1'`);
    return m[1];
  }
  return null;
}

let applied = 0;
let skipped = 0;
const hardeningApplied = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const sql = readFileSync(`${dir}/${f}`, "utf8");
  for (let attempt = 0; attempt < 50; attempt++) {
    try { await db.exec(sql); applied++; if (HARDENING.test(f)) hardeningApplied.push(f); break; } catch (e) {
      const stub = HARDENING.test(f) ? await standIn(String(e.message).split("\n")[0]) : null;
      if (!stub) { skipped++; break; }
    }
  }
}
console.log(`migrations replayed: ${applied} applied, ${skipped} skipped (PGlite lacks pg_cron/pgvector/pgcrypto/realtime)`);
if (hardeningApplied.length !== 2) {
  console.log(`FAIL  the privilege-hardening migrations did not both replay (${hardeningApplied.length}/2); the function checks would test the wrong schema`);
  process.exit(1);
}

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
  const role = who === "anon" ? "anon" : who === "SERVICE" ? "service_role" : "authenticated";
  const sub = who === "anon" || who === "SERVICE" ? "" : { A, B, ADMIN }[who];
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

// Call one statement as a role, then read the state back as the table owner in
// the same transaction, then roll everything back. This is what separates "the
// call was refused" from "the call ran and changed someone's balance": a refusal
// that still moved points would show in `after`.
async function probe(who, callSql, stateSql) {
  const role = who === "anon" ? "anon" : who === "SERVICE" ? "service_role" : "authenticated";
  const sub = who === "anon" || who === "SERVICE" ? "" : { A, B, ADMIN }[who];
  let call;
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${sub}',true), set_config('request.jwt.claim.role','${role}',true);`);
    await db.exec("savepoint probe_call");
    try { call = { rows: (await db.query(callSql)).rows }; } catch (e) { call = { error: e.message.split("\n")[0] }; await db.exec("rollback to savepoint probe_call"); }
    await db.exec("reset role");
    const state = (await db.query(stateSql)).rows[0]?.v;
    return { ...call, state: Number(state) };
  } finally {
    await db.exec("rollback");
  }
}
const sumPoints = (id) => `select coalesce(sum(points),0) v from public.user_points where user_id='${id}'`;
const canExec = async (who, sig) => (await db.query(`select has_function_privilege('${who}', '${sig}', 'execute') v`)).rows[0].v;

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

  // Other people's rows: refused for writes, not just invisible for reads.
  check("user_points: A cannot edit B's points", !(await wrote("A", `update public.user_points set points = 0 where user_id='${B}' returning 1`)));
  check("user_points: A cannot delete B's history", !(await wrote("A", `delete from public.user_points where user_id='${B}' returning 1`)));
  check("user_points: A cannot insert a row for B", !(await wrote("A", `insert into public.user_points(user_id, points, reason) values ('${B}', -20, 'x') returning 1`)));
  check("credit_wallets: A cannot edit B's balance", !(await wrote("A", `update public.credit_wallets set balance_vx = 0 where user_id='${B}' returning 1`)));
  check("credit_wallets: A cannot delete B's wallet", !(await wrote("A", `delete from public.credit_wallets where user_id='${B}' returning 1`)));
  check("user_subscriptions: A cannot cancel B's plan", !(await wrote("A", `update public.user_subscriptions set status='cancelled' where user_id='${B}' returning 1`)));
  check("user_subscriptions: A cannot delete B's plan", !(await wrote("A", `delete from public.user_subscriptions where user_id='${B}' returning 1`)));
  check("user_subscriptions: A cannot delete own plan", !(await wrote("A", `delete from public.user_subscriptions where user_id='${A}' returning 1`)));
  // Anonymous writes, on every table the matrix covers.
  for (const [table, ins, upd] of [
    ["user_points", `insert into public.user_points(user_id, points, reason) values ('${A}', 5, 'x') returning 1`, `update public.user_points set points = 0 returning 1`],
    ["credit_wallets", `insert into public.credit_wallets(user_id, balance_vx) values ('${U(9)}', 5) returning 1`, `update public.credit_wallets set balance_vx = 0 returning 1`],
    ["user_subscriptions", `insert into public.user_subscriptions(user_id, plan_id, status) values ('${U(9)}','pro','active') returning 1`, `update public.user_subscriptions set status='active' returning 1`],
  ]) {
    check(`${table}: anonymous cannot insert`, !(await wrote("anon", ins)));
    check(`${table}: anonymous cannot update`, !(await wrote("anon", upd)));
    check(`${table}: anonymous cannot delete`, !(await wrote("anon", `delete from public.${table} returning 1`)));
  }

  // SECURITY DEFINER functions are the real write path for money. Table policies
  // do not apply inside them, so each one needs its own proof.
  // 1. Functions that act on ANY user are not callable by the public roles at all.
  for (const sig of ["system_deduct_vx(uuid,integer,text)", "billing_grant_credits(uuid,integer,text,text)", "billing_consume(uuid,text,text,uuid,text,text,jsonb)", "billing_refund(uuid,text,text)", "arcade_append_vx(uuid,integer,text,text,text,text)", "vx_balance(uuid)"]) {
    check(`${sig.split("(")[0]}: no EXECUTE for anon`, !(await canExec("anon", `public.${sig}`)));
    check(`${sig.split("(")[0]}: no EXECUTE for authenticated`, !(await canExec("authenticated", `public.${sig}`)));
  }
  const deduct = `select public.system_deduct_vx('${B}', 5, 'probe')`;
  const asA = await probe("A", deduct, sumPoints(B));
  check("system_deduct_vx: A cannot deduct from B (refused, balance untouched)", !!asA.error && asA.state === 20);
  const asAnon = await probe("anon", deduct, sumPoints(B));
  check("system_deduct_vx: anonymous cannot deduct from B (refused, balance untouched)", !!asAnon.error && asAnon.state === 20);
  const asService = await probe("SERVICE", deduct, sumPoints(B));
  check("system_deduct_vx: the service role can (the intended server path works)", !asService.error && asService.state === 15);
  // 2. Admin functions: refused for ordinary users and anonymous, work for an admin.
  const grant = `select public.admin_grant_points('${B}', 1000, 'probe')`;
  const adjust = `select public.admin_adjust_vx('b@example.test', 1000, 'probe')`;
  const grantA = await probe("A", grant, sumPoints(B));
  check("admin_grant_points: A refused, B untouched", !!grantA.error && grantA.state === 20);
  const grantAnon = await probe("anon", grant, sumPoints(B));
  check("admin_grant_points: anonymous refused, B untouched", !!grantAnon.error && grantAnon.state === 20);
  const adjA = await probe("A", adjust, sumPoints(B));
  check("admin_adjust_vx: A refused, B untouched", adjA.state === 20 && (adjA.error || adjA.rows?.[0]?.admin_adjust_vx?.success === false));
  check("admin_grant_points: an admin can (positive control)", (await probe("ADMIN", grant, sumPoints(B))).state === 1020);
  // 3. Self-service functions: they act on auth.uid() and nobody else.
  const spend = (n) => `select public.spend_vx(${n}, 'probe item', 'item', 'probe')`;
  const spendA = await probe("A", spend(4), sumPoints(A));
  check("spend_vx: A can spend own VX (positive control)", !spendA.error && spendA.state === 6);
  check("spend_vx: B's balance is not touched by A spending", (await probe("A", spend(4), sumPoints(B))).state === 20);
  const over = await probe("A", spend(11), sumPoints(A));
  check("spend_vx: A cannot overspend (refused, balance untouched)", !!over.error && over.state === 10);
  const neg = await probe("A", spend(-5), sumPoints(A));
  check("spend_vx: a negative amount cannot mint points", !!neg.error && neg.state === 10);
  const spendAnon = await probe("anon", spend(1), sumPoints(A));
  check("spend_vx: anonymous refused", !!spendAnon.error && spendAnon.state === 10);
  const award = (p, r) => `select public.award_points(${p}, '${r}')`;
  const big = await probe("A", award(1000000, "Daily login bonus"), sumPoints(A));
  check("award_points: A cannot award above the cap", !!big.error && big.state === 10);
  const forged = await probe("A", award(5, "made up reason"), sumPoints(A));
  check("award_points: an unknown reason is refused", !!forged.error && forged.state === 10);
  const anonAward = await probe("anon", award(5, "Daily login bonus"), sumPoints(A));
  check("award_points: anonymous refused", !!anonAward.error && anonAward.state === 10);
  const fcA = await probe("A", `select public.settle_file_conversion('${U(77)}'::uuid, false)`, sumPoints(A));
  check("settle_file_conversion: A cannot refund a charge that is not theirs", !!fcA.error && fcA.state === 10);
  const fcAnon = await probe("anon", `select public.refund_stale_file_conversions()`, sumPoints(A));
  check("refund_stale_file_conversions: anonymous refused", !!fcAnon.error && fcAnon.state === 10);

  // admin_user_balances: the totals the admin user list shows. An admin session cannot
  // read other users' user_points rows (no admin policy), which is why it exists.
  check("user_points: an admin session reads none of the rows (the reason admin_user_balances exists)", (await as("ADMIN", "select 1 from public.user_points")).rows?.length === 0);
  check("admin_user_balances: no EXECUTE for anon", !(await canExec("anon", "public.admin_user_balances()")));
  // service_role holds EXECUTE (the grant list matches the other admin RPCs) but has no
  // auth.uid(), so the admin check inside refuses it: the totals are for an admin session only.
  check("admin_user_balances: the service role holds EXECUTE but is refused by the admin check", await canExec("service_role", "public.admin_user_balances()") && (await as("SERVICE", "select public.admin_user_balances() b")).error === "Admin access required");
  const balAnon = await as("anon", "select public.admin_user_balances() b");
  check("admin_user_balances: anonymous refused", !!balAnon.error);
  const balA = await as("A", "select public.admin_user_balances() b");
  check("admin_user_balances: an ordinary user is refused and gets no data", !!balA.error && !balA.rows?.length);
  const balAdmin = await as("ADMIN", "select public.admin_user_balances() b");
  const totals = balAdmin.rows?.[0]?.b;
  check("admin_user_balances: an admin gets each seeded user's balance, keyed by the right user", !balAdmin.error && totals?.[A] === 10 && totals?.[B] === 20 && Object.keys(totals ?? {}).length === 2);
  // Several rows per user, including a negative one, are summed; a user with no rows is absent.
  await db.exec("begin");
  try {
    await db.exec(`insert into public.user_points(user_id, points, reason) values ('${B}', -5, 't1'), ('${B}', 30, 't2')`);
    // vx_balance is the definition of a balance; read it as the owner, before dropping to the admin role.
    const ref = Object.fromEntries(await Promise.all([A, B, ADMIN].map(async (u) => [u, (await db.query(`select public.vx_balance('${u}') v`)).rows[0].v])));
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${ADMIN}',true), set_config('request.jwt.claim.role','authenticated',true)`);
    const multi = (await db.query("select public.admin_user_balances() b")).rows[0].b;
    check("admin_user_balances: equals vx_balance() for every user (a user with no rows is absent where vx_balance is 0)", [A, B, ADMIN].every((u) => (multi[u] ?? 0) === ref[u]) && ref[B] === 45);
    check("admin_user_balances: sums several rows per user, negatives included, and omits users with none", multi[B] === 45 && multi[A] === 10 && !(ADMIN in multi));
  } finally { await db.exec("rollback"); }
  const writes = await db.query("select count(*)::int n from public.user_points");
  check("admin_user_balances: read-only, no row was written", writes.rows[0].n === 2);

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
const grantDef = (await db.query(`select pg_get_functiondef('public.admin_grant_points(uuid,integer,text)'::regprocedure) d`)).rows[0].d;
const balancesDef = (await db.query(`select pg_get_functiondef('public.admin_user_balances()'::regprocedure) d`)).rows[0].d;
const mutations = [
  ["admin_user_balances loses its admin check", balancesDef.replace(/IF NOT public\.has_role\(auth\.uid\(\), 'admin'(::\w+)?\) THEN\s+RAISE EXCEPTION 'Admin access required';\s+END IF;/i, ""), balancesDef],
  ["admin_user_balances executable by anon", `grant execute on function public.admin_user_balances() to anon`, `revoke execute on function public.admin_user_balances() from anon`],
  ["system_deduct_vx executable by authenticated", `grant execute on function public.system_deduct_vx(uuid,integer,text) to authenticated`, `revoke execute on function public.system_deduct_vx(uuid,integer,text) from authenticated`],
  ["user_subscriptions readable by everyone", `drop policy sub_owner_select on public.user_subscriptions; create policy zz_s on public.user_subscriptions for select using (true)`, `drop policy zz_s on public.user_subscriptions; create policy sub_owner_select on public.user_subscriptions for select using (user_id = auth.uid())`],
  ["admin_grant_points loses its admin check", grantDef.replace(/IF NOT public\.has_role\(auth\.uid\(\), 'admin'(::\w+)?\) THEN\s+RAISE EXCEPTION 'Admin access required';\s+END IF;/i, ""), grantDef],
  ["user_points readable by everyone", `drop policy "Users can view their own points" on public.user_points; create policy zz_open on public.user_points for select using (true)`, `drop policy zz_open on public.user_points; create policy "Users can view their own points" on public.user_points for select using (auth.uid() = user_id)`],
  ["credit_wallets writable by authenticated", `grant update on public.credit_wallets to authenticated; create policy zz_w on public.credit_wallets for update using (true) with check (true)`, `drop policy zz_w on public.credit_wallets; revoke update on public.credit_wallets from authenticated`],
  ["user_roles insertable by authenticated", `create policy zz_r on public.user_roles for insert with check (true)`, `drop policy zz_r on public.user_roles`],
  ["whatsapp_conversations readable by everyone", `create policy zz_wa on public.whatsapp_conversations for select using (true)`, `drop policy zz_wa on public.whatsapp_conversations`],
];
for (const [name, apply, undo] of mutations) {
  if (apply === undo) { fail++; console.log(`FAIL  mutation "${name}" changed nothing (its pattern no longer matches)`); continue; }
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
