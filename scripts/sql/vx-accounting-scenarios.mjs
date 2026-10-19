// VX accounting invariants for a metered AI request, executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/vx-accounting-scenarios.mjs
//
// Replays the migrations over minimal Supabase stubs, then drives
// vx_reserve_metered -> (ai_usage_events written by the provider layer) ->
// vx_settle_metered / vx_release / vx_reap_stale_reservations as the table owner
// (the service-role path). Synthetic users and invented numbers only.
//
// The conversion rate and every cost below are FIXTURES chosen to make the
// arithmetic readable. They are not prices and they say nothing about what the
// product should charge. What is asserted are invariants that hold for any rate:
//   * one request, one hold: a repeated delivery of the same key holds nothing more
//   * a hold is settled or released at most once, whatever calls come after
//   * a user is never charged more than was held, nor less than zero
//   * every VX that leaves a balance is either consumed on the ledger or came back
//   * the database refuses malformed cost rows
// and, labelled "CURRENT BEHAVIOUR", the places where the design under-bills
// (answers delivered but not charged). Those are recorded so a change to them is a
// deliberate decision, not an accident. Nothing here changes how anything is charged.
//
// Like the authorization matrix it ends by MUTATING one function and requiring the
// run to go red, so a pass cannot be vacuous.
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
let applied = 0, skipped = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(`${dir}/${f}`, "utf8")); applied++; } catch { skipped++; }
}
console.log(`migrations replayed: ${applied} applied, ${skipped} skipped (PGlite lacks pg_cron/pgvector/pgcrypto/realtime)`);
for (const fn of ["vx_reserve_metered", "vx_settle_metered", "vx_settle", "vx_release", "vx_reap_stale_reservations", "vx_balance", "vx_metered_charge"]) {
  const r = await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname=$1", [fn]);
  if (!r.rows[0].n) { console.log(`FAIL  function public.${fn} did not replay; the scenarios cannot run`); process.exit(1); }
}

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const A = U(11), B = U(12);
const START = 1000;
const FIXTURE_RATE = 100; // fixture: VX per USD. Not a price.
const q = async (sql, args) => (await db.query(sql, args)).rows;
const one = async (sql, args) => (await q(sql, args))[0];
const bal = async (u) => Number((await one("select public.vx_balance($1) v", [u])).v);
const ledger = async (id) => one("select status, reserved_vx, consumed_vx, refunded_vx from public.vx_usage_ledger where id=$1", [id]);
const holds = async (u) => Number((await one("select count(*)::int n from public.user_points where user_id=$1 and reason like 'VX reserve:%'", [u])).n);
const attempt = (key) => `req-${key}-0123456789`; // idempotency keys must be 8-200 chars

async function reserve(user, key, maxUsd = 1) {
  const r = await one("select public.vx_reserve_metered($1,'ai_chat','website',$2,$3,'{}') r", [user, key, maxUsd]);
  return r.r;
}
// One provider call as the usage sink records it. The CHECKs on the table are the
// real ones; a row that violates them is rejected by the database, not by this helper.
async function event(reservationId, { outcome = "ok", usage_source = "reported", cost = null, cost_status, attempt: n = 1 }) {
  const status = cost_status ?? (cost === null ? "unpriced" : "priced");
  await db.query(
    `insert into public.ai_usage_events(function_name, operation, provider, model, outcome, error_code, usage, usage_source, provider_cost_usd, cost_status, attempt, reservation_id)
     values ('ai-chat','stream','openai','gpt-test',$1,$2,'{}',$3,$4,$5,$6,$7)`,
    [outcome, outcome === "error" ? "timeout" : null, usage_source, cost, status, n, reservationId],
  );
}
const settle = async (id) => (await one("select public.vx_settle_metered($1) r", [id])).r;

async function seed() {
  await db.exec(`
    insert into auth.users(id,email) values ('${A}','a@example.test'),('${B}','b@example.test') on conflict do nothing;
    delete from public.ai_usage_events; delete from public.vx_usage_ledger;
    delete from public.user_points where user_id in ('${A}','${B}');
    insert into public.user_points(user_id, points, reason) values ('${A}', ${START}, 'seed'), ('${B}', ${START}, 'seed');
    update public.central_pricing_registry set enabled=true, pricing_mode='metered', free_limit=0, max_daily_usage=null, max_reserve_vx=null, plan_limits='{}' where service_id='ai_chat';
    delete from public.vx_conversion_policy;
    insert into public.vx_conversion_policy(service_id, vx_per_usd, multiplier, min_charge_vx, rounding, bill_failed_billable_attempts)
      values (null, ${FIXTURE_RATE}, 1, 0, 'ceil', false);
  `);
}

