// AI Provider Hub — central routing, health, and monitoring edge function
// All AI generation calls should route through here for provider selection

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Provider {
  id:                   string;
  name:                 string;
  slug:                 string;
  type:                 string;
  status:               string;
  priority:             number;
  api_key_ref:          string | null;
  default_model:        string | null;
  cost_per_request:     number;
  health_score:         number;
  avg_latency_ms:       number;
  success_rate:         number;
  consecutive_failures: number;
  capabilities:         string[];
  config:               Record<string, unknown>;
}

interface RoutingPreferences {
  weights?: { latency: number; cost: number; health: number; priority: number };
  requireCapabilities?: string[];
  preferredSlug?:       string;
  excludeSlugs?:        string[];
}

// ── Smart Router ──────────────────────────────────────────────────────────────

function scoreProvider(p: Provider, prefs?: RoutingPreferences): number {
  const w = prefs?.weights ?? { latency: 0.25, cost: 0.20, health: 0.40, priority: 0.15 };

  // Normalize: higher score = better
  const latencyScore  = Math.max(0, 100 - (p.avg_latency_ms / 20));   // 0ms→100, 2000ms→0
  const costScore     = Math.max(0, 100 - (p.cost_per_request * 500)); // 0→100, 0.2→0
  const healthScore   = p.health_score;
  const priorityScore = Math.max(0, 100 - p.priority);                 // priority 1→99, 100→0

  return (
    latencyScore  * w.latency  +
    costScore     * w.cost     +
    healthScore   * w.health   +
    priorityScore * w.priority
  );
}

function selectProviders(
  providers: Provider[],
  type: string,
  prefs?: RoutingPreferences,
  strategy = "smart"
): { primary: Provider | null; alternatives: Provider[] } {
  let eligible = providers.filter(
    (p) =>
      p.type === type &&
      p.status !== "inactive" &&
      p.health_score > 20 &&
      !(prefs?.excludeSlugs?.includes(p.slug))
  );

  if (prefs?.requireCapabilities?.length) {
    const req = prefs.requireCapabilities;
    eligible = eligible.filter((p) => req.every((c) => p.capabilities.includes(c)));
  }

  if (eligible.length === 0) return { primary: null, alternatives: [] };

  // Preferred slug override
  if (prefs?.preferredSlug) {
    const preferred = eligible.find((p) => p.slug === prefs.preferredSlug);
    if (preferred) {
      const rest = eligible.filter((p) => p.slug !== prefs.preferredSlug);
      return { primary: preferred, alternatives: rest };
    }
  }

  switch (strategy) {
    case "priority":
      eligible.sort((a, b) => a.priority - b.priority);
      break;
    case "least_latency":
      eligible.sort((a, b) => (a.avg_latency_ms || 9999) - (b.avg_latency_ms || 9999));
      break;
    case "cheapest":
      eligible.sort((a, b) => a.cost_per_request - b.cost_per_request);
      break;
    case "round_robin": {
      // Rotate based on current minute
      const offset = Math.floor(Date.now() / 60000) % eligible.length;
      eligible = [...eligible.slice(offset), ...eligible.slice(0, offset)];
      break;
    }
    case "smart":
    default:
      eligible.sort((a, b) => scoreProvider(b, prefs) - scoreProvider(a, prefs));
      break;
  }

  return { primary: eligible[0], alternatives: eligible.slice(1) };
}

// ── Health checker ────────────────────────────────────────────────────────────

