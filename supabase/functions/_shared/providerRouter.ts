// Shared Provider Router — imported by speech-generate, voice-studio, video-studio
// Provides smart provider selection, result recording, and failover support
// without duplicating logic across edge functions.

import { createClient } from "npm:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouterProvider {
  id:                   string;
  slug:                 string;
  name:                 string;
  type:                 string;
  status:               string;
  priority:             number;
  api_key_ref:          string | null;
  default_model:        string | null;
  health_score:         number;
  avg_latency_ms:       number;
  cost_per_request:     number;
  consecutive_failures: number;
  capabilities:         string[];
  config:               Record<string, unknown>;
}

export interface RoutingPreferences {
  requireCapabilities?: string[];
  preferredSlug?:       string;
  excludeSlugs?:        string[];
}

export interface RouteResult {
  provider:     RouterProvider;
  alternatives: RouterProvider[];
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreProvider(p: RouterProvider): number {
  const latencyScore  = Math.max(0, 100 - (p.avg_latency_ms / 20));
  const costScore     = Math.max(0, 100 - (p.cost_per_request * 500));
  const healthScore   = p.health_score;
  const priorityScore = Math.max(0, 100 - p.priority);
  return latencyScore * 0.25 + costScore * 0.20 + healthScore * 0.40 + priorityScore * 0.15;
}

// ── Main router ───────────────────────────────────────────────────────────────

export async function resolveProvider(
  type: string,
  prefs?: RoutingPreferences
): Promise<RouteResult | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db          = createClient(supabaseUrl, serviceKey);

  const { data: providers } = await (db as any)
    .from("ph_providers")
    .select("*")
    .eq("type", type)
    .neq("status", "inactive")
    .order("priority");

  if (!providers?.length) return null;

  let eligible: RouterProvider[] = providers.filter((p: RouterProvider) =>
    p.health_score > 20 &&
    !(prefs?.excludeSlugs?.includes(p.slug))
  );

  if (prefs?.requireCapabilities?.length) {
    const req = prefs.requireCapabilities;
    eligible = eligible.filter((p) => req.every((c) => p.capabilities.includes(c)));
  }

  if (!eligible.length) return null;

  if (prefs?.preferredSlug) {
    const preferred = eligible.find((p) => p.slug === prefs!.preferredSlug);
    if (preferred) {
      return { provider: preferred, alternatives: eligible.filter((p) => p.slug !== prefs!.preferredSlug) };
    }
  }

  eligible.sort((a, b) => scoreProvider(b) - scoreProvider(a));
  return { provider: eligible[0], alternatives: eligible.slice(1) };
}

// ── Result recorder ───────────────────────────────────────────────────────────

export async function recordResult(params: {
  provider_id:    string;
  provider_slug:  string;
  job_type:       string;
  success:        boolean;
  latency_ms?:    number;
  cost_usd?:      number;
  error_message?: string;
  failover_to?:   string;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db          = createClient(supabaseUrl, serviceKey);

  // Upsert metrics
  await (db as any).rpc("ph_record_metric", {
    p_provider_id: params.provider_id,
    p_success:     params.success,
    p_latency_ms:  params.latency_ms ?? null,
    p_cost_usd:    params.cost_usd ?? 0,
  });

  // Insert log entry
  await (db as any).from("ph_logs").insert({
    provider_id:   params.provider_id,
    provider_slug: params.provider_slug,
    job_type:      params.job_type,
    action:        "generation",
    status:        params.success ? "success" : "failure",
    latency_ms:    params.latency_ms ?? null,
    cost_usd:      params.cost_usd ?? null,
    error_message: params.error_message ?? null,
    failover_to:   params.failover_to ?? null,
  });

  // Record failover event
  if (!params.success && params.failover_to) {
    const { data: toProvider } = await (db as any)
      .from("ph_providers")
      .select("id, slug")
      .eq("slug", params.failover_to)
      .maybeSingle();

    await (db as any).from("ph_failovers").insert({
      from_provider_id: params.provider_id,
      to_provider_id:   toProvider?.id ?? null,
      from_slug:        params.provider_slug,
      to_slug:          params.failover_to,
      job_type:         params.job_type,
      reason:           "generation_failure",
      error_message:    params.error_message,
    });
  }
}

// ── API key resolver ──────────────────────────────────────────────────────────

export function resolveApiKey(provider: RouterProvider): string | null {
  if (!provider.api_key_ref) return null;
  return Deno.env.get(provider.api_key_ref) ?? null;
}
