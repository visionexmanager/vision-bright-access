// ─── Library — Knowledge & Research Platform: Research Workspace ───────────
// Projects, items (polymorphic: book/note/highlight/reference/saved_search/
// analysis), members (collaboration), comments, and version snapshots.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryResearchProjectRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchResearchProjects(userId: string): Promise<LibraryResearchProjectRow[]> {
  const { data, error } = await supabase
    .from("library_research_projects")
    .select("*, library_research_project_members!inner(user_id)")
    .eq("library_research_project_members.user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryResearchProjectRow[];
}

export async function fetchResearchProject(id: string): Promise<LibraryResearchProjectRow | null> {
  const { data, error } = await supabase.from("library_research_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryResearchProjectRow | null;
}

export async function createResearchProject(ownerId: string, title: string, description?: string): Promise<LibraryResearchProjectRow> {
  const { data, error } = await supabase
    .from("library_research_projects")
    .insert({ owner_id: ownerId, title, description: description || null })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryResearchProjectRow;
}

export async function updateResearchProject(id: string, patch: { title?: string; description?: string | null }): Promise<void> {
  const { error } = await supabase.from("library_research_projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteResearchProject(id: string): Promise<void> {
  const { error } = await supabase.from("library_research_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface LibraryResearchProjectMemberRow {
  project_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  added_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

// `library_research_project_members.user_id` FKs auth.users, not public.profiles
// (a sibling table), so PostgREST can't auto-embed profiles — fetch + merge instead.
export async function fetchProjectMembers(projectId: string): Promise<LibraryResearchProjectMemberRow[]> {
  const { data: members, error } = await supabase
    .from("library_research_project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return (members ?? []).map((m) => ({
    ...m,
    display_name: profileById.get(m.user_id)?.display_name ?? null,
    avatar_url: profileById.get(m.user_id)?.avatar_url ?? null,
  })) as LibraryResearchProjectMemberRow[];
}

export async function inviteToProject(projectId: string, email: string, role: "editor" | "viewer"): Promise<boolean> {
  const { data, error } = await supabase.rpc("invite_to_library_research_project", { _project_id: projectId, _email: email, _role: role });
  if (error) throw new Error(error.message);
  return data as boolean;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_research_project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export type LibraryResearchItemType = "book" | "note" | "highlight" | "reference" | "saved_search" | "analysis";

export interface LibraryResearchProjectItemRow {
  id: string;
  project_id: string;
  item_type: LibraryResearchItemType;
  book_id: string | null;
  note_id: string | null;
  highlight_id: string | null;
  saved_search_id: string | null;
  analysis_id: string | null;
  citation_text: string | null;
  added_by: string;
  added_at: string;
  library_books: { title: string; slug: string; cover_image_url: string | null } | null;
  library_notes: { content: string } | null;
  library_highlights: { quoted_text: string } | null;
  library_saved_searches: { name: string; query: string } | null;
  library_research_analyses: { title: string } | null;
}

export async function fetchProjectItems(projectId: string): Promise<LibraryResearchProjectItemRow[]> {
  const { data, error } = await supabase
    .from("library_research_project_items")
    .select(`*,
      library_books(title, slug, cover_image_url),
      library_notes(content),
      library_highlights(quoted_text),
      library_saved_searches(name, query),
      library_research_analyses(title)`)
    .eq("project_id", projectId)
    .order("added_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryResearchProjectItemRow[];
}

export interface AddProjectItemInput {
  itemType: LibraryResearchItemType;
  bookId?: string;
  noteId?: string;
  highlightId?: string;
  savedSearchId?: string;
  analysisId?: string;
  citationText?: string;
}

export async function addProjectItem(projectId: string, addedBy: string, input: AddProjectItemInput): Promise<void> {
  const { error } = await supabase.from("library_research_project_items").insert({
    project_id: projectId,
    item_type: input.itemType,
    book_id: input.bookId ?? null,
    note_id: input.noteId ?? null,
    highlight_id: input.highlightId ?? null,
    saved_search_id: input.savedSearchId ?? null,
    analysis_id: input.analysisId ?? null,
    citation_text: input.citationText ?? null,
    added_by: addedBy,
  });
  if (error) throw new Error(error.message);
}

export async function removeProjectItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("library_research_project_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export interface LibraryResearchProjectCommentRow {
  id: string;
  project_id: string;
  item_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

export async function fetchProjectComments(projectId: string): Promise<LibraryResearchProjectCommentRow[]> {
  const { data: comments, error } = await supabase
    .from("library_research_project_comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  if (authorIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", authorIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return (comments ?? []).map((c) => ({
    ...c,
    display_name: profileById.get(c.author_id)?.display_name ?? null,
    avatar_url: profileById.get(c.author_id)?.avatar_url ?? null,
  })) as LibraryResearchProjectCommentRow[];
}

export async function addProjectComment(projectId: string, authorId: string, body: string, itemId?: string): Promise<void> {
  const { error } = await supabase.from("library_research_project_comments").insert({ project_id: projectId, author_id: authorId, body, item_id: itemId ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteProjectComment(id: string): Promise<void> {
  const { error } = await supabase.from("library_research_project_comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface LibraryResearchProjectVersionRow {
  id: string;
  project_id: string;
  snapshot: unknown;
  note: string | null;
  created_by: string;
  created_at: string;
}

export async function fetchProjectVersions(projectId: string): Promise<LibraryResearchProjectVersionRow[]> {
  const { data, error } = await supabase
    .from("library_research_project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryResearchProjectVersionRow[];
}

export async function snapshotProject(projectId: string, note?: string): Promise<string> {
  const { data, error } = await supabase.rpc("snapshot_library_research_project", { _project_id: projectId, _note: note ?? null });
  if (error) throw new Error(error.message);
  return data as string;
}
