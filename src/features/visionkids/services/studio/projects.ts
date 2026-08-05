import { kidsDb, jsonPayload } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Database } from "@/integrations/supabase/types";
import type { CreativeProject, ProjectVersion, ProjectType } from "@/features/visionkids/types/studio.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchMyProjects(projectType?: ProjectType): Promise<CreativeProject[]> {
  let query = kidsDb.from("kids_creative_projects").select("*").order("updated_at", { ascending: false });
  if (projectType) query = query.eq("project_type", projectType);
  const { data, error } = await query.returns<CreativeProject[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectById(id: string): Promise<CreativeProject | null> {
  const { data, error } = await kidsDb.from("kids_creative_projects").select("*").eq("id", id).maybeSingle().returns<CreativeProject>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchPublicGallery(projectType?: ProjectType, limit = 30): Promise<CreativeProject[]> {
  let query = kidsDb.from("kids_creative_projects").select("*").eq("is_public", true).eq("status", "published").order("updated_at", { ascending: false }).limit(limit);
  if (projectType) query = query.eq("project_type", projectType);
  const { data, error } = await query.returns<CreativeProject[]>();
  if (error) throw error;
  return data ?? [];
}

export interface CreateProjectInput {
  projectType: ProjectType;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  content: object;
  assetUrls?: string[];
}

export async function createProject(input: CreateProjectInput): Promise<CreativeProject> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_creative_projects")
    .insert({
      user_id, project_type: input.projectType, title: input.title || "Untitled",
      description: input.description ?? null, thumbnail_url: input.thumbnailUrl ?? null,
      content: jsonPayload(input.content), asset_urls: input.assetUrls ?? [],
    })
    .select("*").single().returns<CreativeProject>();
  if (error) throw error;
  return data;
}

export interface SaveProjectInput {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  content?: object;
  assetUrls?: string[];
  saveVersion?: boolean;
}

/** Updates the project and (by default) snapshots a version row for
 *  "Version History" — auto-save on every meaningful edit. */
export async function saveProject(input: SaveProjectInput): Promise<void> {
  // Typed as the table's Update rather than an open record: only the keys
  // this builds up are sent, and a name that is not a column is caught here
  // instead of by postgrest.
  const update: Database["public"]["Tables"]["kids_creative_projects"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) update.title = input.title;
  if (input.thumbnailUrl !== undefined) update.thumbnail_url = input.thumbnailUrl;
  if (input.content !== undefined) update.content = jsonPayload(input.content);
  if (input.assetUrls !== undefined) update.asset_urls = input.assetUrls;

  const { error } = await kidsDb.from("kids_creative_projects").update(update).eq("id", input.id);
  if (error) throw error;

  if (input.saveVersion !== false && input.content !== undefined) {
    await kidsDb.from("kids_creative_project_versions").insert({ project_id: input.id, content: jsonPayload(input.content) });
  }
}

export async function fetchProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const { data, error } = await kidsDb
    .from("kids_creative_project_versions").select("*").eq("project_id", projectId).order("saved_at", { ascending: false })
    .returns<ProjectVersion[]>();
  if (error) throw error;
  return data ?? [];
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_creative_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function setProjectPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await kidsDb.from("kids_creative_projects").update({ is_public: isPublic, status: isPublic ? "published" : "draft" }).eq("id", id);
  if (error) throw error;
}

export async function uploadStudioAsset(file: Blob, projectId: string, filename: string): Promise<string> {
  const user_id = await requireUserId();
  const path = `${user_id}/${projectId}/${Date.now()}-${filename}`;
  const { error } = await kidsDb.storage.from("kids-studio-media").upload(path, file);
  if (error) throw error;
  const { data } = kidsDb.storage.from("kids-studio-media").getPublicUrl(path);
  return data.publicUrl;
}
