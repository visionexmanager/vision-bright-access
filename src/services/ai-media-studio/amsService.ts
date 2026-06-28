// AI Media Studio — service layer (pure async functions, no React)
import { supabase } from "@/integrations/supabase/client";
import type {
  AMSProject,
  AMSAsset,
  AMSTemplate,
  AMSActivityLog,
  AMSStorageUsage,
  AMSUserPreferences,
  CreateProjectInput,
  UpdateProjectInput,
  CreateAssetInput,
  ProjectFilters,
  AssetFilters,
} from "@/lib/types/ai-media-studio";

const db = supabase as any;

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects(filters: ProjectFilters = {}): Promise<AMSProject[]> {
  let q = db.from("ams_projects").select("*");

  if (filters.status) {
    q = q.eq("status", filters.status);
  } else {
    q = q.neq("status", "deleted");
  }
  if (filters.is_favorite !== undefined) q = q.eq("is_favorite", filters.is_favorite);
  if (filters.query) q = q.ilike("name", `%${filters.query}%`);

  const sort = filters.sort ?? "updated_at";
  q = q.order(sort, { ascending: filters.ascending ?? false });

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<AMSProject | null> {
  const { data, error } = await db
    .from("ams_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(input: CreateProjectInput): Promise<AMSProject> {
  const { data, error } = await db
    .from("ams_projects")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<AMSProject> {
  const { data, error } = await db
    .from("ams_projects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db
    .from("ams_projects")
    .update({ status: "deleted" })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveProject(id: string): Promise<void> {
  const { error } = await db
    .from("ams_projects")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreProject(id: string): Promise<void> {
  const { error } = await db
    .from("ams_projects")
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateProject(id: string): Promise<AMSProject> {
  const original = await getProject(id);
  if (!original) throw new Error("Project not found");
  return createProject({
    name: `${original.name} (copy)`,
    description: original.description ?? undefined,
    tags: original.tags,
    language: original.language,
    voice_preset: original.voice_preset ?? undefined,
    video_preset: original.video_preset ?? undefined,
  });
}

export async function toggleFavoriteProject(id: string, value: boolean): Promise<void> {
  const { error } = await db
    .from("ams_projects")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) throw error;
}

// ── Assets ────────────────────────────────────────────────────────────────────

export async function listAssets(filters: AssetFilters = {}): Promise<AMSAsset[]> {
  let q = db.from("ams_assets").select("*");

  if (filters.project_id) q = q.eq("project_id", filters.project_id);
  if (filters.asset_type) q = q.eq("asset_type", filters.asset_type);

  if (filters.status) {
    q = q.eq("status", filters.status);
  } else {
    q = q.neq("status", "deleted");
  }

  if (filters.query) q = q.ilike("original_name", `%${filters.query}%`);

  const sort = filters.sort ?? "created_at";
  q = q.order(sort, { ascending: filters.ascending ?? false });

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createAssetRecord(input: CreateAssetInput): Promise<AMSAsset> {
  const { data, error } = await db
    .from("ams_assets")
    .insert({ ...input, status: "ready" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await db
    .from("ams_assets")
    .update({ status: "deleted" })
    .eq("id", id);
  if (error) throw error;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function listTemplates(type?: string): Promise<AMSTemplate[]> {
  let q = db.from("ams_templates").select("*").eq("is_public", true);
  if (type) q = q.eq("template_type", type);
  q = q.order("usage_count", { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ── Activity logs ─────────────────────────────────────────────────────────────

export async function listActivity(limit = 20): Promise<AMSActivityLog[]> {
  const { data, error } = await db
    .from("ams_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function logActivity(
  action: string,
  entityType: string,
  entityId: string | null,
  projectId?: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await db.rpc("ams_log_activity", {
    p_project_id:  projectId ?? null,
    p_asset_id:    null,
    p_action:      action,
    p_entity_type: entityType,
    p_entity_id:   entityId,
    p_details:     details,
  });
  if (error) console.warn("[ams] log activity failed:", error.message);
}

// ── Storage usage ─────────────────────────────────────────────────────────────

export async function getStorageUsage(): Promise<AMSStorageUsage | null> {
  const { data, error } = await db
    .from("ams_storage_usage")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function recalculateStorage(): Promise<void> {
  const { error } = await db.rpc("ams_recalculate_storage");
  if (error) throw error;
}

// ── User preferences ──────────────────────────────────────────────────────────

export async function getUserPreferences(): Promise<AMSUserPreferences | null> {
  const { data, error } = await db
    .from("ams_user_preferences")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserPreferences(
  prefs: Partial<Omit<AMSUserPreferences, "user_id" | "updated_at">>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await db.from("ams_user_preferences").upsert({
    user_id: user.id,
    ...prefs,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
