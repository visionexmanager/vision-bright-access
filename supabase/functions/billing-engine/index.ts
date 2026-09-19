// Visionex Billing Engine — central billing, credits, and subscription authority
// ALL AI generation must call this before execution.
// Server-side only — no client-side credit logic.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400): Response {
  return json({ ok: false, error: msg }, status);
}

// ── Database client factory ───────────────────────────────────────────────────

function serviceDb() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key) as any;
}

function userDb(authHeader: string) {
  const url  = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } } }) as any;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleInitialize(userId: string, email?: string) {
  const db = serviceDb();
  const { data, error } = await db.rpc("billing_initialize_user", {
    p_user_id: userId,
    p_email:   email ?? null,
  });
  if (error) return json({ ok: false, error: error.message });
  return json({ ok: true, data });
}

// `handleConsume` and `handleRefund` used to be here. They called
// `billing_consume` / `billing_refund` against `credit_wallets`, and neither
// has ever run in production: six zero-balance wallets, no transactions, no
// usage rows. Charging VX is now `vx_reserve`/`vx_settle` behind
// `_shared/vx/meter.ts`, server-side, where a client cannot skip the decision.
//
// The SQL functions are deliberately still there — see
// .claude/references/vx-deprecations.md for what stays and why.

async function handleGetStatus(userId: string) {
  const db = serviceDb();
  const { data, error } = await db.rpc("billing_get_status", { p_user_id: userId });
  if (error) return json({ ok: false, error: error.message });
  return json({ ok: true, data });
}

async function handleGetBalance(userId: string) {
  const db = serviceDb();
  const [walletResult, trialResult] = await Promise.all([
    db.from("credit_wallets").select("balance_vx").eq("user_id", userId).maybeSingle(),
    db.from("trial_status").select("ends_at,is_active").eq("user_id", userId).maybeSingle(),
  ]);

  const balance   = walletResult.data?.balance_vx ?? 0;
  const trial     = trialResult.data;
  const inTrial   = trial?.is_active && new Date(trial.ends_at) > new Date();
  const hoursLeft = inTrial
    ? Math.max(0, (new Date(trial.ends_at).getTime() - Date.now()) / 3_600_000)
    : 0;

  return json({
    ok:         true,
    balance_vx: balance,
    in_trial:   inTrial,
    hours_left: hoursLeft,
  });
}

async function handleGetHistory(userId: string, body: Record<string, unknown>) {
  const limit  = Math.min(Number(body.limit  ?? 50), 200);
  const offset = Number(body.offset ?? 0);
  const type   = body.type as string | undefined;

  // Named columns, not `*`. The row also carries `provider_slug`, which names
  // the vendor behind a generation, and `idempotency_key`, which is a
  // server-side control the account holder has no use for. A customer's
  // history is what they spent and on what, not who Visionex bought it from.
  const db = serviceDb();
  let q = db
    .from("credit_transactions")
    .select("id, user_id, type, amount_vx, balance_after, description, operation_type, job_id, project_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message });
  return json({ ok: true, data });
}

async function handleGetUsageLogs(userId: string, body: Record<string, unknown>) {
  const limit  = Math.min(Number(body.limit ?? 50), 200);
  const hours  = Number(body.hours ?? 720);
  const opType = body.operation_type as string | undefined;

  // Same rule as the history above: no `provider_slug`, no `meta`.
  const db = serviceDb();
  let q = db
    .from("usage_logs")
    .select("id, user_id, operation_type, credits_used, status, project_id, job_id, billing_mode, plan_id, created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - hours * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opType) q = q.eq("operation_type", opType);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message });
  return json({ ok: true, data });
}

// The user's own VX spending, from the one ledger.
//
// `my_vx_usage()` is a column list rather than a policy: the ledger row also
// carries `provider` and `actual_cost_usd`, and "users read their own rows"
// would hand both over. What comes back is what they spent, on what, when, and
// from which surface.
async function handleMyUsage(body: Record<string, unknown>) {
  const limit  = Math.min(Math.max(Number(body.limit ?? 50), 1), 200);
  const offset = Math.max(Number(body.offset ?? 0), 0);
  const db = serviceDb();
  const { data, error } = await db.rpc("my_vx_usage", { _limit: limit, _offset: offset });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, data });
}

