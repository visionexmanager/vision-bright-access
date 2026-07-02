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

async function handleConsume(userId: string, body: Record<string, unknown>) {
  const {
    operation_type, job_id, project_id,
    provider_slug, idempotency_key, meta,
  } = body;

  if (!operation_type) return err("operation_type required");

  const db = serviceDb();
  const { data, error } = await db.rpc("billing_consume", {
    p_user_id:         userId,
    p_operation_type:  operation_type,
    p_job_id:          job_id ?? null,
    p_project_id:      project_id ?? null,
    p_provider_slug:   provider_slug ?? null,
    p_idempotency_key: idempotency_key ?? null,
    p_meta:            meta ?? {},
  });

  if (error) return json({ ok: false, error: error.message });
  return json(data);
}

async function handleRefund(userId: string, body: Record<string, unknown>) {
  const { job_id, reason } = body;
  if (!job_id) return err("job_id required");

  const db = serviceDb();
  const { data, error } = await db.rpc("billing_refund", {
    p_user_id: userId,
    p_job_id:  job_id,
    p_reason:  reason ?? "generation_failed",
  });

  if (error) return json({ ok: false, error: error.message });
  return json(data);
}

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

  const db = serviceDb();
  let q = db
    .from("credit_transactions")
    .select("*")
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

  const db = serviceDb();
  let q = db
    .from("usage_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - hours * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opType) q = q.eq("operation_type", opType);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message });
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

async function handleUpgrade(userId: string, body: Record<string, unknown>) {
  const { plan_id } = body;
  if (!plan_id) return err("plan_id required");

  const db = serviceDb();

  // Get plan details
  const { data: plan, error: planErr } = await db
    .from("billing_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr || !plan) return err("Invalid plan");

  // Cancel any existing active subscription
  await db.from("user_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");

  // Create new subscription
  const nextRenewal = new Date();
  nextRenewal.setDate(nextRenewal.getDate() + 30);

  const { data: sub, error: subErr } = await db
    .from("user_subscriptions")
    .insert({
      user_id:               userId,
      plan_id:               plan_id,
      status:                "active",
      vx_credits_remaining:  plan.vx_credits_monthly,
      vx_reset_at:           nextRenewal.toISOString(),
      next_renewal_at:       nextRenewal.toISOString(),
    })
    .select()
    .single();

  if (subErr) return json({ ok: false, error: subErr.message });

  // Grant subscription credits to wallet as well
  if (plan.vx_credits_monthly > 0) {
    await db.rpc("billing_grant_credits", {
      p_user_id:    userId,
      p_amount_vx:  plan.vx_credits_monthly,
      p_type:       "subscription_grant",
      p_description: `${plan.name} plan: monthly credits`,
    });
  }

  // Update users_billing
  await db.from("users_billing").upsert({
    user_id:        userId,
    active_plan_id: plan_id,
    is_in_trial:    false,
    updated_at:     new Date().toISOString(),
  }, { onConflict: "user_id" });

  return json({ ok: true, data: sub });
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

async function handleGrantCredits(userId: string, body: Record<string, unknown>) {
  const { amount_vx, description } = body;
  if (!amount_vx || Number(amount_vx) <= 0) return err("amount_vx required and must be positive");

  const db = serviceDb();
  const { data, error } = await db.rpc("billing_grant_credits", {
    p_user_id:    userId,
    p_amount_vx:  Number(amount_vx),
    p_type:       "purchase",
    p_description: description ?? `Purchased ${amount_vx} VX`,
  });

  if (error) return json({ ok: false, error: error.message });
  return json(data);
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
    case "check_and_consume":
    case "consume":         return handleConsume(user.id, body);
    case "refund":          return handleRefund(user.id, body);
    case "get_status":      return handleGetStatus(user.id);
    case "get_balance":     return handleGetBalance(user.id);
    case "get_history":     return handleGetHistory(user.id, body);
    case "get_usage_logs":  return handleGetUsageLogs(user.id, body);
    case "get_plans":       return handleGetPlans();
    case "upgrade":         return handleUpgrade(user.id, body);
    case "cancel":          return handleCancel(user.id);
    case "grant_credits":   return handleGrantCredits(user.id, body);
    default:                return err(`Unknown action: ${action}`);
  }
});
