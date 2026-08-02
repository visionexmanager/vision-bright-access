import type { AudioChannel } from "../core/types";

export type AudioCategory = "ui" | "button" | "game-effect" | "environment" | "character" | "victory" | "failure" | "narration" | "music";
export type AudioQuality = "production" | "legacy" | "replacement-required";
export type AudioCodec = "opus" | "mp3" | "wav" | "aac";
export type AudioLicenseStatus = "approved" | "pending" | "blocked";

export interface AudioSource {
  src: string;
  codec: AudioCodec;
  bitrateKbps?: number;
  sampleRateHz?: number;
}

export interface AudioAssetDefinition {
  id: string;
  name: string;
  gameIds: string[];
  category: AudioCategory;
  channel: AudioChannel;
  quality: AudioQuality;
  sources: AudioSource[];
  sourceAttribution: string;
  license: string;
  licenseStatus: AudioLicenseStatus;
  loop?: boolean;
  maxInstances?: number;
  normalizedLufs?: number;
  notes?: string;
}

export interface SpatialPosition { x: number; y: number; z: number }
export interface AudioPlayOptions {
  volume?: number;
  loop?: boolean;
  position?: SpatialPosition;
  playbackRate?: number;
  duckMusic?: boolean;
}

export type MusicState = "menu" | "calm" | "active" | "danger" | "victory" | "failure";
