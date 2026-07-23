// ─── Library — Knowledge & Research Platform: Research Assistant ───────────
// Multi-book/multi-author AI analysis modes, backed by the library-research-assistant
// edge function. Consolidates "Research Assistant" and "Multi-Source Analysis" —
// compare_books' rendered output IS the multi-source comparison view.

import { supabase } from "@/integrations/supabase/client";

export type LibraryResearchMode =
  | "summarize_multiple" | "compare_books" | "compare_authors"
  | "literature_review" | "research_outline" | "suggest_references" | "knowledge_gaps";

export interface LibraryResearchRequest {
  mode: LibraryResearchMode;
  book_ids?: string[];
  author_ids?: string[];
  topic?: string;
  title?: string;
}

export interface LibrarySummarizeMultipleResult {
  summary: string;
  per_source_highlights: { book_title: string; highlight: string }[];
}
export interface LibraryCompareBooksResult {
  common_themes: string[];
  agreements: string[];
  contradictions: string[];
  overall_comparison: string;
}
export interface LibraryCompareAuthorsResult {
  authors: { author_name: string; style_summary: string; recurring_themes: string[] }[];
  overall_comparison: string;
}
export interface LibraryLiteratureReviewResult {
  introduction: string;
  thematic_sections: { heading: string; content: string }[];
  conclusion: string;
}
export interface LibraryResearchOutlineResult {
  working_title: string;
  sections: { heading: string; sub_points: string[] }[];
}
export interface LibraryKnowledgeGapsResult {
  covered_topics: string[];
  gaps: { gap: string; why_it_matters: string }[];
}
export interface LibrarySuggestReferencesResult {
  references: { id: string; title: string; author_id: string; published_date: string | null; library_authors: { name: string } | null }[];
}

export type LibraryResearchResult =
  | LibrarySummarizeMultipleResult | LibraryCompareBooksResult | LibraryCompareAuthorsResult
  | LibraryLiteratureReviewResult | LibraryResearchOutlineResult | LibraryKnowledgeGapsResult
  | LibrarySuggestReferencesResult;

export interface LibraryResearchResponse {
  ok: boolean;
  analysis_id: string | null;
  result: LibraryResearchResult;
}

export async function runResearchAssistant(request: LibraryResearchRequest): Promise<LibraryResearchResponse> {
  const { data, error } = await supabase.functions.invoke("library-research-assistant", { body: request });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as LibraryResearchResponse;
}

export interface LibraryResearchAnalysisRow {
  id: string;
  user_id: string;
  analysis_type: Exclude<LibraryResearchMode, "suggest_references">;
  title: string;
  topic: string | null;
  book_ids: string[] | null;
  author_ids: string[] | null;
  result: LibraryResearchResult;
  created_at: string;
}

export async function fetchResearchAnalyses(userId: string): Promise<LibraryResearchAnalysisRow[]> {
  const { data, error } = await supabase
    .from("library_research_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryResearchAnalysisRow[];
}

export async function fetchResearchAnalysis(id: string): Promise<LibraryResearchAnalysisRow | null> {
  const { data, error } = await supabase.from("library_research_analyses").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as LibraryResearchAnalysisRow | null;
}

export async function deleteResearchAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from("library_research_analyses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
