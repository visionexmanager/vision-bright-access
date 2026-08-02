import type { GameQualityMode } from "../core/types";

export type VisualAssetKind = "cover" | "thumbnail" | "background" | "icon" | "character" | "effect" | "animation";
export type VisualAssetQuality = "production" | "legacy" | "replacement-required";

export interface VisualSource {
  src: string;
  width: number;
  height: number;
  mimeType: "image/avif" | "image/webp" | "image/jpeg" | "image/png" | "image/svg+xml";
  density?: 1 | 2 | 3;
  bytes?: number;
}

export interface PremiumVisualAsset {
  id: string;
  gameId: string;
  kind: VisualAssetKind;
  alt: string;
  focalPoint?: `${number}% ${number}%`;
  quality: VisualAssetQuality;
  sources: readonly VisualSource[];
}

export interface VisualRuntimeProfile {
  mode: Exclude<GameQualityMode, "auto">;
  effects: "full" | "reduced" | "minimal";
  maxAssetWidth: number;
  animationScale: number;
}
