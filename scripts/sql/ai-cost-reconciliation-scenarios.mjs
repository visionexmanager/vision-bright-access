// admin_ai_cost_daily() and admin_ai_reconciliation(), executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/ai-cost-reconciliation-scenarios.mjs
//
// Replays the migrations, then calls both functions as anonymous, an ordinary user,
// the service role and an admin, over synthetic usage events, ledger rows and plan
// grants. Asserts who may call them, that they return aggregates only (no user id,
// no email), that they flag missing / unpriced / duplicate / late records, that the
// dollar figure is never presented as an invoice, and that they write nothing.
// Every number below is a fixture, not a price. Ends by mutating the functions and
// requiring the run to go red, so a pass cannot be vacuous.
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

for (const fn of ["admin_ai_cost_daily", "admin_ai_reconciliation"]) {
  const r = await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname=$1", [fn]);
  if (!r.rows[0].n) { console.log(`FAIL  function public.${fn} did not replay`); process.exit(1); }
}

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const A = U(31), ADMIN = U(33);
await db.exec(`
  insert into auth.users(id, email) values ('${A}', 'reconcile-a@example.test'), ('${ADMIN}', 'reconcile-admin@example.test') on conflict do nothing;
  delete from public.user_roles where user_id in ('${A}', '${ADMIN}');
  insert into public.user_roles(user_id, role) values ('${ADMIN}', 'admin');
  delete from public.user_points where user_id in ('${A}', '${ADMIN}');
`);

let fail = 0, total = 0;
const check = (name, ok) => { total++; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

async function as(who, sql) {
  const role = who === "anon" ? "anon" : who === "SERVICE" ? "service_role" : "authenticated";
  const sub = who === "anon" || who === "SERVICE" ? "" : { A, ADMIN }[who];
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub','${sub}',true), set_config('request.jwt.claim.role','${role}',true);`);
    const r = await db.query(sql);
    return { rows: r.rows };
  } catch (e) {
    return { error: e.message.split("\n")[0] };
  } finally {
    await db.exec("rollback");
  }
}
const daily = async (who, days = 14) => as(who, `select public.admin_ai_cost_daily(${days}) r`);
const recon = async (who, days = 7) => as(who, `select public.admin_ai_reconciliation(${days}) r`);
const canExec = async (role, sig) => (await db.query(`select has_function_privilege('${role}', '${sig}', 'execute') v`)).rows[0].v;
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const counts = async () => (await one(`select (select count(*) from public.ai_usage_events)::int e, (select count(*) from public.vx_usage_ledger)::int l,
  (select count(*) from public.user_points)::int p, (select count(*) from public.ai_budgets)::int b, (select count(*) from public.central_pricing_registry)::int r,
  (select coalesce(sum(points),0) from public.user_points)::int vx`));

// ── Access ───────────────────────────────────────────────────────────────────
for (const sig of ["public.admin_ai_cost_daily(integer)", "public.admin_ai_reconciliation(integer)"]) {
  const name = sig.split(".")[1].split("(")[0];
  check(`${name}: no EXECUTE for anon`, !(await canExec("anon", sig)));
  check(`${name}: anonymous caller refused`, !!(await as("anon", `select public.${name}() r`)).error);
  const ordinary = await as("A", `select public.${name}() r`);
  check(`${name}: an ordinary user is refused and gets no data`, ordinary.error === "Admin access required" && !ordinary.rows);
  const service = await as("SERVICE", `select public.${name}() r`);
  check(`${name}: the service role has no EXECUTE (it has no admin identity, so it could never pass the check)`, !(await canExec("service_role", sig)) && /permission denied/i.test(service.error ?? ""));
  check(`${name}: authenticated holds EXECUTE (the admin check inside is the gate)`, await canExec("authenticated", sig));
  check(`${name}: an admin session is allowed`, !(await as("ADMIN", `select public.${name}() r`)).error);
}

// ── Empty tables ─────────────────────────────────────────────────────────────
await db.exec("delete from public.ai_usage_events; delete from public.vx_usage_ledger");
const e0 = (await daily("ADMIN")).rows[0].r;
check("empty: no rows, zero totals, not a lower bound, never an invoice", e0.rows.length === 0 && e0.totals.calls === 0 && Number(e0.totals.priced_cost_usd) === 0 && e0.cost_is_lower_bound === false && e0.verified_invoice_total === false);