async function scenarios() {
  const out = [];
  const check = (label, cond, detail) => out.push({ label, ok: !!cond, detail });
  await seed();

  // 1. The same delivery arrives twice.
  const k1 = attempt("dup");
  const first = await reserve(A, k1);
  const again = await reserve(A, k1);
  check("duplicate delivery: the replay returns the first reservation", again.ok && again.replayed === true && again.reservation_id === first.reservation_id);
  check("duplicate delivery: one hold on the balance, one ledger row", (await holds(A)) === 1 && (await one("select count(*)::int n from public.vx_usage_ledger where idempotency_key=$1", [k1])).n === 1);
  check("duplicate delivery: balance fell by the hold exactly once", (await bal(A)) === START - first.reserved_vx);
  const stolen = await reserve(B, k1);
  check("a key another account already used is refused and holds nothing", stolen.ok === false && stolen.error === "idempotency_key_conflict" && (await bal(B)) === START);

  // 2. Settle once, then again, then a late event.
  await event(first.reservation_id, { cost: 0.5 });
  const s1 = await settle(first.reservation_id);
  const owed = Math.ceil(0.5 * FIXTURE_RATE);
  check("settle: consumed follows the recorded cost, the rest comes back", s1.ok && s1.consumed_vx === owed && s1.refunded_vx === first.reserved_vx - owed);
  check("settle: balance equals start minus consumed", (await bal(A)) === START - owed);
  const s2 = await settle(first.reservation_id);
  check("settle twice: second call is a replay and moves nothing", s2.replayed === true && (await bal(A)) === START - owed);
  const direct = (await one("select public.vx_settle($1, 1) r", [first.reservation_id])).r;
  check("vx_settle called directly after a settlement is a replay and moves nothing", direct.replayed === true && (await bal(A)) === START - owed);
  await event(first.reservation_id, { cost: 0.3, attempt: 2 });
  const s3 = await settle(first.reservation_id);
  check("CURRENT BEHAVIOUR: an event written after settlement is never billed (under-billing, no double charge)", s3.replayed === true && (await bal(A)) === START - owed);
  const rel = (await one("select public.vx_release($1,'late','failed') r", [first.reservation_id])).r;
  check("release after settle moves nothing", rel.replayed === true && (await bal(A)) === START - owed);

  // 3. Held, never settled: the reaper brings it back.
  await seed();
  const lost = await reserve(A, attempt("lost"));
  await event(lost.reservation_id, { cost: 0.4 });
  check("a hold that is never settled keeps the VX held", (await bal(A)) === START - lost.reserved_vx && (await ledger(lost.reservation_id)).status === "reserved");
  await db.query("update public.vx_usage_ledger set created_at = now() - interval '2 hours' where id=$1", [lost.reservation_id]);
  const reaped = (await one("select public.vx_reap_stale_reservations() n")).n;
  check("the reaper returns an unsettled hold in full", reaped === 1 && (await bal(A)) === START && (await ledger(lost.reservation_id)).status === "expired");
  const late = await settle(lost.reservation_id);
  check("CURRENT BEHAVIOUR: events recorded for a reaped hold are not billed afterwards (answer delivered, nothing charged)", late.replayed === true && (await bal(A)) === START);

  // 4. Failure between the provider's answer and the usage write: no event at all.
  await seed();
  const noEvent = await reserve(A, attempt("noevent"));
  const sNo = await settle(noEvent.reservation_id);
  check("no usage recorded: the hold is released in full, status failed", sNo.ok && sNo.refunded_vx === noEvent.reserved_vx && (await bal(A)) === START && (await ledger(noEvent.reservation_id)).status === "failed");

  // 5. A fallback chain: two failed attempts, then an answer.
  await seed();
  const chain = await reserve(A, attempt("chain"));
  await event(chain.reservation_id, { outcome: "error", usage_source: "missing", attempt: 1 });
  await event(chain.reservation_id, { outcome: "error", usage_source: "reported", cost: 0.1, attempt: 2 });
  await event(chain.reservation_id, { cost: 0.2, attempt: 3 });
  const sChain = await settle(chain.reservation_id);
  check("fallback, policy off: only the answered attempt is charged", sChain.consumed_vx === Math.ceil(0.2 * FIXTURE_RATE) && (await bal(A)) === START - sChain.consumed_vx);
  await seed();
  await db.exec("update public.vx_conversion_policy set bill_failed_billable_attempts = true");
  const chain2 = await reserve(A, attempt("chain2"));
  await event(chain2.reservation_id, { outcome: "error", usage_source: "missing", attempt: 1 });
  await event(chain2.reservation_id, { outcome: "error", usage_source: "reported", cost: 0.1, attempt: 2 });
  await event(chain2.reservation_id, { cost: 0.2, attempt: 3 });
  const sChain2 = await settle(chain2.reservation_id);
  check("fallback, policy on: a failed attempt is billed only if it reported usage, a 'missing' one never", sChain2.consumed_vx === Math.ceil(0.3 * FIXTURE_RATE) && (await bal(A)) === START - sChain2.consumed_vx);

  // 6. Cost data that is missing or malformed.
  await seed();
  const odd = await reserve(A, attempt("odd"));
  const rejects = async (row) => { try { await event(odd.reservation_id, row); return false; } catch { return true; } };
  check("a negative cost is rejected by the table", await rejects({ cost: -1 }));
  check("a priced row with no cost is rejected by the table", await rejects({ cost_status: "priced", cost: null }));
  check("an unpriced row that carries a cost is rejected by the table", await rejects({ cost_status: "unpriced", cost: 0.2 }));
  await event(odd.reservation_id, { cost: null, cost_status: "unpriced" });
  const sOdd = await settle(odd.reservation_id);
  check("CURRENT BEHAVIOUR: an answered call whose model has no price releases the hold (free); a metered request for an unpriced model is refused before it starts", sOdd.ok && (await ledger(odd.reservation_id)).status === "failed" && (await bal(A)) === START);

  // 7. A cost far above the hold.
  await seed();
  const big = await reserve(A, attempt("big"), 1);
  await event(big.reservation_id, { cost: 9999 });
  const sBig = await settle(big.reservation_id);
  check("a recorded cost above the hold is clamped to the hold, never beyond", sBig.consumed_vx === big.reserved_vx && sBig.refunded_vx === 0 && (await bal(A)) === START - big.reserved_vx);
  const row = await ledger(big.reservation_id);
  check("the ledger row never exceeds what was held", row.consumed_vx + row.refunded_vx <= row.reserved_vx);

  // 8. Balance conservation across everything above, for the last user state.
  const net = Number((await one("select coalesce(sum(points),0)::int s from public.user_points where user_id=$1", [A])).s);
  const lg = await one("select coalesce(sum(consumed_vx),0)::int c from public.vx_usage_ledger where user_id=$1", [A]);
  check("conservation: start minus the user's balance equals what the ledger consumed", START - net === lg.c);
  return out;
}

