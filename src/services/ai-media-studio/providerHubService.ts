// AI Provider Hub — service layer
import { callProviderHub } from "@/lib/api/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";
import type {
  Provider,
  ProviderStats,
  ProviderLog,
  ProviderFailover,
  ProviderMetricRow,
  HubConfig,
  ProviderType,
  CreateProviderInput,
  UpdateProviderInput,
  RoutingPreferences,
  RoutingDecision,
} from "@/lib/types/provider-hub";

const db = supabase as any;

// ── Provider CRUD ─────────────────────────────────────────────────────────────

export async function listProviders(type?: ProviderType): Promise<Provider[]> {
  const res = await callProviderHub<Provider[]>({ action: "list_providers", type });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

export async function getProvider(id: string): Promise<Provider | null> {
  const res = await callProviderHub<Provider>({ action: "get_provider", provider_id: id });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? null;
}

export async function createProvider(input: CreateProviderInput): Promise<Provider> {
  const res = await callProviderHub<Provider>({ action: "create_provider", data: input as unknown as Record<string, unknown> });
  if (!res.ok) throw new Error(res.error);
  return res.data!;
}

export async function updateProvider(id: string, patch: UpdateProviderInput): Promise<Provider> {
  const res = await callProviderHub<Provider>({
    action:      "update_provider",
    provider_id: id,
    data:        patch as unknown as Record<string, unknown>,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data!;
}

export async function deleteProvider(id: string): Promise<void> {
  const res = await callProviderHub({ action: "delete_provider", provider_id: id });
  if (!res.ok) throw new Error(res.error);
}

// ── Routing ───────────────────────────────────────────────────────────────────

export async function routeProvider(
  type: ProviderType,
  preferences?: RoutingPreferences,
  signal?: AbortSignal
): Promise<RoutingDecision> {
  const res = await callProviderHub<RoutingDecision>(
    { action: "route", type, preferences },
    signal
  );
  if (!res.ok || !res.data) throw new Error(res.error ?? "No provider available");
  return res.data;
}

// ── Result recording ──────────────────────────────────────────────────────────

export async function recordProviderResult(params: {
  provider_id:   string;
  success:       boolean;
  latency_ms?:   number;
  cost_usd?:     number;
  job_type?:     ProviderType;
  error_message?: string;
  failover_to?:  string;
}): Promise<void> {
  // Fire-and-forget: don't await
  callProviderHub({ action: "record_result", ...params as unknown as Record<string, unknown> }).catch(() => null);
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function checkProviderHealth(
  providerId?: string
): Promise<Record<string, { healthy: boolean; latency_ms: number; error?: string }>> {
  const res = await callProviderHub<Record<string, { healthy: boolean; latency_ms: number; error?: string }>>(
    { action: "health_check", provider_id: providerId }
  );
  if (!res.ok) throw new Error(res.error);
  return res.data ?? {};
}

export async function testProvider(
  providerId: string
): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
  const res = await callProviderHub<{ healthy: boolean; latency_ms: number; error?: string }>(
    { action: "test_provider", provider_id: providerId }
  );
  return res.data ?? { healthy: false, latency_ms: 0, error: res.error };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export async function getProviderStats(
  providerId: string,
  hours = 24
): Promise<ProviderStats> {
  const res = await callProviderHub<ProviderStats>({
    action:      "get_metrics",
    provider_id: providerId,
    hours,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? { total_requests: 0, total_successes: 0, total_failures: 0, total_cost_usd: 0, avg_latency_ms: 0, success_rate: 100, rpm: 0 };
}

export async function getAllProviderStats(
  hours = 24
): Promise<Record<string, ProviderStats>> {
  const res = await callProviderHub<Record<string, ProviderStats>>({
    action: "get_metrics",
    hours,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? {};
}

export async function getMetricsTimeSeries(
  providerId: string,
  hours = 24
): Promise<ProviderMetricRow[]> {
  const res = await callProviderHub<ProviderMetricRow[]>({
    action:      "get_metrics_timeseries",
    provider_id: providerId,
    hours,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function getProviderLogs(params: {
  provider_id?: string;
  job_type?:    ProviderType;
  limit?:       number;
}): Promise<ProviderLog[]> {
  const res = await callProviderHub<ProviderLog[]>({
    action: "get_logs",
    ...params as unknown as Record<string, unknown>,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

// ── Failovers ─────────────────────────────────────────────────────────────────

export async function getFailovers(limit = 50): Promise<ProviderFailover[]> {
  const res = await callProviderHub<ProviderFailover[]>({
    action: "get_failovers",
    limit,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getHubConfig(): Promise<Partial<HubConfig>> {
  const res = await callProviderHub<Record<string, unknown>>({ action: "get_config" });
  if (!res.ok) throw new Error(res.error);
  const raw = res.data ?? {};
  return {
    routing_strategy:           raw.routing_strategy as string as HubConfig["routing_strategy"],
    failover_enabled:           raw.failover_enabled as boolean,
    health_check_interval_sec:  raw.health_check_interval_sec as number,
    max_consecutive_failures:   raw.max_consecutive_failures as number,
    health_score_decay_rate:    raw.health_score_decay_rate as number,
    health_score_recovery_rate: raw.health_score_recovery_rate as number,
    cost_tracking_enabled:      raw.cost_tracking_enabled as boolean,
    metrics_retention_hours:    raw.metrics_retention_hours as number,
  };
}

export async function updateHubConfig(patch: Partial<HubConfig>): Promise<void> {
  const res = await callProviderHub({
    action: "update_config",
    data:   patch as unknown as Record<string, unknown>,
  });
  if (!res.ok) throw new Error(res.error);
}
