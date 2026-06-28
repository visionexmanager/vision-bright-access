// AI Provider Hub — TypeScript types

// ── Provider types ────────────────────────────────────────────────────────────

export type ProviderType    = "tts" | "voice_cloning" | "text_to_video";
export type ProviderStatus  = "active" | "inactive" | "degraded" | "error";
export type RoutingStrategy = "smart" | "priority" | "round_robin" | "least_latency" | "cheapest";

export interface Provider {
  id:                   string;
  name:                 string;
  slug:                 string;
  type:                 ProviderType;
  status:               ProviderStatus;
  priority:             number;
  api_key_ref:          string | null;
  base_url:             string | null;
  default_model:        string | null;
  regions:              string[];
  max_rpm:              number;
  cost_per_request:     number;
  cost_limit_daily_usd: number;
  health_score:         number;
  avg_latency_ms:       number;
  success_rate:         number;
  last_health_check:    string | null;
  last_failure_at:      string | null;
  consecutive_failures: number;
  capabilities:         string[];
  config:               Record<string, unknown>;
  is_system:            boolean;
  created_at:           string;
  updated_at:           string;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface ProviderMetricRow {
  id:              string;
  provider_id:     string;
  period_start:    string;
  requests:        number;
  successes:       number;
  failures:        number;
  total_latency_ms: number;
  total_cost_usd:  number;
}

export interface ProviderStats {
  total_requests:  number;
  total_successes: number;
  total_failures:  number;
  total_cost_usd:  number;
  avg_latency_ms:  number;
  success_rate:    number;
  rpm:             number;
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export interface ProviderLog {
  id:            string;
  provider_id:   string | null;
  provider_slug: string | null;
  job_type:      string | null;
  action:        string;
  status:        "success" | "failure" | "timeout" | "skipped";
  latency_ms:    number | null;
  cost_usd:      number | null;
  error_code:    string | null;
  error_message: string | null;
  retry_count:   number;
  failover_to:   string | null;
  request_meta:  Record<string, unknown>;
  created_at:    string;
}

// ── Failovers ─────────────────────────────────────────────────────────────────

export interface ProviderFailover {
  id:               string;
  from_provider_id: string | null;
  to_provider_id:   string | null;
  from_slug:        string | null;
  to_slug:          string | null;
  job_type:         string | null;
  reason:           string | null;
  error_message:    string | null;
  resolved:         boolean;
  resolved_at:      string | null;
  created_at:       string;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface HubConfig {
  routing_strategy:             RoutingStrategy;
  failover_enabled:             boolean;
  health_check_interval_sec:    number;
  max_consecutive_failures:     number;
  health_score_decay_rate:      number;
  health_score_recovery_rate:   number;
  cost_tracking_enabled:        boolean;
  metrics_retention_hours:      number;
}

// ── Smart routing ─────────────────────────────────────────────────────────────

export interface RoutingPreferences {
  weights?: {
    latency:  number;
    cost:     number;
    health:   number;
    priority: number;
  };
  requireCapabilities?: string[];
  preferredSlug?:       string;
  excludeSlugs?:        string[];
}

export interface RoutingDecision {
  provider:      Provider;
  score:         number;
  reason:        string;
  alternatives:  Provider[];
}

// ── API request/response ──────────────────────────────────────────────────────

export type ProviderHubAction =
  | "list_providers"
  | "get_provider"
  | "create_provider"
  | "update_provider"
  | "delete_provider"
  | "test_provider"
  | "health_check"
  | "get_metrics"
  | "get_logs"
  | "get_failovers"
  | "get_config"
  | "update_config"
  | "route"
  | "record_result";

export interface ProviderHubRequest {
  action:      ProviderHubAction;
  provider_id?: string;
  slug?:        string;
  type?:        ProviderType;
  data?:        Record<string, unknown>;
  hours?:       number;
  limit?:       number;
  preferences?: RoutingPreferences;
  // For record_result
  success?:     boolean;
  latency_ms?:  number;
  cost_usd?:    number;
}

export interface ProviderHubResponse<T = unknown> {
  ok:      boolean;
  data?:   T;
  error?:  string;
}

// ── Create / Update inputs ────────────────────────────────────────────────────

export interface CreateProviderInput {
  name:                  string;
  slug:                  string;
  type:                  ProviderType;
  status?:               ProviderStatus;
  priority?:             number;
  api_key_ref?:          string;
  base_url?:             string;
  default_model?:        string;
  regions?:              string[];
  max_rpm?:              number;
  cost_per_request?:     number;
  cost_limit_daily_usd?: number;
  capabilities?:         string[];
  config?:               Record<string, unknown>;
}

export type UpdateProviderInput = Partial<Omit<
  CreateProviderInput,
  "slug" | "type"
>> & {
  status?: ProviderStatus;
};

// ── Dashboard UI state ────────────────────────────────────────────────────────

export interface ProviderWithStats extends Provider {
  stats?: ProviderStats;
}

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  tts:            "Text to Speech",
  voice_cloning:  "Voice Cloning",
  text_to_video:  "Text to Video",
};

export const PROVIDER_TYPE_ICONS: Record<ProviderType, string> = {
  tts:            "🎙️",
  voice_cloning:  "🧬",
  text_to_video:  "🎬",
};

export const STATUS_COLORS: Record<ProviderStatus, string> = {
  active:   "text-green-400",
  inactive: "text-gray-400",
  degraded: "text-yellow-400",
  error:    "text-red-400",
};

export const STATUS_BG: Record<ProviderStatus, string> = {
  active:   "bg-green-500/15 text-green-400",
  inactive: "bg-gray-500/15 text-gray-400",
  degraded: "bg-yellow-500/15 text-yellow-400",
  error:    "bg-red-500/15 text-red-400",
};
