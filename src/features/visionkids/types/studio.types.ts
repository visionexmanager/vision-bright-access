// ─── VisionKids AI Creative Studio — domain types ───────────────────────────
// Hand-typed to match the kids_studio_* migrations (20260811*.sql) — see
// services/stories/kidsSupabase.ts for why these aren't generated yet.

export type ProjectType =
  | "story" | "book" | "drawing" | "character" | "comic"
  | "sticker" | "music" | "voice" | "video" | "cartoon_scene";

export interface CreativeProject {
  id: string;
  user_id: string;
  project_type: ProjectType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content: Record<string, unknown>;
  asset_urls: string[];
  is_public: boolean;
  parent_approved: boolean | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  content: Record<string, unknown>;
  saved_at: string;
}

export interface CreativeChallenge {
  id: string;
  week_start: string;
  prompt_type: ProjectType;
  title: string;
  description: string | null;
  reward_xp: number;
  reward_coins: number;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  project_id: string;
  submitted_at: string;
}

// ── Tool-specific content shapes (stored in CreativeProject.content) ────────
export interface DrawingContent {
  strokes: { points: [number, number][]; color: string; size: number }[];
  backgroundColor: string;
}

export interface CharacterContent {
  bodyColor: string;
  hair: string;
  face: string;
  outfit: string;
  accessory: string;
}

export interface CartoonSceneContent {
  background: string;
  placedCharacters: { characterProjectId: string; x: number; y: number; scale: number }[];
  dialogue: { x: number; y: number; text: string }[];
}

export interface ComicPanel {
  background: string;
  characterEmoji: string;
  captionTop: string;
  speechBubble: string;
}

export interface ComicContent {
  panels: ComicPanel[];
}

export interface BookPage {
  text: string;
  imageUrl?: string;
}

export interface BookContent {
  coverTitle: string;
  coverAuthor: string;
  coverColor: string;
  coverEmoji: string;
  pages: BookPage[];
}

export interface MusicNoteEvent {
  note: string;
  timeMs: number;
  instrument: "piano" | "drum" | "animal";
}

export interface MusicContent {
  sequence: MusicNoteEvent[];
}

export interface VideoSlide {
  imageUrl: string;
  caption: string;
  durationMs: number;
}

export interface VideoContent {
  slides: VideoSlide[];
  musicProjectId?: string;
}
