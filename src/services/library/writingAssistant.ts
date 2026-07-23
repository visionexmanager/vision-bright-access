// ─── Library — AI Writing Assistant Service (Phase 9) ─────────────────────
// Thin wrapper around the library-ai-writing-assistant edge function —
// author-side AI (grammar/rewrite/generate/etc.), distinct from
// services/library/aiAssistant.ts (the reader-side Reading Assistant),
// since authorization differs fundamentally (owner/collaborator, never
// "has this reader purchased the book").

import { supabase } from "@/integrations/supabase/client";

export type LibraryWritingAiMode =
  | "grammar-correction"
  | "rewrite"
  | "expand"
  | "shorten"
  | "translate"
  | "generate-chapters"
  | "generate-titles"
  | "generate-descriptions"
  | "generate-keywords"
  | "generate-cover-ideas"
  | "writing-style-suggestions"
  | "character-builder"
  | "story-ideas"
  | "academic-assistant"
  | "citation-suggestions";

export interface GrammarChange {
  original: string;
  corrected: string;
  reason: string;
}
export interface GeneratedChapterOutline {
  title: string;
  summary: string;
}
export interface GeneratedCharacter {
  name: string;
  role: string;
  description: string;
  traits: string[];
}
export interface GeneratedStoryIdea {
  title: string;
  logline: string;
}
export interface CoverIdea {
  prompt: string;
  rationale: string;
}
export interface Citation {
  style: "APA" | "MLA";
  text: string;
}

export type LibraryWritingAiResult =
  | { mode: "grammar-correction"; result: { corrected_text: string; changes: GrammarChange[] } }
  | { mode: "rewrite" | "expand" | "shorten"; result: { result_text: string } }
  | { mode: "translate"; result: { translated_text: string } }
  | { mode: "generate-chapters"; result: { chapters: GeneratedChapterOutline[] } }
  | { mode: "generate-titles"; result: { titles: string[] } }
  | { mode: "generate-descriptions"; result: { short_description: string; long_description: string } }
  | { mode: "generate-keywords"; result: { keywords: string[] } }
  | { mode: "generate-cover-ideas"; result: { prompts: CoverIdea[] } }
  | { mode: "writing-style-suggestions"; result: { suggestions: string[] } }
  | { mode: "character-builder"; result: { characters: GeneratedCharacter[] } }
  | { mode: "story-ideas"; result: { ideas: GeneratedStoryIdea[] } }
  | { mode: "academic-assistant"; result: { answer: string; notes: string } }
  | { mode: "citation-suggestions"; result: { citations: Citation[] } };

export interface LibraryWritingAiRequest {
  mode: LibraryWritingAiMode;
  book_id?: string;
  text?: string;
  targetLanguage?: string;
  instruction?: string;
  /** generate-chapters/titles/descriptions/keywords/cover-ideas/character-
   *  builder/story-ideas: freeform premise/outline/genre input. */
  prompt?: string;
  genre?: string;
  theme?: string;
}

export async function runLibraryWritingAssistant(req: LibraryWritingAiRequest): Promise<LibraryWritingAiResult> {
  const { data, error } = await supabase.functions.invoke("library-ai-writing-assistant", { body: req });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryWritingAiResult;
}
