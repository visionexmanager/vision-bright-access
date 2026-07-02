// GET/POST — Career Center system diagnostics, in the same spirit as the
// site-wide health-check function but scoped to Career Center tables and AI
// provider keys. No auth required (read-only diagnostics), but every run is
// persisted to career_system_health_checks for the admin-only history view.
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const results: Record<string, ComponentStatus> = {};

  results.openai_key = checkEnvVar("OPENAI_API_KEY");
  results.anthropic_key = checkEnvVar("ANTHROPIC_API_KEY");
  results.gemini_key = checkEnvVar("GEMINI_API_KEY");
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
