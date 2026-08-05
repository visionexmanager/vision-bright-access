// ─── Library — Learning Hub: Learning Paths ────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type {
  LibraryLearningPathRow, LibraryLearningPathItemRow, LibraryLearningPathEnrollmentRow,
  LibraryLearningPathProgressItem, LibraryLearningPathLevel, LibraryLearningPathItemType,
} from "@/lib/types/library-learning";

export async function fetchPublishedLearningPaths(): Promise<LibraryLearningPathRow[]> {
  const { data, error } = await supabase
    .from("library_learning_paths").select("*")
    .eq("is_published", true).eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLearningPathRow[];
}

export async function fetchMyCreatedLearningPaths(userId: string): Promise<LibraryLearningPathRow[]> {
  const { data, error } = await supabase
    .from("library_learning_paths").select("*").eq("created_by", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLearningPathRow[];
}

export async function fetchLearningPathBySlug(slug: string): Promise<LibraryLearningPathRow | null> {
  const { data, error } = await supabase.from("library_learning_paths").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathRow | null;
}

export async function fetchLearningPathById(pathId: string): Promise<LibraryLearningPathRow | null> {
  const { data, error } = await supabase.from("library_learning_paths").select("*").eq("id", pathId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathRow | null;
}

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || crypto.randomUUID().slice(0, 8);
}

export interface LearningPathInput {
  title: string;
  /** Derived from the title when omitted — see createLearningPath. */
  slug?: string;
  description?: string | null;
  cover_image_url?: string | null;
  level: LibraryLearningPathLevel;
  is_adaptive?: boolean;
  is_certification_track?: boolean;
  estimated_minutes?: number | null;
  is_published?: boolean;
}

export async function createLearningPath(userId: string, input: LearningPathInput): Promise<LibraryLearningPathRow> {
  // library_learning_paths.slug is NOT NULL UNIQUE, and the create dialog does
  // not collect one — the insert was going out without it and failing on the
  // null. Derive it from the title with a random suffix, the same shape
  // createClub uses for library_clubs.
  const slug = input.slug ?? `${slugify(input.title)}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase
    .from("library_learning_paths")
    .insert({ ...input, slug, created_by: userId })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathRow;
}

export async function updateLearningPath(pathId: string, input: Partial<LearningPathInput>): Promise<void> {
  const { error } = await supabase.from("library_learning_paths").update(input).eq("id", pathId);
  if (error) throw new Error(error.message);
}

export async function deleteLearningPath(pathId: string): Promise<void> {
  const { error } = await supabase.from("library_learning_paths").delete().eq("id", pathId);
  if (error) throw new Error(error.message);
}

export async function fetchLearningPathItems(pathId: string): Promise<LibraryLearningPathItemRow[]> {
  const { data, error } = await supabase
    .from("library_learning_path_items").select("*").eq("path_id", pathId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLearningPathItemRow[];
}

export interface LearningPathItemInput {
  item_type: LibraryLearningPathItemType;
  book_id?: string | null;
  academy_course_id?: string | null;
  quiz_id?: string | null;
  title_override?: string | null;
  order_index: number;
  is_required?: boolean;
  estimated_minutes?: number | null;
  is_remedial?: boolean;
  remedial_for_item_id?: string | null;
  remedial_threshold_percent?: number;
}

export async function addLearningPathItem(pathId: string, input: LearningPathItemInput): Promise<LibraryLearningPathItemRow> {
  const { data, error } = await supabase
    .from("library_learning_path_items").insert({ ...input, path_id: pathId }).select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathItemRow;
}

export async function removeLearningPathItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("library_learning_path_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function addLearningPathPrerequisite(pathId: string, prerequisitePathId: string): Promise<void> {
  const { error } = await supabase
    .from("library_learning_path_prerequisites")
    .insert({ path_id: pathId, prerequisite_path_id: prerequisitePathId });
  if (error) throw new Error(error.message);
}

export async function removeLearningPathPrerequisite(pathId: string, prerequisitePathId: string): Promise<void> {
  const { error } = await supabase
    .from("library_learning_path_prerequisites").delete()
    .eq("path_id", pathId).eq("prerequisite_path_id", prerequisitePathId);
  if (error) throw new Error(error.message);
}

export async function fetchLearningPathPrerequisites(pathId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("library_learning_path_prerequisites").select("prerequisite_path_id").eq("path_id", pathId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.prerequisite_path_id as string);
}

export async function fetchMyLearningPathEnrollment(userId: string, pathId: string): Promise<LibraryLearningPathEnrollmentRow | null> {
  const { data, error } = await supabase
    .from("library_learning_path_enrollments").select("*")
    .eq("user_id", userId).eq("path_id", pathId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathEnrollmentRow | null;
}

export async function fetchMyLearningPathEnrollments(userId: string): Promise<LibraryLearningPathEnrollmentRow[]> {
  const { data, error } = await supabase
    .from("library_learning_path_enrollments").select("*").eq("user_id", userId).order("enrolled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLearningPathEnrollmentRow[];
}

export async function enrollInLearningPath(pathId: string): Promise<LibraryLearningPathEnrollmentRow> {
  const { data, error } = await supabase.rpc("enroll_in_library_learning_path", { _path_id: pathId });
  if (error) throw new Error(error.message);
  return data as LibraryLearningPathEnrollmentRow;
}

export async function fetchLearningPathProgress(pathId: string): Promise<LibraryLearningPathProgressItem[]> {
  const { data, error } = await supabase.rpc("get_library_learning_path_progress", { _path_id: pathId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLearningPathProgressItem[];
}

export async function completeLearningPathItem(itemId: string, scorePercent?: number | null): Promise<void> {
  const { error } = await supabase.rpc("complete_library_learning_path_item", { _item_id: itemId, _score_percent: scorePercent ?? null });
  if (error) throw new Error(error.message);
}
