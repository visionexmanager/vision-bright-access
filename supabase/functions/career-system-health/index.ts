// GET/POST — Career Center system diagnostics, in the same spirit as the
// site-wide health-check function but scoped to Career Center tables and AI
// provider keys. Requires CRON_SECRET or an admin session. It used to need no auth
// at all, which let anyone holding the public anon key trigger a Gemini key probe
// and sixteen history inserts per call; every run is persisted to
// career_system_health_checks for the admin-only history view.
// Intended to be polled by a cron (see infrastructure/monitoring/README.md).
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface ComponentStatus {
  ok: boolean;
  status: "ok" | "warning" | "error" | "missing";
  detail: string;
}

function checkEnvVar(name: string, severity: "missing" | "warning" = "missing"): ComponentStatus {
  const val = Deno.env.get(name);
  if (!val) {
    return { ok: severity !== "missing", status: severity, detail: `${name} is not configured.` };
  }
  return { ok: true, status: "ok", detail: `${name} is configured.` };
}

async function checkGemini(): Promise<ComponentStatus> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { ok: false, status: "missing", detail: "GEMINI_API_KEY is not configured." };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (response.ok) {
      return { ok: true, status: "ok", detail: "Gemini key valid and API reachable." };
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { ok: false, status: "error", detail: "Gemini key is invalid, blocked, or lacks Gemini API access." };
    }
    return { ok: false, status: "error", detail: `Gemini API returned HTTP ${response.status}.` };
  } catch {
    return { ok: false, status: "error", detail: "Cannot reach the Gemini API." };
  }
}

// deno-lint-ignore no-explicit-any
async function checkTable(db: any, tableName: string): Promise<ComponentStatus> {
  try {
    const { error } = await db.from(tableName).select("id").limit(1);
    if (error) {
      return {
        ok: false,
        status: "error",
        detail: error.message.includes("does not exist")
          ? `Table '${tableName}' does not exist. Run Supabase migrations.`
          : `Table '${tableName}' error: ${error.message}`,
      };
    }
    return { ok: true, status: "ok", detail: `Table '${tableName}' is accessible.` };
  } catch (e) {
    return { ok: false, status: "error", detail: `Exception checking '${tableName}': ${e}` };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  // Before any probe, any provider call or any write: the scheduler's secret, or an
  // admin session. Fails closed (no secret configured means only an admin gets in).
  {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    let isAdmin = false;
    if (!isCron) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (authHeader && supabaseUrl && anonKey && serviceRole && authHeader !== `Bearer ${anonKey}`) {
        try {
          const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
          const { data: { user } } = await asUser.auth.getUser();
          if (user) {
            const { data } = await createClient(supabaseUrl, serviceRole).rpc("has_role", { _user_id: user.id, _role: "admin" });
            isAdmin = data === true;
          }
        } catch {
          isAdmin = false;
        }
      }
    }
    if (!isCron && !isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const results: Record<string, ComponentStatus> = {};

  results.openai_key = checkEnvVar("OPENAI_API_KEY");
  results.anthropic_key = checkEnvVar("ANTHROPIC_API_KEY");
  results.gemini_key = await checkGemini();
  results.stripe_key = checkEnvVar("STRIPE_SECRET_KEY", "warning");
  results.stripe_webhook_secret = checkEnvVar("CAREER_STRIPE_WEBHOOK_SECRET", "warning");

  if (supabaseUrl && serviceKey) {
    const db = createClient(supabaseUrl, serviceKey);
    const tables = [
      "career_profiles", "companies", "jobs", "applications",
      "ai_interactions", "ai_response_cache", "queue_jobs",
      "career_billing_plans", "career_billing_subscriptions",
      "career_security_events", "career_error_log",
    ];
    for (const table of tables) {
      results[`db_${table}`] = await checkTable(db, table);
    }

    const allOk = Object.values(results).every((r) => r.ok);
    const rows = Object.entries(results).map(([component, r]) => ({
      component,
      status: r.status,
      detail: r.detail,
    }));
    const { error: insertErr } = await db.from("career_system_health_checks").insert(rows);
    if (insertErr) console.error("Failed to persist health check history:", insertErr);

    return new Response(
      JSON.stringify({ ok: allOk, timestamp: new Date().toISOString(), components: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: false, timestamp: new Date().toISOString(), components: results, error: "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
