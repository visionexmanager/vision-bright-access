/**
 * Library — AI Reading Assistant types (Phase 6.5)
 *
 * Mirrors the new Phase 6.5 tables/RPC results — see
 * supabase/migrations/20260725000000_library_ai_reading_assistant.sql and
 * supabase/functions/library-ai-assistant/index.ts's MODE_SCHEMAS.
 */

export interface SmartSummaryResult {
  summary: string;
  cached: boolean;
}

export interface TimelineEvent {
  order: number;
  date_or_period: string;
  title: string;
  description: string;
  chapter_reference: string;
}
export interface TimelineResult {
  applicable: boolean;
  events: TimelineEvent[];
}

export interface CharacterRelationship {
  with: string;
  type: string;
}
export interface CharacterEntry {
  name: string;
  description: string;
  relationships: CharacterRelationship[];
  appears_in: string[];
  development: string;
}
export interface CharacterExplorerResult {
  applicable: boolean;
  characters: CharacterEntry[];
}

export interface ConceptEntry {
  term: string;
  definition: string;
  category: string;
}
export interface ConceptsExplorerResult {
  concepts: ConceptEntry[];
}

/** Phase 8 — distinct from key-ideas ("main ideas"): framed as practical,
 *  actionable takeaways rather than a restatement of the book's arguments. */
export interface KeyLessonsResult {
  lessons: string[];
}

/** Phase 8 — reading-level style applied to every AI call's system prompt.
 *  Mirrors library-ai-assistant/index.ts's MODE_STYLE_INSTRUCTIONS keys and
 *  library_ai_preferences.reading_mode's CHECK constraint exactly. */
export type AiReadingMode = "beginner" | "student" | "professional" | "child" | "simple_language" | "academic";

export type LibraryPreferredBookLength = "short" | "medium" | "long" | "any";
export type LibraryLearningStyle = "visual" | "auditory" | "reading_writing" | "kinesthetic" | "mixed";
export type LibraryPreferredReadingTime = "morning" | "afternoon" | "evening" | "night" | "any";

export interface LibraryAccessibilityPreferences {
  large_text?: boolean;
  high_contrast?: boolean;
  screen_reader_optimized?: boolean;
  reduce_motion?: boolean;
}

/** Mirrors library_ai_preferences exactly — widened in Phase 15 (AI Personal
 *  Librarian) with the "AI Memory" fields (reading/listening speed
 *  preference, preferred book length, learning style, preferred reading
 *  time, accessibility prefs, memory pause). */
export interface AiPreferencesRow {
  user_id: string;
  reading_mode: AiReadingMode;
  voice: string;
  speech_speed: number;
  speech_pitch: number;
  last_translation_language: string | null;
  reading_speed_pages_per_hour: number | null;
  listening_speed_preference: number;
  preferred_book_length: LibraryPreferredBookLength | null;
  learning_style: LibraryLearningStyle | null;
  preferred_reading_time: LibraryPreferredReadingTime | null;
  accessibility_preferences: LibraryAccessibilityPreferences;
  memory_paused: boolean;
  memory_paused_at: string | null;
  updated_at: string;
}

export const DEFAULT_AI_PREFERENCES: Omit<AiPreferencesRow, "user_id" | "updated_at"> = {
  reading_mode: "student",
  voice: "nova",
  speech_speed: 1.0,
  speech_pitch: 0,
  last_translation_language: null,
  reading_speed_pages_per_hour: null,
  listening_speed_preference: 1.0,
  preferred_book_length: null,
  learning_style: null,
  preferred_reading_time: null,
  accessibility_preferences: {},
  memory_paused: false,
  memory_paused_at: null,
};

/** Mirrors library_ai_activity_log exactly. */
export type AiActivityType = "summary" | "translation" | "explain_selection";
export interface AiActivityLogRow {
  id: string;
  user_id: string;
  book_id: string;
  activity_type: AiActivityType;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Unified History tab item — merges library_ai_activity_log rows with
 *  fetchChatSessions' "one row per conversation" summaries (chat already
 *  has its own user-scoped table, not duplicated into activity_log). */
export interface LibraryAiHistoryItem {
  id: string;
  type: AiActivityType | "chat";
  title: string;
  snippet: string;
  createdAt: string;
  /** chat only — lets the History tab jump back into that conversation. */
  sessionId?: string;
}

/** Widened in Phase 6.5 — same shape the explain-word mode's result now has. */
export interface ExplainWordResult {
  definition: string;
  example_usage: string;
  synonyms: string[];
  antonyms: string[];
}

export interface ImageDescriptionResult {
  description: string;
  image_type: string;
  simplified_explanation: string;
}

export interface ReadingCoachActiveGoal {
  title: string;
  goal_type: "books_count" | "pages_count" | "minutes_read";
  goal_target: number;
  current_value: number;
  reward_vx: number;
  completed: boolean;
}
export interface ReadingCoachStats {
  current_page: number | null;
  total_pages: number | null;
  percent_complete: number | null;
  days_reading: number | null;
  pages_per_day: number | null;
  estimated_days_left: number | null;
  active_goals: ReadingCoachActiveGoal[];
}
export interface ReadingCoachTipsResult {
  tips: string[];
}

export type LibraryChatRole = "user" | "assistant";
export interface LibraryChatMessage {
  id?: string;
  role: LibraryChatRole;
  content: string;
  created_at?: string;
  /** Only ever set on the most recent assistant message, from the
   *  X-Library-Citations response header. */
  citations?: LibraryCitation[];
}

export interface LibraryCitation {
  chapterId: string;
  chapterTitle: string | null;
}

/** Mirrors library_ai_flashcards exactly. */
export interface LibraryFlashcardRow {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  front: string;
  back: string;
  mastered: boolean;
  created_at: string;
}

export type QuizQuestionType = "multiple-choice" | "true-false" | "fill-blank" | "short-answer";
export interface QuizQuestion {
  type: QuizQuestionType;
  question: string;
  options: string[];
  correct_index: number;
  expected_answer: string;
  explanation: string;
}
export interface GeneratedQuiz {
  questions: QuizQuestion[];
}

/** Mirrors library_ai_quiz_attempts exactly — quiz/answers are the raw
 *  jsonb columns, typed here for client convenience. */
export interface LibraryQuizAttemptRow {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  quiz: GeneratedQuiz;
  answers: Record<number, string>;
  score: number;
  total: number;
  created_at: string;
}