// ── Seed: priced, free, unpriced, no usage, estimated, missing; duplicate; ledger gaps ──
const ev = (o = {}) => {
  const r = { function_name: "ai-chat", operation: "stream", provider: "groq", model: "openai/gpt-oss-20b", outcome: "ok", usage: '{"total_tokens":1000}', usage_source: "reported",
    provider_cost_usd: "0.500000", cost_status: "priced", chain_id: null, attempt: null, reservation_id: null, occurred_at: null, ...o };
  return db.query(
    `insert into public.ai_usage_events(function_name, operation, provider, model, outcome, usage, usage_source, provider_cost_usd, cost_status, chain_id, attempt, reservation_id, occurred_at)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12, coalesce($13::timestamptz, now()))`,
    [r.function_name, r.operation, r.provider, r.model, r.outcome, r.usage, r.usage_source, r.provider_cost_usd, r.cost_status, r.chain_id, r.attempt, r.reservation_id, r.occurred_at]);
};
await ev();
await ev();
await ev({ provider: "gemini", model: "gemini-flash-latest", provider_cost_usd: null, cost_status: "unpriced" });
await ev({ provider: "gemini", model: "gemini-flash-latest", provider_cost_usd: null, cost_status: "no_usage", usage: "{}", usage_source: "missing", outcome: "error" });
await ev({ provider: "mistral", model: "ministral-14b-latest", provider_cost_usd: null, cost_status: "unpriced", usage_source: "estimated" });

const d1 = (await daily("ADMIN")).rows[0].r;
check("5 events grouped by day / function / provider / model", d1.rows.length === 3 && d1.totals.calls === 5);
check("the dollar figure is the recorded priced cost only (2 x 0.50)", Number(d1.totals.priced_cost_usd) === 1);
check("unpriced, no-usage, missing and estimated calls are counted beside it", d1.totals.unpriced_calls === 2 && d1.totals.no_usage_calls === 1 && d1.totals.missing_usage_calls === 1 && d1.totals.estimated_usage_calls === 1);
check("with any of those present the figure is flagged a lower bound and never an invoice", d1.cost_is_lower_bound === true && d1.verified_invoice_total === false);
check("a row with no unpriced / missing calls is marked fully priced, the others are not", d1.rows.find((r) => r.provider === "groq").fully_priced === true && d1.rows.find((r) => r.provider === "gemini").fully_priced === false);
check("a failed call is counted as failed", d1.totals.failed_calls === 1);

// Duplicate delivery, and the ledger gaps.
await ev({ chain_id: "11111111-1111-1111-1111-111111111111", attempt: 1 });
await ev({ chain_id: "11111111-1111-1111-1111-111111111111", attempt: 1 });
const ledger = (status, consumed, settledAt) => one(
  `insert into public.vx_usage_ledger(user_id, service_id, reserved_vx, consumed_vx, status, source, settled_at) values ($1,'ai_chat',10,$2,$3,'website',$4) returning id`,
  [A, consumed, status, settledAt]);
const later = new Date(Date.now() + 3600_000).toISOString();
const noCharge = await ledger("settled", 0, later);                                 // cost recorded, nothing consumed
await ev({ reservation_id: noCharge.id, provider_cost_usd: "0.250000" });
const expired = await ledger("expired", 0, null);                                   // expired hold with an event
await ev({ reservation_id: expired.id, provider_cost_usd: "0.100000" });
const late = await ledger("settled", 5, new Date(Date.now() - 3600_000).toISOString()); // event arrives after settlement
await ev({ reservation_id: late.id, provider_cost_usd: "0.050000", occurred_at: new Date().toISOString() });
await ledger("settled", 5, new Date().toISOString());                               // settled, no events at all
await db.query("insert into public.user_points(user_id, points, reason) values ($1, 100, 'VX subscription: pro x 1 month(s)'), ($1, 7, 'quiz win')", [A]);

