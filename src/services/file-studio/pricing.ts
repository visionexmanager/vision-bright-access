// ─── File Studio — VX Pricing ────────────────────────────────────────────────
// Rate: 1000 VX = $1 USD

import type { ModuleType, AnyFormat } from "@/lib/types/fileStudio";

// Base cost per module type (VX)
export const MODULE_BASE_COST: Record<ModuleType, number> = {
  audio:     50,    // $0.05
  video:     200,   // $0.20
  image:     20,    // $0.02
  document:  80,    // $0.08
  archive:   30,    // $0.03
  developer: 10,    // $0.01
  "ai-tools": 500,  // $0.50
};

// Premium format surcharges (added on top of base)
const FORMAT_SURCHARGE: Partial<Record<AnyFormat, number>> = {
  flac:  30,
  avif:  25,
  heic:  25,
  "7z":  20,
  mkv:   50,
  mov:   40,
};

// Per-MB multiplier (applied to file size)
export const PER_MB_RATE = 1; // 1 VX per MB

// Feature add-ons
export const FEATURE_COST = {
  normalize:         20,
  noiseReduction:    80,
  ocr:              150,
  backgroundRemoval: 300,
  extractAudio:      60,
  compress:          30,
} as const;

export function calculateVxCost(
  moduleType: ModuleType,
  targetFormat: AnyFormat,
  fileSizeMb: number,
  features: Partial<typeof FEATURE_COST> = {}
): number {
  let cost = MODULE_BASE_COST[moduleType];
  cost += FORMAT_SURCHARGE[targetFormat] ?? 0;
  cost += Math.ceil(fileSizeMb) * PER_MB_RATE;
  for (const [feat, enabled] of Object.entries(features)) {
    if (enabled) cost += FEATURE_COST[feat as keyof typeof FEATURE_COST] ?? 0;
  }
  return Math.max(10, Math.round(cost));
}

export function formatVxCost(vx: number): string {
  return `${vx.toLocaleString()} VX`;
}
