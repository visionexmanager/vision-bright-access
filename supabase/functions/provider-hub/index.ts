// AI Provider Hub — central routing, health, and monitoring edge function
// All AI generation calls should route through here for provider selection
//
// ── This function is exempt from gateway JWT verification ────────────────────
//
// Listed in supabase/config.toml and scripts/deploy-changed-supabase-functions.sh
// so the scheduled OpenAI model discovery can reach it with Bearer <CRON_SECRET>,
// which is not a JWT. Nothing is weakened: the cron branch below compares that
// secret in constant time, fails closed when it is unset, and can run exactly
// one action; every other request still needs a signed-in admin, checked here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { discoverOpenAIModels, type DiscoveryOutcome } from "../_shared/openaiModelDiscovery.ts";

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

/** Health a passing probe restores at least — above the routers' cut-off of 20 (Phase 2J-1). */
const HEALTH_AFTER_PASSING_PROBE = 50;

async function runHealthCheck(
  provider: Provider,
  db: SupabaseClient
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

  // A probe reports health; it never switches a provider on. An `inactive` row
  // is off on purpose (RunPod, Luma), and a successful probe used to flip it to
  // `active`, making it routable without anyone deciding so (Phase 2J-0).
  // Phase 2J-1 states the whole rule: automation moves a row only between the
  // two automatic states, `active` and `degraded`. `inactive` and `error` are
  // an admin's, and a probe leaves them exactly as it found them.
  const automatic = provider.status === "active" || provider.status === "degraded";
  const newStatus = automatic ? (healthy ? "active" : "degraded") : provider.status;
  // A passing probe is evidence the provider works now. Without a floor, a row
  // that had fallen to the routers' cut-off (health ≤ 20) came back `active`
  // yet still excluded, and — excluded, so sent no traffic — could only climb
  // back five points per manual probe. The floor puts it just back in play,
  // well below a provider with a clean record.
  const recoveredHealth = Math.max(HEALTH_AFTER_PASSING_PROBE, Math.min(100, provider.health_score + 5));
  await (adminDb as any).from("ph_providers").update({
    status:            newStatus,
    health_score:      healthy ? recoveredHealth : Math.max(0, provider.health_score - 15),
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

// ── OpenAI model discovery ────────────────────────────────────────────────────

/** Equal-length, constant-time comparison, so response timing says nothing about the secret. */
function secretsMatch(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Discovery's answer as a response. Codes and model ids only — no key, no body, no price. */
function discoveryResponse(outcome: DiscoveryOutcome): Response {
  if (outcome.ok) return json({ ok: true, dry_run: outcome.dryRun, report: outcome.report });
  const status = outcome.error === "no_key" ? 503 : outcome.error === "store_failed" ? 500 : 502;
  return json({ ok: false, error: outcome.error, ...(outcome.status ? { upstream_status: outcome.status } : {}) }, status);
}

function runDiscovery(dryRun: boolean): Promise<DiscoveryOutcome> {
  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  return discoverOpenAIModels({ db: service, read: (name) => Deno.env.get(name) }, { dryRun });
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Unauthorized", 401);

  // ── The scheduled discovery, and nothing else ─────────────────────────────
  //
  // The only thing the cron secret can do. Checked before any JWT parsing, and
  // it reads no body: the action and the apply switch travel in the query
  // string, so no caller has its body read before an identity is established.
  // A request carrying the secret for another action is refused.
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (cronSecret && secretsMatch(authHeader, `Bearer ${cronSecret}`)) {
    const query = new URL(req.url).searchParams;
    if (query.get("action") !== "discover_openai_models") return err("Forbidden", 403);
    // A dry run unless the workflow says, explicitly, to write.
    return discoveryResponse(await runDiscovery(query.get("apply") !== "true"));
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  // ── Admins only, and not by RLS alone ─────────────────────────────────────
  //
  // Every action below is an operator action: the provider inventory, the
  // routing strategy, the cost metrics, and `health_check`, which spends real
  // upstream quota on real keys through the service role. Until now the only
  // thing standing between a signed-in customer and any of it was a write
  // policy that 20260829 happened to drop — the function itself asked nothing.
  // Defence in depth means the gate is here too, and it is checked once,
  // before the body is even read.
  const serviceKeyForRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const roleDb = createClient(supabaseUrl, serviceKeyForRole);
  const { data: isAdmin } = await (roleDb as any).rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (isAdmin !== true) {
    // Recorded, not just refused: somebody probing the provider inventory is
    // worth seeing in the security feed. No identifier beyond the user id,
    // which this table already scopes to admins.
    await (roleDb as any).rpc("record_security_event", {
      _kind: "provider_hub_forbidden",
      _source: "provider-hub",
      _subject_hash: null,
      _detail: { user_id: user.id },
    }).catch(() => {});
    return err("Forbidden", 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const action = body.action as string;

  // ── discover_openai_models ──────────────────────────────────────────────────
  //
  // GET /v1/models on the existing key, reconciled into ph_provider_models.
  // A dry run unless dry_run is explicitly false. Registers and refreshes;
  // never enables routing — that stays a curated decision per model.
  if (action === "discover_openai_models") {
    return discoveryResponse(await runDiscovery(body.dry_run !== false));
  }

  // ── list_models ─────────────────────────────────────────────────────────────
  // The catalog, for an admin reviewing what discovery found. Admin-only, like
  // every action here; it is never reachable by a customer.
  if (action === "list_models") {
    const { data, error } = await (roleDb as any).from("ph_provider_models")
      .select("provider, model_id, display_name, available, last_seen_at, unavailable_since, capabilities, capability_source, pricing, pricing_verified_on, routing_enabled")
      .order("model_id");
    if (error) return err("Could not read the model catalog");
    return json({ ok: true, data });
  }

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
