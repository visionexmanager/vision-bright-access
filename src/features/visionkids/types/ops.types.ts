export type Severity = "critical" | "major" | "minor" | "info";
export type IncidentStatus = "open" | "investigating" | "monitoring" | "resolved";

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  area: string | null;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
}

export type ErrorKind = "javascript" | "api" | "database" | "ai" | "network";

export interface ErrorEvent {
  id: string;
  kind: ErrorKind;
  message: string;
  detail: Record<string, unknown>;
  resolved: boolean;
  count: number;
  first_seen: string;
  last_seen: string;
}

export type ReviewContentKind = "story" | "game" | "course" | "video" | "image" | "audio" | "project" | "ai_generated";

export interface OpsReview {
  id: string;
  content_kind: ReviewContentKind;
  ref_id: string | null;
  title: string;
  status: "pending" | "approved" | "rejected";
  flags: string[];
  reviewer_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportKind = "accessibility" | "performance" | "security" | "ai";

export interface OpsReport {
  id: string;
  kind: ReportKind;
  score: number | null;
  summary: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
}

export type ServiceStatus = "operational" | "degraded" | "down";

export interface HealthSnapshot {
  id: string;
  service: string;
  status: ServiceStatus;
  latency_ms: number | null;
  detail: Record<string, unknown>;
  captured_at: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface OpsLog {
  id: number;
  level: LogLevel;
  source: string | null;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export type ReleaseChannel = "stable" | "beta" | "canary";

export interface Release {
  id: string;
  version: string;
  channel: ReleaseChannel;
  notes: string | null;
  status: "deployed" | "rolled_back";
  deployed_at: string;
}

export interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  channel: ReleaseChannel;
  rollout_pct: number;
  updated_at: string;
}

export interface MaintenanceState {
  id: number;
  enabled: boolean;
  mode: "full" | "partial";
  message: string | null;
  admins_bypass: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface OpsOverview {
  open_incidents: number;
  critical_incidents: number;
  unresolved_errors: number;
  pending_reviews: number;
  active_flags: number;
  maintenance: boolean;
  organizations: number;
  published_products: number;
}
