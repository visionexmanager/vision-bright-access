import { kidsDb, jsonPayload } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ProjectKind, StemProject } from "@/features/visionkids/types/stem.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

/** The caller's own projects (Portfolio). Optionally filtered by kind. */
export async function fetchMyProjects(kind?: ProjectKind): Promise<StemProject[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  let query = kidsDb.from("kids_stem_projects").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.returns<StemProject[]>();
  if (error) throw error;
  return data ?? [];
}

/** Public, published projects for the Inventor Gallery. */
export async function fetchGalleryProjects(kind?: ProjectKind): Promise<StemProject[]> {
  let query = kidsDb
    .from("kids_stem_projects").select("*")
    .eq("is_public", true).eq("status", "published")
    .order("created_at", { ascending: false }).limit(60);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.returns<StemProject[]>();
  if (error) throw error;
  return data ?? [];
}

export interface SaveProjectInput {
  kind: Exclude<ProjectKind, "invention">;
  title: string;
  description?: string;
  lab?: string;
  emoji?: string;
  data: Record<string, unknown>;
  isPublic?: boolean;
}

/** Save a robot / design / experiment project via the reward-guarded RPC. */
export async function saveProject(input: SaveProjectInput): Promise<string> {
  const { data, error } = await kidsDb.rpc("save_kids_project", {
    _kind: input.kind,
    _title: input.title,
    _description: input.description ?? null,
    _lab: input.lab ?? null,
    _emoji: input.emoji ?? null,
    _data: jsonPayload(input.data),
    _is_public: input.isPublic ?? false,
  });
  if (error) throw error;
  return data as string;
}

export interface SubmitInnovationInput {
  challengeId: string;
  title: string;
  description?: string;
  data: Record<string, unknown>;
  isPublic?: boolean;
}

/** Submit an Innovation Challenge solution (creates an 'invention' project). */
export async function submitInnovation(input: SubmitInnovationInput): Promise<string> {
  const { data, error } = await kidsDb.rpc("submit_kids_innovation", {
    _challenge_id: input.challengeId,
    _title: input.title,
    _description: input.description ?? null,
    _data: jsonPayload(input.data),
    _is_public: input.isPublic ?? true,
  });
  if (error) throw error;
  return data as string;
}

export async function toggleProjectLike(projectId: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await kidsDb.rpc("toggle_kids_project_like", { _project_id: projectId });
  if (error) throw error;
  return data as { liked: boolean; likes: number };
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_stem_projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function setProjectVisibility(projectId: string, isPublic: boolean): Promise<void> {
  const { error } = await kidsDb
    .from("kids_stem_projects")
    .update({ is_public: isPublic, status: isPublic ? "published" : "draft", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

/** Which of the caller's likes exist among the given project ids. */
export async function fetchMyLikedIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_project_likes").select("project_id").eq("user_id", userId)
    .returns<{ project_id: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.project_id);
}
