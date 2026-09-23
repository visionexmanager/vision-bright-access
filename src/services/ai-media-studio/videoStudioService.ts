// Video Studio — service layer (pure async, no React)
import { supabase } from "@/integrations/supabase/client";
import { jsonAs } from "@/integrations/supabase/json";
import type {
  VideoJob,
  VideoTemplate,
  VideoLibraryFilters,
} from "@/lib/types/video-studio";

// Every vx_video_jobs column the browser may read, except provider_job_id —
// the vendor's own tracking id, which has no product purpose here and no
// component reads it. _shared/providers/compute.ts's ComputeJob already
// keeps this out of the RunPod path by design; these two queries are the
// pre-existing Luma/OpenAI path catching up to that same rule.
const VIDEO_JOB_COLUMNS = [
  "id", "user_id", "project_id", "asset_id",
  "title", "prompt", "negative_prompt", "style", "duration_sec",
  "aspect_ratio", "resolution", "fps", "camera_motion", "creativity", "seed",
  "audio_asset_id", "audio_mode", "template_id",
  "provider", "provider_model",
  "video_url", "storage_path", "thumbnail_url", "thumbnail_path",
  "duration_actual_sec", "file_size_bytes", "width", "height",
  "status", "progress", "error_message", "retry_count", "generation_time_ms",
  "is_favorite", "is_archived",
  "created_at", "updated_at", "started_at", "completed_at", "estimated_complete",
].join(", ");
async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

// ── Video Jobs ────────────────────────────────────────────────────────────────

export async function listVideoJobs(filters: VideoLibraryFilters = {}): Promise<VideoJob[]> {
  let q = supabase.from("vx_video_jobs").select(VIDEO_JOB_COLUMNS);

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

  let result: VideoJob[] = jsonAs<VideoJob[]>(data ?? []);
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
  const { data, error } = await supabase
    .from("vx_video_jobs")
    .select(VIDEO_JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return jsonAs<VideoJob | null>(data);
}

export async function updateVideoJob(
  id: string,
  patch: Partial<Pick<VideoJob, "title" | "is_favorite" | "is_archived">>
): Promise<void> {
  const { error } = await supabase
    .from("vx_video_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getSignedVideoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("video-outputs")
    .createSignedUrl(storagePath, 3600); // 1 hour
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── Video Templates ───────────────────────────────────────────────────────────

export async function listTemplates(): Promise<VideoTemplate[]> {
  const { data, error } = await supabase
    .from("vx_video_templates")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("use_count", { ascending: false });
  if (error) throw error;
  return jsonAs<VideoTemplate[]>(data ?? []);
}

export async function createTemplate(input: Omit<VideoTemplate, "id" | "user_id" | "use_count" | "created_at" | "updated_at">): Promise<VideoTemplate> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("vx_video_templates")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return jsonAs<VideoTemplate>(data);
}

export async function updateTemplate(id: string, patch: Partial<VideoTemplate>): Promise<void> {
  const { error } = await supabase
    .from("vx_video_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("vx_video_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function useTemplate(id: string): Promise<void> {
  await supabase.rpc("vx_use_template", { p_template_id: id });
}
