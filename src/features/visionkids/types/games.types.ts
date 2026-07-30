// ─── VisionKids Educational Games Platform — domain types ──────────────────
// Hand-typed to match the kids_games_* migrations (20260809*.sql) — see
// services/stories/kidsSupabase.ts for why these aren't generated yet.

import type { AgeGroup, Difficulty } from "@/features/visionkids/types/stories.types";

export interface GameCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  game_count: number;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  age_range: AgeGroup;
  difficulty: Difficulty;
  estimated_minutes: number;
  thumbnail_url: string | null;
  gallery: string[];
  preview_video_url: string | null;
  accessibility_features: string[];
  category_id: string | null;
  xp_reward: number;
  coins_reward: number;
  tags: string[];
  language_support: string[];
  rating_avg: number;
  rating_count: number;
  downloads_count: number;
  players_count: number;
  is_multiplayer: boolean;
  is_accessible_audio: boolean;
  /** Key into the frontend game registry — null means "not implemented yet" (renders ComingSoonGame). */
  engine_key: string | null;
  published_at: string | null;
}

export interface GameWithCategory extends Game {
  category: GameCategory | null;
}

export interface GameSession {
  id: string;
  user_id: string;
  game_id: string;
  started_at: string;
  ended_at: string | null;
  score: number;
  lives_used: number;
  hints_used: number;
  duration_seconds: number;
  won: boolean;
  completed: boolean;
  metadata: Record<string, unknown>;
  game?: Game;
}

export interface GameFavorite {
  id: string;
  user_id: string;
  game_id: string;
  created_at: string;
  game?: Game;
}

export interface PlayerGameStats {
  user_id: string;
  games_played: number;
  wins: number;
  total_play_seconds: number;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  game_id: string;
  best_score: number;
  last_played_at: string;
  display_name?: string;
  avatar_url?: string;
}

export interface GameRating {
  id: string;
  user_id: string;
  game_id: string;
  rating: number;
  created_at: string;
}

export type ChallengeTargetType =
  | "play_game" | "score_at_least" | "win_count" | "complete_any_game"
  | "complete_lesson" | "visit_world" | "complete_quiz";

export interface DailyChallenge {
  id: string;
  challenge_date: string;
  title: string;
  description: string | null;
  game_id: string | null;
  world_slug?: string | null;
  target_type: ChallengeTargetType;
  target_value: number;
  reward_xp: number;
  reward_coins: number;
  progress?: { current_value: number; completed_at: string | null };
}

export interface WeeklyChallenge {
  id: string;
  week_start: string;
  title: string;
  description: string | null;
  game_id: string | null;
  world_slug?: string | null;
  target_type: ChallengeTargetType;
  target_value: number;
  reward_xp: number;
  reward_coins: number;
  progress?: { current_value: number; completed_at: string | null };
}

export interface SeasonEvent {
  id: string;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  theme_color: string | null;
  starts_at: string;
  ends_at: string;
  region_gated: boolean;
  is_active: boolean;
}

export type MultiplayerRoomStatus = "waiting" | "in_progress" | "finished";

export interface MultiplayerRoom {
  id: string;
  code: string;
  host_id: string;
  game_id: string | null;
  room_name: string;
  is_public: boolean;
  max_players: number;
  status: MultiplayerRoomStatus;
  created_at: string;
  players?: MultiplayerRoomPlayer[];
}

export interface MultiplayerRoomPlayer {
  room_id: string;
  user_id: string;
  joined_at: string;
  is_ready: boolean;
  score: number;
}

// ─── Game engine (client-side session state, not persisted directly) ───────
export interface GameEngineConfig {
  hasTimer?: boolean;
  timeLimitSeconds?: number;
  hasLives?: boolean;
  startingLives?: number;
  hasHints?: boolean;
  startingHints?: number;
  hasScore?: boolean;
}

export interface GameEngineState {
  status: "idle" | "playing" | "paused" | "won" | "lost" | "completed";
  score: number;
  lives: number;
  hints: number;
  elapsedSeconds: number;
  timeLeftSeconds: number | null;
}
