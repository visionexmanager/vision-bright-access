import type { ComponentType, LazyExoticComponent } from "react";
import type { ArcadeGame } from "../catalog";

export type GameLifecycleStatus = "idle" | "loading" | "running" | "paused" | "completed" | "stopped" | "error";
export type GameQualityMode = "auto" | "high" | "balanced" | "performance";
export type AudioChannel = "music" | "effects" | "ambient" | "voice";

export interface GameSettings {
  musicVolume: number;
  effectsVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  muted: boolean;
  highQualityAudio: boolean;
  qualityMode: GameQualityMode;
  keyboardMode: boolean;
  screenReaderMode: boolean;
  highContrastMode: boolean;
  reducedMotion: boolean;
}

export interface GameAsset {
  id: string;
  kind: "cover" | "thumbnail" | "background" | "character" | "animation";
  src: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface GameDefinition extends ArcadeGame {
  version: string;
  status: "active" | "beta" | "maintenance" | "coming-soon";
  assets: GameAsset[];
  defaultSettings: Partial<GameSettings>;
  loader: () => Promise<{ default: ComponentType }>;
}

export interface GameSessionRecord {
  id: string;
  gameId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  score?: number;
  result?: "win" | "loss" | "draw" | "abandoned";
  completed: boolean;
}

export interface PlayerGameData {
  gameId: string;
  lastPlayedAt?: string;
  highScore: number;
  totalPlaySeconds: number;
  playCount: number;
  completionCount: number;
  winCount: number;
  lastScore: number;
  highestLevel: number;
  achievements: string[];
  settings: Record<string, unknown>;
  rating?: number;
}

export interface GameRuntimeSnapshot {
  gameId?: string;
  sessionId?: string;
  status: GameLifecycleStatus;
  score: number;
  error?: string;
  revision: number;
}

export type LazyGameComponent = LazyExoticComponent<ComponentType>;
