// ─── Library — AI Personal Librarian: Personal Profile ────────────────────
// Aggregates counts/lists across many EXISTING tables (reading progress,
// bookmarks/notes/highlights, favorites, reader profile, certificates,
// academy enrollments, research projects) plus the new library_skills /
// library_librarian_goals / library_favorite_topics tables. Deliberately a
// set of small parallel queries (composed by useLibrarianProfile), not one
// giant SQL aggregator RPC — matches this app's established service style.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryReadingHistoryCounts {
  completedCount: number;
  incompleteCount: number;
  listeningCount: number;
}

export async function fetchReadingHistoryCounts(userId: string): Promise<LibraryReadingHistoryCounts> {
  const [completed, incomplete] = await Promise.all([
    supabase.from("library_reading_progress").select("*", { count: "exact", head: true }).eq("user_id", userId).not("completed_at", "is", null),
    supabase.from("library_reading_progress").select("*", { count: "exact", head: true }).eq("user_id", userId).is("completed_at", null),
  ]);
  if (completed.error) throw new Error(completed.error.message);
  if (incomplete.error) throw new Error(incomplete.error.message);
  const { data: listeningStats, error: listeningErr } = await supabase
    .from("library_listening_daily_stats").select("seconds_listened").eq("user_id", userId);
  if (listeningErr) throw new Error(listeningErr.message);
  return {
    completedCount: completed.count ?? 0,
    incompleteCount: incomplete.count ?? 0,
    listeningCount: (listeningStats ?? []).filter((r) => r.seconds_listened > 0).length,
  };
}

export interface LibraryEngagementCounts {
  bookmarksCount: number;
  highlightsCount: number;
  notesCount: number;
}

export async function fetchEngagementCounts(userId: string): Promise<LibraryEngagementCounts> {
  const [bookmarks, highlights, notes] = await Promise.all([
    supabase.from("library_bookmarks").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("library_highlights").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("library_notes").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (bookmarks.error) throw new Error(bookmarks.error.message);
  if (highlights.error) throw new Error(highlights.error.message);
  if (notes.error) throw new Error(notes.error.message);
  return { bookmarksCount: bookmarks.count ?? 0, highlightsCount: highlights.count ?? 0, notesCount: notes.count ?? 0 };
}

export interface LibraryFavoritesSnapshot {
  favoriteGenres: { id: string; name: string }[];
  favoriteAuthors: { id: string; name: string }[];
  languages: string[];
}

export async function fetchFavoritesSnapshot(userId: string): Promise<LibraryFavoritesSnapshot> {
  const { data, error } = await supabase
    .from("library_reader_profiles").select("favorite_genres, favorite_authors, languages").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const genreIds: string[] = data?.favorite_genres ?? [];
  const authorIds: string[] = data?.favorite_authors ?? [];
  const [genres, authors] = await Promise.all([
    genreIds.length > 0 ? supabase.from("library_categories").select("id, name").in("id", genreIds) : Promise.resolve({ data: [], error: null }),
    authorIds.length > 0 ? supabase.from("library_authors").select("id, name").in("id", authorIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (genres.error) throw new Error(genres.error.message);
  if (authors.error) throw new Error(authors.error.message);
  return {
    favoriteGenres: (genres.data ?? []) as { id: string; name: string }[],
    favoriteAuthors: (authors.data ?? []) as { id: string; name: string }[],
    languages: data?.languages ?? [],
  };
}

export interface LibraryFavoriteTopicRow {
  entity_id: string;
  name: string;
  entity_type: string;
  slug: string;
}

export async function fetchFavoriteTopics(userId: string): Promise<LibraryFavoriteTopicRow[]> {
  const { data, error } = await supabase
    .from("library_favorite_topics")
    .select("entity_id, library_kg_entities(name, entity_type, slug)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ entity_id: string; library_kg_entities: { name: string; entity_type: string; slug: string } | null }>)
    .filter((r) => r.library_kg_entities)
    .map((r) => ({ entity_id: r.entity_id, name: r.library_kg_entities!.name, entity_type: r.library_kg_entities!.entity_type, slug: r.library_kg_entities!.slug }));
}

export async function addFavoriteTopic(userId: string, entityId: string): Promise<void> {
  const { error } = await supabase.from("library_favorite_topics").insert({ user_id: userId, entity_id: entityId });
  if (error) throw new Error(error.message);
}

export async function removeFavoriteTopic(userId: string, entityId: string): Promise<void> {
  const { error } = await supabase.from("library_favorite_topics").delete().eq("user_id", userId).eq("entity_id", entityId);
  if (error) throw new Error(error.message);
}

export interface LibraryCourseProgressRow {
  course_id: string;
  title: string;
  progress_percent: number;
  completed_at: string | null;
}

export async function fetchCourseProgress(userId: string): Promise<LibraryCourseProgressRow[]> {
  const { data, error } = await supabase
    .from("academy_enrollments")
    .select("course_id, progress_percent, completed_at, academy_courses(title)")
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ course_id: string; progress_percent: number; completed_at: string | null; academy_courses: { title: string } | null }>)
    .map((r) => ({ course_id: r.course_id, title: r.academy_courses?.title ?? "", progress_percent: r.progress_percent, completed_at: r.completed_at }));
}

export interface LibraryCertificateSummaryRow {
  id: string;
  certificate_type: string;
  title: string;
  issued_at: string;
}

export async function fetchCertificateSummaries(userId: string): Promise<LibraryCertificateSummaryRow[]> {
  const { data, error } = await supabase
    .from("library_certificates").select("id, certificate_type, title, issued_at")
    .eq("user_id", userId).order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCertificateSummaryRow[];
}

export interface LibraryResearchProjectSummaryRow {
  id: string;
  title: string;
}

export async function fetchResearchProjectSummaries(userId: string): Promise<LibraryResearchProjectSummaryRow[]> {
  const { data, error } = await supabase
    .from("library_research_projects")
    .select("id, title, library_research_project_members!inner(user_id)")
    .eq("library_research_project_members.user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; title: string }>).map((r) => ({ id: r.id, title: r.title }));
}