async function runHealthCheck(
  provider: Provider,
  db: ReturnType<typeof createClient>
): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
  const start = Date.now();
  let healthy = false;
  let error: string | undefined;

  // Check if provider has an API key configured
  if (!provider.api_key_ref) {
    // Demo providers are always healthy
    if (provider.slug.startsWith("mock")) {
      return { healthy: true, latency_ms: 0 };
    }
    return { healthy: false, latency_ms: 0, error: "No API key configured" };
  }

  try {
    const apiKey = Deno.env.get(provider.api_key_ref);
    if (!apiKey) {
      return { healthy: false, latency_ms: 0, error: `Secret ${provider.api_key_ref} not set` };
    }

    // Perform a lightweight health probe per provider type
    if (provider.slug === "openai-tts") {
      const res = await fetch("https://api.openai.com/v1/models/tts-1", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      healthy = res.ok;
      if (!res.ok) error = `HTTP ${res.status}`;
    } else if (provider.slug.startsWith("elevenlabs")) {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      healthy = res.ok;
      if (!res.ok) error = `HTTP ${res.status}`;
    } else if (provider.slug === "luma-video") {
      const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      healthy = res.ok;
      if (!res.ok) error = `HTTP ${res.status}`;
    } else {
      // Unknown provider — assume healthy if key is present
      healthy = true;
    }
  } catch (e) {
    healthy = false;
    error = e instanceof Error ? e.message : "Probe failed";
  }

  const latency_ms = Date.now() - start;

  // Update provider health in DB
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const adminDb = createClient(supabaseUrl, serviceKey);

  const newStatus = healthy ? "active" : "degraded";
  await (adminDb as any).from("ph_providers").update({
    status:            newStatus,
    health_score:      healthy ? Math.min(100, provider.health_score + 5) : Math.max(0, provider.health_score - 15),
    avg_latency_ms:    healthy ? Math.round((provider.avg_latency_ms * 9 + latency_ms) / 10) : provider.avg_latency_ms,
    last_health_check: new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  }).eq("id", provider.id);

  return { healthy, latency_ms, error };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400): Response {
  return json({ ok: false, error: msg }, status);
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Unauthorized", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const action = body.action as string;

  // ── list_providers ──────────────────────────────────────────────────────────
  if (action === "list_providers") {
    const type = body.type as string | undefined;
    let q = (db as any).from("ph_providers").select("*").order("priority");
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── get_provider ────────────────────────────────────────────────────────────
  if (action === "get_provider") {
    const { provider_id, slug } = body as { provider_id?: string; slug?: string };
    let q = (db as any).from("ph_providers").select("*");
    if (provider_id) q = q.eq("id", provider_id);
    else if (slug)   q = q.eq("slug", slug);
    else return err("provider_id or slug required");
    const { data, error } = await q.maybeSingle();
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── create_provider ─────────────────────────────────────────────────────────
  if (action === "create_provider") {
    const input = body.data as Record<string, unknown>;
    if (!input?.name || !input?.slug || !input?.type) return err("name, slug, type required");
    const { data, error } = await (db as any)
      .from("ph_providers").insert(input).select().single();
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── update_provider ─────────────────────────────────────────────────────────
  if (action === "update_provider") {
    const { provider_id } = body as { provider_id: string };
    const patch = body.data as Record<string, unknown>;
    if (!provider_id) return err("provider_id required");
    const { data, error } = await (db as any)
      .from("ph_providers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", provider_id)
      .select().single();
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── delete_provider ─────────────────────────────────────────────────────────
  if (action === "delete_provider") {
    const { provider_id } = body as { provider_id: string };
    if (!provider_id) return err("provider_id required");
    // Prevent deletion of system providers
    const { data: p } = await (db as any)
      .from("ph_providers").select("is_system").eq("id", provider_id).single();
    if (p?.is_system) return err("System providers cannot be deleted");
    const { error } = await (db as any).from("ph_providers").delete().eq("id", provider_id);
    if (error) return err(error.message);
    return json({ ok: true });
  }

  // ── route ───────────────────────────────────────────────────────────────────
  if (action === "route") {
    const type        = body.type as string;
    const preferences = body.preferences as RoutingPreferences | undefined;
    if (!type) return err("type required");

    // Get routing strategy from config
    const { data: strategyRow } = await (db as any)
      .from("ph_configs").select("value").eq("key", "routing_strategy").maybeSingle();
    const strategy = (strategyRow?.value as string)?.replace(/"/g, "") ?? "smart";

    const { data: providers } = await (db as any)
      .from("ph_providers")
      .select("*")
      .eq("type", type)
      .order("priority");

    const { primary, alternatives } = selectProviders(
      providers ?? [], type, preferences, strategy
    );

    if (!primary) return json({ ok: false, error: "No eligible providers" });

    const score = scoreProvider(primary, preferences);
    return json({
      ok: true,
      data: {
        provider:     primary,
        score:        Math.round(score * 100) / 100,
        reason:       `Selected via ${strategy} strategy (score: ${score.toFixed(1)})`,
        alternatives,
      },
    });
  }

  // ── record_result ───────────────────────────────────────────────────────────
  if (action === "record_result") {
    const { provider_id, success, latency_ms, cost_usd, job_type, error_message, failover_to } =
      body as {
        provider_id: string;
        success: boolean;
        latency_ms?: number;
        cost_usd?: number;
        job_type?: string;
        error_message?: string;
        failover_to?: string;
      };

    if (!provider_id) return err("provider_id required");

    // Call the RPC
    await (db as any).rpc("ph_record_metric", {
      p_provider_id: provider_id,
      p_success:     success,
      p_latency_ms:  latency_ms ?? null,
      p_cost_usd:    cost_usd ?? 0,
    });

    // Insert log entry
    const { data: providerRow } = await (db as any)
      .from("ph_providers").select("slug").eq("id", provider_id).maybeSingle();

    await (db as any).from("ph_logs").insert({
      provider_id,
      provider_slug: providerRow?.slug ?? null,
      job_type:      job_type ?? null,
      action:        "generation",
      status:        success ? "success" : "failure",
      latency_ms:    latency_ms ?? null,
      cost_usd:      cost_usd ?? null,
      error_message: error_message ?? null,
      failover_to:   failover_to ?? null,
    });

    // Record failover if applicable
    if (!success && failover_to) {
      await (db as any).from("ph_failovers").insert({
        from_provider_id: provider_id,
        to_provider_id:   failover_to,
        from_slug:        providerRow?.slug ?? null,
        job_type,
        reason:           "generation_failure",
        error_message,
      });
    }

    return json({ ok: true });
  }

  // ── health_check ────────────────────────────────────────────────────────────
  if (action === "health_check") {
    const { provider_id } = body as { provider_id?: string };
    let providers: Provider[] = [];

    if (provider_id) {
      const { data } = await (db as any)
        .from("ph_providers").select("*").eq("id", provider_id);
      providers = data ?? [];
    } else {
      const { data } = await (db as any)
        .from("ph_providers").select("*").neq("status", "inactive");
      providers = data ?? [];
    }

    const results: Record<string, { healthy: boolean; latency_ms: number; error?: string }> = {};
    // Run checks in parallel
    await Promise.all(
      providers.map(async (p) => {
        results[p.slug] = await runHealthCheck(p, db);
      })
    );

    return json({ ok: true, data: results });
  }

  // ── get_metrics ─────────────────────────────────────────────────────────────
  if (action === "get_metrics") {
    const { provider_id, hours = 24 } = body as { provider_id?: string; hours?: number };

    if (provider_id) {
      const { data } = await (db as any).rpc("ph_get_provider_stats", {
        p_provider_id: provider_id,
        p_hours:       hours,
      });
      return json({ ok: true, data });
    }

    // All providers aggregate
    const { data: providers } = await (db as any)
      .from("ph_providers").select("id, slug, name, type");

    const allStats: Record<string, unknown> = {};
    await Promise.all(
      (providers ?? []).map(async (p: { id: string; slug: string }) => {
        const { data } = await (db as any).rpc("ph_get_provider_stats", {
          p_provider_id: p.id,
          p_hours:       hours,
        });
        allStats[p.slug] = data;
      })
    );

    return json({ ok: true, data: allStats });
  }

  // ── get_metrics_timeseries ──────────────────────────────────────────────────
  if (action === "get_metrics_timeseries") {
    const { provider_id, hours = 24 } = body as { provider_id: string; hours?: number };
    if (!provider_id) return err("provider_id required");

    const { data, error } = await (db as any)
      .from("ph_metrics")
      .select("*")
      .eq("provider_id", provider_id)
      .gte("period_start", new Date(Date.now() - hours * 3_600_000).toISOString())
      .order("period_start", { ascending: true });

    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── get_logs ─────────────────────────────────────────────────────────────────
  if (action === "get_logs") {
    const { provider_id, limit = 50, job_type } = body as {
      provider_id?: string;
      limit?: number;
      job_type?: string;
    };

    let q = (db as any)
      .from("ph_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (provider_id) q = q.eq("provider_id", provider_id);
    if (job_type)    q = q.eq("job_type", job_type);

    const { data, error } = await q;
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── get_failovers ────────────────────────────────────────────────────────────
  if (action === "get_failovers") {
    const { limit = 50 } = body as { limit?: number };
    const { data, error } = await (db as any)
      .from("ph_failovers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) return err(error.message);
    return json({ ok: true, data });
  }

  // ── get_config ────────────────────────────────────────────────────────────────
  if (action === "get_config") {
    const { data, error } = await (db as any).from("ph_configs").select("*");
    if (error) return err(error.message);
    const config: Record<string, unknown> = {};
    for (const row of (data ?? [])) {
      config[row.key] = row.value;
    }
    return json({ ok: true, data: config });
  }

  // ── update_config ─────────────────────────────────────────────────────────────
  if (action === "update_config") {
    const updates = body.data as Record<string, unknown>;
    if (!updates) return err("data required");

    for (const [key, value] of Object.entries(updates)) {
      await (db as any).from("ph_configs").upsert({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    }
    return json({ ok: true });
  }

  // ── test_provider ─────────────────────────────────────────────────────────────
  if (action === "test_provider") {
    const { provider_id } = body as { provider_id: string };
    if (!provider_id) return err("provider_id required");

    const { data: p } = await (db as any)
      .from("ph_providers").select("*").eq("id", provider_id).maybeSingle();
    if (!p) return err("Provider not found");

    const result = await runHealthCheck(p as Provider, db);
    return json({
      ok:     result.healthy,
      data:   result,
      error:  result.error,
    });
  }

  return err(`Unknown action: ${action}`);
});
