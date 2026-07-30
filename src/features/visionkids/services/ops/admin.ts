import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Incident, FeatureFlag, MaintenanceState, Release, Severity, IncidentStatus } from "@/features/visionkids/types/ops.types";

// ── Incidents ────────────────────────────────────────────────────────────────
export async function fetchIncidents(): Promise<Incident[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_incidents").select("*").order("created_at", { ascending: false }).limit(100)
    .returns<Incident[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createIncident(title: string, description: string, severity: Severity, area?: string): Promise<string> {
  const { data, error } = await kidsDb.rpc("create_kids_incident", { _title: title, _description: description, _severity: severity, _area: area ?? null });
  if (error) throw error;
  return data as string;
}

export async function updateIncident(id: string, status: IncidentStatus): Promise<void> {
  const { error } = await kidsDb.rpc("update_kids_incident", { _id: id, _status: status, _assignee: null });
  if (error) throw error;
}

// ── Feature flags ────────────────────────────────────────────────────────────
export async function fetchFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_feature_flags").select("*").order("key")
    .returns<FeatureFlag[]>();
  if (error) throw error;
  return data ?? [];
}

export async function toggleFlag(key: string, enabled: boolean): Promise<void> {
  const { error } = await kidsDb.rpc("toggle_kids_flag", { _key: key, _enabled: enabled });
  if (error) throw error;
}

// ── Releases ─────────────────────────────────────────────────────────────────
export async function fetchReleases(): Promise<Release[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_releases").select("*").order("deployed_at", { ascending: false }).limit(50)
    .returns<Release[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Audit ────────────────────────────────────────────────────────────────────
export interface OpsAuditRow { id: number; actor_id: string; action: string; detail: Record<string, unknown>; created_at: string; }

export async function fetchAudit(): Promise<OpsAuditRow[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_audit").select("*").order("created_at", { ascending: false }).limit(100)
    .returns<OpsAuditRow[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Maintenance ──────────────────────────────────────────────────────────────
export async function fetchMaintenance(): Promise<MaintenanceState | null> {
  const { data, error } = await kidsDb.from("kids_ops_maintenance").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (data as MaintenanceState | null) ?? null;
}

export async function setMaintenance(input: { enabled: boolean; mode: "full" | "partial"; message?: string; adminsBypass: boolean }): Promise<void> {
  const { error } = await kidsDb.rpc("set_kids_maintenance", {
    _enabled: input.enabled, _mode: input.mode, _message: input.message ?? null, _admins_bypass: input.adminsBypass,
  });
  if (error) throw error;
}
