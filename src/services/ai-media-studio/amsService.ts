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

async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

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
  const ownerId = await requireUserId();
  const { data, error } = await db
    .from("ams_projects")
    .insert({ ...input, owner_id: ownerId })
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
  const ownerId = await requireUserId();
  const { data, error } = await db
    .from("ams_assets")
    .insert({ ...input, owner_id: ownerId, status: "ready" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAsset(id: string): Promise<void> {
  const asset = await db
    .from("ams_assets")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (asset.error) throw asset.error;

  if (asset.data?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("ams-assets")
      .remove([asset.data.storage_path]);
    if (storageError) throw storageError;
  }

  const { error } = await db
    .from("ams_assets")
    .update({ status: "deleted" })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadAssetFile(
  file: File,
  storagePath: string,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  if (!supabaseUrl || !anonKey) throw new Error("Supabase is not configured");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });

    xhr.open("POST", `${supabaseUrl}/storage/v1/object/ams-assets/${encodeURI(storagePath)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || "storage rejected the file"}`));
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error("Network error during upload"));
    };
    xhr.onabort = () => {
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    xhr.send(file);
  });
}

export async function removeUploadedAsset(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from("ams-assets").remove([storagePath]);
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
