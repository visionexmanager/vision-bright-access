// ─── Library — AI Reading Assistant Service (Phase 5, extended Phase 6.5) ──
// Thin wrapper around the library-ai-assistant edge function. "Suggest
// similar books" is deliberately NOT a mode here — it's real DB data via
// fetchSimilarBooks (services/library/catalog.ts), not an LLM call; see
// that edge function's header comment for why.
//
// Phase 6.5: every content-bearing mode is now RAG-backed server-side
// (retrieval instead of whole-book concatenation) — this file's contract
// is unchanged for existing modes, only new modes/fields were added.

import { supabase } from "@/integrations/supabase/client";
import type {
  SmartSummaryResult, TimelineResult, CharacterExplorerResult, ConceptsExplorerResult,
  ExplainWordResult, ImageDescriptionResult, ReadingCoachTipsResult, KeyLessonsResult, AiReadingMode,
  LibraryCitation,
} from "@/lib/types/library-ai";

export type LibraryAiMode =
  | "summarize-book"
  | "summarize-chapter"
  | "key-ideas"
  | "flashcards"
  | "quiz"
  | "mind-map"
  | "answer-question"
  | "explain-paragraph"
  | "explain-word"
  | "translate-paragraph"
  // ── Phase 6.5 ────────────────────────────────────────────────────────
  | "smart-summary"
  | "timeline"
  | "character-explorer"
  | "concepts-explorer"
  | "image-description"
  | "reading-coach-tips"
  // ── Phase 8 ──────────────────────────────────────────────────────────
  | "key-lessons";

export interface LibraryAiFlashcard {
  front: string;
  back: string;
}

export interface LibraryAiQuizQuestion {
  type: "multiple-choice" | "true-false" | "fill-blank" | "short-answer";
  question: string;
  options: string[];
  correct_index: number;
  expected_answer: string;
  explanation: string;
}

export interface LibraryAiMindMapBranch {
  topic: string;
  subtopics: string[];
}

/** Discriminated by `mode` so callers get the exact result shape for that
 *  mode without a manual type assertion. */
export type LibraryAiResult =
  | { mode: "summarize-book" | "summarize-chapter"; result: { summary: string } }
  | { mode: "key-ideas"; result: { key_ideas: string[] } }
  | { mode: "flashcards"; result: { flashcards: LibraryAiFlashcard[] } }
  | { mode: "quiz"; result: { questions: LibraryAiQuizQuestion[] } }
  | { mode: "mind-map"; result: { central_topic: string; branches: LibraryAiMindMapBranch[] } }
  | { mode: "answer-question"; result: { answer: string; alternative_interpretation: string; follow_up_questions: string[]; citations?: LibraryCitation[] } }
  | { mode: "explain-paragraph"; result: { explanation: string } }
  | { mode: "explain-word"; result: ExplainWordResult }
  | { mode: "translate-paragraph"; result: { translated_text: string } }
  | { mode: "smart-summary"; result: SmartSummaryResult }
  | { mode: "timeline"; result: TimelineResult }
  | { mode: "character-explorer"; result: CharacterExplorerResult }
  | { mode: "concepts-explorer"; result: ConceptsExplorerResult }
  | { mode: "image-description"; result: ImageDescriptionResult }
  | { mode: "reading-coach-tips"; result: ReadingCoachTipsResult }
  | { mode: "key-lessons"; result: KeyLessonsResult };

export interface LibraryAiRequest {
  mode: LibraryAiMode;
  book_id?: string;
  chapter_id?: string;
  text?: string;
  question?: string;
  targetLanguage?: string;
  /** smart-summary only. */
  scope?: "page" | "chapter" | "book";
  length?: "quick" | "medium" | "detailed";
  /** image-description only — a data: URL or https URL. */
  image?: string;
  /** explain-paragraph only — which transformation to apply (Explain
   *  Selection's quick-action list). Defaults to "explain". */
  instruction?: "explain" | "simplify" | "rephrase" | "example" | "extract-ideas" | "rewrite" | "expand" | "shorten";
  /** Phase 8 — reading-level style, attached automatically by
   *  useLibraryAiAssistant/useLibraryAiChat/useSmartSummary from
   *  useAiReadingPreferences; callers don't need to set this themselves. */
  readingMode?: AiReadingMode;
}

export async function runLibraryAiAssistant(req: LibraryAiRequest): Promise<LibraryAiResult> {
  const { data, error } = await supabase.functions.invoke("library-ai-assistant", { body: req });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryAiResult;
}
