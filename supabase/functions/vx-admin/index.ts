// The operator's door to the VX system: the price list, the usage the one
// ledger recorded, and the wallet-migration report.
//
// It exists rather than the admin screen reading PostgREST directly for a
// reason the repository already states in `kidsSupabase.ts`: casting around a
// stale `src/integrations/supabase/types.ts` is forbidden, and those types are
// regenerated from the live schema *after* a migration deploys. An Edge
// Function uses its own untyped client, so the screen can be written and
// reviewed now and the generated types catch up on their own schedule.
//
// It is also where a future API consumer arrives. Every action below reads or
// writes through the same SQL functions the website and WhatsApp use — there
// is no second pricing path here, and there must never be one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
const err = (message: string, status = 400) => json({ ok: false, error: message }, status);

const env = (name: string) => Deno.env.get(name) ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Unauthorized", 401);

  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await asCaller.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

  // deno-lint-ignore no-explicit-any
  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")) as any;

  // The role check is here as well as inside every SQL function it calls.
  // Depth, not duplication: `admin_set_service_pricing` refuses a non-admin on
  // its own, and this refuses one before the request reaches it.
  const { data: isAdmin } = await service.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (isAdmin !== true) {
    await service.rpc("record_security_event", {
      _kind: "vx_admin_forbidden",
      _source: "vx-admin",
      _subject_hash: null,
      _detail: { user_id: user.id },
    }).catch(() => {});
    return err("Forbidden", 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* an empty body is a listing */ }

  switch (body.action) {
    // ── The price list, whole: cost and provider included, because this
    //    response only ever reaches an admin. ────────────────────────────
    case "pricing_list": {
      const { data, error } = await service
        .from("central_pricing_registry").select("*").order("display_name");
      return error ? err(error.message, 500) : json({ ok: true, data });
    }

    case "set_pricing": {
      const patch = (body.patch ?? {}) as Record<string, unknown>;
      if (typeof body.service_id !== "string" || !body.service_id) {
        return err("service_id required");
      }
      // Every field is passed through as given, or as null meaning "leave it".
      // The validation that matters — no negative price, no non-object
      // plan_limits — is in the SQL function, where a second caller cannot
      // skip it.
      const { data, error } = await service.rpc("admin_set_service_pricing", {
        _service_id: body.service_id,
        _vx_price: patch.vx_price ?? null,
        _free_limit: patch.free_limit ?? null,
        _max_daily_usage: patch.max_daily_usage ?? null,
        _plan_limits: patch.plan_limits ?? null,
        _enabled: patch.enabled ?? null,
        _admin_only: patch.admin_only ?? null,
        _base_cost: patch.base_cost ?? null,
        _provider: patch.provider ?? null,
      });
      if (error) return err(error.message, 500);
      const result = data as { ok?: boolean; error?: string };
      return result?.ok ? json(result) : err(result?.error ?? "refused", 409);
    }

    case "usage_analytics": {
      const days = Math.min(Math.max(Number(body.days ?? 30), 1), 365);
      const { data, error } = await service.rpc("vx_usage_analytics", { _days: days });
      return error ? err(error.message, 500) : json({ ok: true, data });
    }

    // ── Read-only, and the thing to run before any wallet is touched ────
    case "migration_report": {
      const { data, error } = await service.rpc("vx_wallet_migration_report");
      return error ? err(error.message, 500) : json({ ok: true, data });
    }

    // `vx_migrate_wallet_balances` is deliberately NOT reachable from here.
    // It moves real balances, it is granted to the service role only, and the
    // decision to run it is a reviewed operational step with a report read
    // first — not a button an admin can reach past on a Tuesday.
    case "migrate_wallets":
      return err("Wallet migration is run as a reviewed operational step, not from this screen.", 403);

    default:
      return err(`Unknown action: ${String(body.action)}`);
  }
});