const rc = (await recon("ADMIN")).rows[0].r;
check("duplicate events: one group, one extra row", rc.usage_events.duplicates.groups === 1 && rc.usage_events.duplicates.extra_rows === 1);
check("unpriced models are named with their call counts", rc.usage_events.unpriced_models.some((m) => m.model === "gemini-flash-latest" && m.calls === 1) && rc.usage_events.unpriced_models.some((m) => m.model === "ministral-14b-latest"));
check("by_cost_status and by_usage_source are reported", rc.usage_events.by_cost_status.unpriced === 2 && rc.usage_events.by_usage_source.estimated === 1 && rc.usage_events.by_usage_source.missing === 1);
check("a settled hold with cost recorded and nothing consumed is reported (count and dollars)", rc.vx_ledger.gaps.reservations_with_cost_and_no_charge === 2 && Number(rc.vx_ledger.gaps.reservations_cost_and_no_charge_usd) === 0.35);
check("an expired hold with events is reported with its cost", rc.vx_ledger.gaps.expired_holds_with_events === 1 && Number(rc.vx_ledger.gaps.expired_holds_event_cost_usd) === 0.1);
check("an event recorded after settlement is reported as late", rc.vx_ledger.gaps.late_events === 1 && Number(rc.vx_ledger.gaps.late_event_cost_usd) === 0.05);
check("a settled hold with no events is reported", rc.vx_ledger.gaps.settled_without_events === 1);
check("plan allowance grants count only subscription grant rows", rc.plan_allowance_grants.subscription_grant_rows === 1 && rc.plan_allowance_grants.subscription_grant_vx === 100);
check("the budget block shows the ledger/interactions view next to what ai_usage_events recorded", rc.budget.as_seen_by_check_ai_budget_today.requests === 0 && rc.budget.recorded_in_ai_usage_events_today.calls >= 8);
check("charging registry: nothing enabled, reported", rc.charging_registry.services_enabled === 0 && rc.charging_registry.ai_chat_enabled === false);
const wanted = ["unpriced_calls_present", "calls_without_usage_present", "missing_usage_present", "estimated_usage_present", "duplicate_events_present", "late_events_present",
  "expired_holds_with_events", "provider_cost_without_user_charge", "settled_holds_without_events", "provider_cost_recorded_but_no_service_enabled_for_charging",
  "budget_token_and_request_limits_do_not_read_ai_usage_events"];
check("every expected flag is raised", wanted.every((f) => rc.flags.includes(f)));
check("the result is never presented as an invoice", rc.verified_invoice_total === false);

await db.exec("delete from public.ai_budgets where scope='global'");
check("no active global budget row is flagged", (await recon("ADMIN")).rows[0].r.flags.includes("no_active_global_budget_row"));

// ── Privacy: aggregates only ─────────────────────────────────────────────────
const text = JSON.stringify([(await daily("ADMIN")).rows[0].r, (await recon("ADMIN")).rows[0].r]);
check("no user id and no email appears in either result", !text.includes(A) && !text.includes(ADMIN) && !text.includes("example.test"));

// ── Read-only and bounded ────────────────────────────────────────────────────
const before = await counts();
await daily("ADMIN"); await recon("ADMIN");
const after = await counts();
check("calling both writes nothing: events, ledger, user_points, budgets, registry and the VX total are unchanged", JSON.stringify(before) === JSON.stringify(after));
check("the day window is clamped to 1..90", (await daily("ADMIN", 0)).rows[0].r.days === 1 && (await daily("ADMIN", 1000)).rows[0].r.days === 90 && (await recon("ADMIN", -5)).rows[0].r.days === 1);

// ── Mutation proofs ──────────────────────────────────────────────────────────
const mutations = [];
for (const name of ["admin_ai_cost_daily", "admin_ai_reconciliation"]) {
  const def = (await one(`select pg_get_functiondef(p.oid) d from pg_proc p where p.proname='${name}' and pronamespace='public'::regnamespace`)).d;
  const mutated = def.replace(/IF NOT public\.has_role\(auth\.uid\(\), 'admin'(::\w+)?\) THEN\s+RAISE EXCEPTION 'Admin access required';\s+END IF;/i, "");
  mutations.push({ label: `${name} loses its admin check`, name, def, mutated });
}
for (const m of mutations) {
  if (m.mutated === m.def) { fail++; console.log(`FAIL  mutation "${m.label}" changed nothing`); continue; }
  await db.exec(m.mutated);
  const leaked = !(await as("A", `select public.${m.name}() r`)).error;
  console.log(`${leaked ? "PASS" : "FAIL"}  mutation "${m.label}" lets an ordinary user in, so the access check above would go red`);
  if (!leaked) fail++;
  await db.exec(m.def);
  check(`restored: ${m.name} refuses an ordinary user again`, (await as("A", `select public.${m.name}() r`)).error === "Admin access required");
}
await db.exec("grant execute on function public.admin_ai_cost_daily(integer) to anon");
check("mutation: EXECUTE granted to anon is detected", await canExec("anon", "public.admin_ai_cost_daily(integer)"));
await db.exec("revoke execute on function public.admin_ai_cost_daily(integer) from anon");

console.log(fail ? `\n${fail} failure(s)` : `\nall ${total} checks and ${mutations.length + 1} mutation proofs passed`);
process.exit(fail ? 1 : 0);
