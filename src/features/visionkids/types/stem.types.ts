export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export type StemLabKind = "lab" | "builder" | "center";

export interface StemLab {
  slug: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  kind: StemLabKind;
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type ExperimentKind = "experiment" | "simulation" | "activity";
export type Difficulty = "easy" | "medium" | "hard";

/** A single multiple-choice quiz question. `answer` is the index into `choices`. */
export interface QuizQuestion {
  q: string;
  choices: string[];
  answer: number;
  explain?: string;
}

/** Client-rendered simulation descriptor. `type` selects the renderer in
 *  SimulationStage; `params` are its knobs; `goal` is a friendly one-liner. */
export interface SimulationConfig {
  type: "gravity" | "pendulum" | "magnet" | "ramp" | "circuit" | "ph" | "rocket";
  params?: Record<string, unknown>;
  goal?: string;
}

/** Config for math practice activities (kind = "activity"). */
export interface ActivityConfig {
  op?: "add" | "subtract" | "multiply" | "divide";
  min?: number;
  max?: number;
  rounds?: number;
}

export interface Experiment {
  id: string;
  lab: string;
  topic: string;
  slug: string;
  title: string;
  emoji: string;
  summary: string | null;
  body: string | null;
  kind: ExperimentKind;
  difficulty: Difficulty;
  steps: string[];
  content: ActivityConfig & Record<string, unknown>;
  quiz: QuizQuestion[];
  simulation: SimulationConfig | Record<string, never>;
  video_url: string | null;
  duration_seconds: number | null;
  color: KidsColor;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface InnovationChallenge {
  id: string;
  slug: string;
  title: string;
  problem: string;
  description: string | null;
  emoji: string;
  theme: string | null;
  content: { hints?: string[] } & Record<string, unknown>;
  reward_xp: number;
  reward_coins: number;
  active_from: string | null;
  active_to: string | null;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface ResearchImage {
  url: string;
  caption?: string;
}

export interface ResearchArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  emoji: string;
  summary: string | null;
  body: string | null;
  images: ResearchImage[];
  video_url: string | null;
  fun_facts: string[];
  reading_level: "easy" | "medium";
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

// ── Per-child progress & projects ───────────────────────────────────────────
export interface ExperimentProgress {
  user_id: string;
  experiment_id: string;
  completed: boolean;
  best_score: number;
  completed_at: string | null;
  updated_at: string;
}

export type ProjectKind = "invention" | "robot" | "design" | "experiment";

export interface StemProject {
  id: string;
  user_id: string;
  kind: ProjectKind;
  title: string;
  description: string | null;
  lab: string | null;
  emoji: string;
  data: Record<string, unknown>;
  challenge_id: string | null;
  is_public: boolean;
  likes: number;
  status: "draft" | "submitted" | "published";
  created_at: string;
  updated_at: string;
}

export interface StemSettings {
  user_id: string;
  audio_descriptions: boolean;
  voice_commands: boolean;
  simple_language: boolean;
  updated_at: string;
}

export type ScienceRank = "novice" | "explorer" | "researcher" | "scientist" | "professor";
export type InventorRank = "tinkerer" | "builder" | "maker" | "innovator" | "genius";

export interface StemStats {
  experiments: number;
  projects: number;
  inventions: number;
  robots: number;
  designs: number;
  research_read: number;
  science_rank: ScienceRank;
  inventor_rank: InventorRank;
}