async function handleGetPlans() {
  const db = serviceDb();
  const { data, error } = await db
    .from("billing_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return json({ ok: false, error: error.message });
  return json({ ok: true, data });
}

async function handleCancel(userId: string) {
  const db = serviceDb();
  const { error } = await db.from("user_subscriptions")
    .update({
      status:       "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) return json({ ok: false, error: error.message });

  await db.from("users_billing").update({
    active_plan_id: "free_trial",
    updated_at:     new Date().toISOString(),
  }).eq("user_id", userId);

  return json({ ok: true });
}

// `handleGrantCredits` was here and was already unreachable: the dispatcher
// closed `grant_credits` because it granted a caller-supplied amount to any
// authenticated user with no payment verification. Unreachable code that still
// reads as live is worse than none, so it is gone with the rest.

// ── The operator's actions ────────────────────────────────────────────────────
//
// The VX price list, what the one ledger recorded, and the wallet-migration
// report. They live here rather than in a function of their own for two
// reasons that point the same way.
//
// This *is* the billing authority — a second endpoint that reads and writes
// prices would be the second billing system Phase 1 exists to remove. And the
// project sits two functions below the Supabase ceiling, where the 101st is
// rejected with a 402 that reads like a bundling error; `content-engine`'s
// suite asks every addition to argue for itself first, and this one cannot.
//
// The screen calls these rather than PostgREST because
// `src/integrations/supabase/types.ts` is regenerated from the live schema
// after a migration deploys, and `kidsSupabase.ts` records at length why
// casting around that drift is the wrong answer.

async function requireAdmin(userId: string): Promise<boolean> {
  const db = serviceDb();
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data === true) return true;
  // Recorded, not just refused: somebody probing the price list is worth
  // seeing in the security feed.
  await db.rpc("record_security_event", {
    _kind: "vx_pricing_forbidden",
    _source: "billing-engine",
    _subject_hash: null,
    _detail: { user_id: userId },
  }).catch(() => {});
  return false;
}

async function handlePricingList() {
  const db = serviceDb();
  // The whole row, cost and provider included, because this response only ever
  // reaches an admin. A user asking what something costs calls vx_price_list().
  const { data, error } = await db
    .from("central_pricing_registry").select("*").order("display_name");
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, data });
}

async function handleSetPricing(body: Record<string, unknown>) {
  const serviceId = body.service_id;
  if (typeof serviceId !== "string" || !serviceId) return err("service_id required");
  const patch = (body.patch ?? {}) as Record<string, unknown>;

  // Every field passes through as given, or null meaning "leave it". The
  // validation that matters — no negative price, no non-object plan_limits —
  // is in the SQL function, where a second caller cannot skip it.
  const db = serviceDb();
  const { data, error } = await db.rpc("admin_set_service_pricing", {
    _service_id: serviceId,
    _vx_price: patch.vx_price ?? null,
    _free_limit: patch.free_limit ?? null,
    _max_daily_usage: patch.max_daily_usage ?? null,
    _plan_limits: patch.plan_limits ?? null,
    _enabled: patch.enabled ?? null,
    _admin_only: patch.admin_only ?? null,
    _base_cost: patch.base_cost ?? null,
    _provider: patch.provider ?? null,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const result = data as { ok?: boolean; error?: string };
  return result?.ok ? json(result) : json(result ?? { ok: false }, 409);
}

async function handleUsageAnalytics(body: Record<string, unknown>) {
  const days = Math.min(Math.max(Number(body.days ?? 30), 1), 365);
  const db = serviceDb();
  const { data, error } = await db.rpc("vx_usage_analytics", { _days: days });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, data });
}

async function handleMigrationReport() {
  const db = serviceDb();
  const { data, error } = await db.rpc("vx_wallet_migration_report");
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, data });
}

// ── Entry point ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Unauthorized", 401);

  const db = userDb(authHeader);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const action = body.action as string;

  switch (action) {
    case "initialize":      return handleInitialize(user.id, user.email ?? undefined);
    // Superseded, and named rather than dropped: an unknown action invites a
    // retry, and one that says what replaced it does not. `grant_credits` was
    // already closed for granting a caller-supplied amount with no payment
    // verification; `consume` and `refund` charged `credit_wallets` from a
    // client, which is the shape this phase removes.
    case "check_and_consume":
    case "consume":
    case "refund":
    case "grant_credits":
      return err(
        "Superseded by vx_reserve / vx_settle through _shared/vx/meter.ts. See .claude/references/vx-deprecations.md.",
        410,
      );
    case "get_status":      return handleGetStatus(user.id);
    case "get_balance":     return handleGetBalance(user.id);
    case "get_history":     return handleGetHistory(user.id, body);
    case "get_usage_logs":  return handleGetUsageLogs(user.id, body);
    case "get_plans":       return handleGetPlans();
    // The new usage view, beside the legacy one. `get_usage_logs` reads
    // `usage_logs`, which is empty and always was; this reads the ledger the
    // platform now bills through.
    case "my_usage":        return handleMyUsage(body);

    // Admin-gated, each one checked against the caller's role before it runs.
    // `vx_migrate_wallet_balances` is deliberately absent: it moves real
    // balances, it is granted to the service role only, and running it is a
    // reviewed operational step with the report above read first — not a
    // button somebody can reach past on a Tuesday.
    case "pricing_list":
    case "set_pricing":
    case "usage_analytics":
    case "migration_report": {
      if (!(await requireAdmin(user.id))) return err("Forbidden", 403);
      if (action === "pricing_list")    return handlePricingList();
      if (action === "set_pricing")     return handleSetPricing(body);
      if (action === "usage_analytics") return handleUsageAnalytics(body);
      return handleMigrationReport();
    }
    // "upgrade" is not reachable from a user JWT either, for the same reason:
    // it inserted an active subscription to any plan the caller named, and
    // Gold opens every section, so any signed-in account could take it for
    // nothing. A plan becomes active after a confirmed payment, written
    // server-side — never because the account holder asked for one.
    case "upgrade":         return err("A plan is activated after payment is confirmed.", 403);
    case "cancel":          return handleCancel(user.id);
    default:                return err(`Unknown action: ${action}`);
  }
});
