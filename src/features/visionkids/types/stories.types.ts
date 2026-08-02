// ─── VisionKids Smart Stories Library — domain types ───────────────────────
// Hand-typed to match the kids_* migrations exactly (see
// supabase/migrations/20260808003000_kids_stories_catalog.sql onward) —
// see services/stories/kidsSupabase.ts for why these aren't generated yet.

export type AgeGroup = "3-5" | "6-8" | "9-12";
export type Difficulty = "easy" | "medium" | "hard";
export type StoryStatus = "draft" | "published" | "archived";
export type DownloadFormat = "pdf" | "epub" | "audio" | "video" | "brf";
export type QuizQuestionType = "multiple_choice" | "true_false" | "vocabulary" | "memory";

export interface StoryCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  story_count: number;
}

export interface StoryAuthor {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface StoryNarrator {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  voice_sample_url: string | null;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  author_id: string | null;
  narrator_id: string | null;
  translator: string | null;
  age_group: AgeGroup;
  difficulty: Difficulty;
  language: string;
  duration_minutes: number | null;
  reading_time_minutes: number | null;
  page_count: number;
  cover_image_url: string | null;
  gallery: string[];
  audio_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  epub_url: string | null;
  brf_url: string | null;
  tags: string[];
  category_id: string | null;
  rating_avg: number;
  rating_count: number;
  likes_count: number;
  bookmarks_count: number;
  downloads_count: number;
  views_count: number;
  published_at: string | null;
  accessibility_features: string[];
  is_interactive: boolean;
  is_ai_generated: boolean;
  status: StoryStatus;
  created_at: string;
}

/** Story joined with its category/author/narrator — what detail views fetch. */
export interface StoryWithRelations extends Story {
  category: StoryCategory | null;
  author: StoryAuthor | null;
  narrator: StoryNarrator | null;
}

export interface StoryPage {
  id: string;
  story_id: string;
  chapter_id: string | null;
  page_number: number;
  text_content: string;
  image_url: string | null;
  audio_start_seconds: number | null;
}

export interface StoryChapter {
  id: string;
  story_id: string;
  chapter_number: number;
  title: string;
  start_page: number;
  audio_start_seconds: number | null;
}

export interface StoryNode {
  id: string;
  story_id: string;
  node_key: string;
  text_content: string;
  image_url: string | null;
  audio_url: string | null;
  is_start: boolean;
  is_ending: boolean;
  ending_type: string | null;
}

export interface StoryChoice {
  id: string;
  node_id: string;
  choice_text: string;
  next_node_id: string | null;
  order_index: number;
}

export interface StoryRating {
  id: string;
  user_id: string;
  story_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

export interface StoryBookmark {
  id: string;
  user_id: string;
  story_id: string;
  page_number: number | null;
  position: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export interface StoryHighlight {
  id: string;
  user_id: string;
  story_id: string;
  page_number: number | null;
  quoted_text: string;
  color: string;
  created_at: string;
}

export interface StoryNote {
  id: string;
  user_id: string;
  story_id: string;
  page_number: number | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgress {
  user_id: string;
  story_id: string;
  current_page: number;
  current_node_id: string | null;
  audio_position_seconds: number;
  progress_percent: number;
  minutes_read: number;
  completed: boolean;
  last_read_at: string;
  story?: Story;
}

export interface ReadingStats {
  user_id: string;
  total_stories_read: number;
  total_words_read: number;
  total_minutes_read: number;
  current_streak: number;
  longest_streak: number;
  last_read_date: string | null;
}

export interface StoryDownload {
  id: string;
  user_id: string;
  story_id: string;
  format: DownloadFormat;
  downloaded_at: string;
  story?: Story;
}

export interface StoryFavorite {
  id: string;
  user_id: string;
  story_id: string;
  created_at: string;
  story?: Story;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  reward_vx: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement?: Achievement;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  type: QuizQuestionType;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  order_index: number;
  points: number;
}

export interface Quiz {
  id: string;
  story_id: string;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  answers: { question_id: string; answer: string; correct: boolean }[];
  completed_at: string;
}

export interface AiGeneratedPage {
  text: string;
  imageUrl?: string;
}

export interface AiCharacter {
  name: string;
  description: string;
}

export interface AiVocabularyWord {
  word: string;
  meaning: string;
}

export interface AiQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface AiStory {
  id: string;
  user_id: string;
  prompt: string;
  title: string;
  pages: AiGeneratedPage[];
  characters: AiCharacter[];
  cover_image_url: string | null;
  moral_lesson: string | null;
  vocabulary: AiVocabularyWord[];
  quiz: AiQuizQuestion[];
  is_public: boolean;
  status: "generating" | "ready" | "failed";
  created_at: string;
}

export interface StorySearchFilters {
  query?: string;
  ageGroup?: AgeGroup;
  categorySlug?: string;
  language?: string;
  maxDurationMinutes?: number;
  authorId?: string;
}

// ─── Reader settings (persisted locally, not per-story) ────────────────────
export type ReaderFontFamily = "sans" | "serif" | "dyslexic";
export type ReaderBackground = "light" | "sepia" | "night" | "high-contrast";

export interface ReaderSettings {
  fontSize: number; // px
  fontFamily: ReaderFontFamily;
  lineHeight: number; // unitless multiplier
  background: ReaderBackground;
  focusMode: boolean;
  autoScroll: boolean;
  autoScrollSpeed: number; // px/sec
}
