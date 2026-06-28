// Video Studio — service layer (pure async, no React)
import { supabase } from "@/integrations/supabase/client";
import type {
  VideoJob,
  VideoTemplate,
  VideoLibraryFilters,
} from "@/lib/types/video-studio";

const db = supabase as any;

// ── Video Jobs ────────────────────────────────────────────────────────────────

export async function listVideoJobs(filters: VideoLibraryFilters = {}): Promise<VideoJob[]> {
  let q = db.from("vx_video_jobs").select("*");

  if (filters.status === "active") {
    q = q.in("status", ["queued", "preparing", "generating", "rendering", "optimizing", "uploading"]);
  } else if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }

  if (!filters.showArchived) q = q.eq("is_archived", false);
  if (filters.showFavorites)  q = q.eq("is_favorite", true);
  if (filters.style)          q = q.eq("style", filters.style);
  if (filters.aspectRatio)    q = q.eq("aspect_ratio", filters.aspectRatio);
  if (filters.projectId)      q = q.eq("project_id", filters.projectId);

  const sortBy  = filters.sortBy  ?? "created_at";
  const sortDir = filters.sortDir ?? "desc";
  q = q.order(sortBy, { ascending: sortDir === "asc" }).limit(100);

  const { data, error } = await q;
  if (error) throw error;

  let result: VideoJob[] = data ?? [];
  if (filters.query?.trim()) {
    const qLower = filters.query.toLowerCase();
    result = result.filter(
      (j) =>
        j.title?.toLowerCase().includes(qLower) ||
        j.prompt.toLowerCase().includes(qLower)
    );
  }

  return result;
}

export async function getVideoJob(id: string): Promise<VideoJob | null> {
  const { data, error } = await db
    .from("vx_video_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateVideoJob(
  id: string,
  patch: Partial<Pick<VideoJob, "title" | "is_favorite" | "is_archived">>
): Promise<void> {
  const { error } = await db
    .from("vx_video_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getSignedVideoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await (supabase as any).storage
    .from("video-outputs")
    .createSignedUrl(storagePath, 3600); // 1 hour
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── Video Templates ───────────────────────────────────────────────────────────

export async function listTemplates(): Promise<VideoTemplate[]> {
  const { data, error } = await db
    .from("vx_video_templates")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("use_count", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(input: Omit<VideoTemplate, "id" | "user_id" | "use_count" | "created_at" | "updated_at">): Promise<VideoTemplate> {
  const { data, error } = await db
    .from("vx_video_templates")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, patch: Partial<VideoTemplate>): Promise<void> {
  const { error } = await db
    .from("vx_video_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await db.from("vx_video_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function useTemplate(id: string): Promise<void> {
  await db.rpc("vx_use_template", { p_template_id: id });
}