let fail = 0;
const base = await scenarios();
for (const r of base) { if (!r.ok) fail++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }

// Mutation proofs: each must turn the run red.
const defs = {};
for (const sig of ["vx_settle(uuid,integer,integer,text,numeric)", "vx_release(uuid,text,text)", "vx_reserve_metered(uuid,text,text,text,numeric,jsonb)"]) {
  defs[sig] = (await one("select pg_get_functiondef($1::regprocedure) d", [`public.${sig}`])).d;
}
const mutations = [
  // vx_settle_metered has its own "already settled" guard, but removing it does not move money: vx_settle underneath has the one that does. Not listed, because it would not turn anything red.
  ["vx_settle forgets it already settled", "vx_settle(uuid,integer,integer,text,numeric)", (d) => d.replace(/IF _row\.status <> 'reserved' THEN/i, "IF false THEN")],
  ["vx_settle may consume more than was held", "vx_settle(uuid,integer,integer,text,numeric)", (d) => d.replace(/LEAST\(GREATEST\(COALESCE\(_consumed_vx, _row\.reserved_vx\), 0\), _row\.reserved_vx\)/i, "GREATEST(COALESCE(_consumed_vx, _row.reserved_vx), 0)")],
  ["vx_reserve_metered ignores a repeated key", "vx_reserve_metered(uuid,text,text,text,numeric,jsonb)", (d) => d.replace(/SELECT \* INTO _existing FROM public\.vx_usage_ledger WHERE idempotency_key = _idempotency_key;/i, "SELECT * INTO _existing FROM public.vx_usage_ledger WHERE false;")],
];
for (const [name, sig, edit] of mutations) {
  const mutated = edit(defs[sig]);
  if (mutated === defs[sig]) { fail++; console.log(`FAIL  mutation "${name}" changed nothing (its pattern no longer matches)`); continue; }
  let red = 0;
  try {
    await db.exec(mutated);
    try { red = (await scenarios()).filter((r) => !r.ok).length; } catch { red = 1; /* an exception is also red */ }
  } finally {
    await db.exec(defs[sig]);
  }
  const detected = red > 0;
  if (!detected) fail++;
  console.log(`${detected ? "PASS" : "FAIL"}  mutation "${name}" turns the scenarios red (${red} checks)`);
}
const after = (await scenarios()).filter((r) => !r.ok).length;
if (after !== 0) { fail++; console.log(`FAIL  scenarios not green again after undoing mutations (${after} red)`); }

console.log(fail ? `\n${fail} failure(s)` : `\nall ${base.length} checks and ${mutations.length} mutation proofs passed`);
process.exit(fail ? 1 : 0);
