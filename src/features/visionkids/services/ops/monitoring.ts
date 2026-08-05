import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  OpsOverview, ErrorEvent, OpsReview, OpsReport, HealthSnapshot, OpsLog, ReportKind, ErrorKind, LogLevel,
} from "@/features/visionkids/types/ops.types";

export async function fetchOverview(): Promise<OpsOverview> {
  const { data, error } = await kidsDb.rpc("get_kids_ops_overview");
  if (error) throw error;
  return rpcResult<OpsOverview>(data);
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("kids_is_admin");
  if (error) throw error;
  return !!data;
}

export async function fetchErrors(kind?: ErrorKind): Promise<ErrorEvent[]> {
  let query = kidsDb.from("kids_ops_error_events").select("*").order("last_seen", { ascending: false }).limit(100);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.returns<ErrorEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function resolveError(id: string): Promise<void> {
  const { error } = await kidsDb.rpc("resolve_kids_error", { _id: id });
  if (error) throw error;
}

export async function fetchReviews(status = "pending"): Promise<OpsReview[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_reviews").select("*").eq("status", status).order("created_at").limit(100)
    .returns<OpsReview[]>();
  if (error) throw error;
  return data ?? [];
}

export async function decideReview(id: string, approve: boolean, notes?: string): Promise<void> {
  const { error } = await kidsDb.rpc("decide_kids_review", { _id: id, _approve: approve, _notes: notes ?? null });
  if (error) throw error;
}

export async function fetchReports(kind: ReportKind): Promise<OpsReport[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_reports").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(20)
    .returns<OpsReport[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchHealth(): Promise<HealthSnapshot[]> {
  const { data, error } = await kidsDb
    .from("kids_ops_health_snapshots").select("*").order("captured_at", { ascending: false }).limit(50)
    .returns<HealthSnapshot[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLogs(level?: LogLevel, search?: string): Promise<OpsLog[]> {
  let query = kidsDb.from("kids_ops_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (level) query = query.eq("level", level);
  if (search && search.trim()) query = query.ilike("message", `%${search.trim()}%`);
  const { data, error } = await query.returns<OpsLog[]>();
  if (error) throw error;
  return data ?? [];
}
