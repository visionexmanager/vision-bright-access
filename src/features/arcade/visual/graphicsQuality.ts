import { readGameSettings } from "../core/gameSettings";
import type { VisualRuntimeProfile } from "./types";

const profiles: Record<VisualRuntimeProfile["mode"], VisualRuntimeProfile> = {
  high: { mode:"high", effects:"full", maxAssetWidth:2560, animationScale:1 },
  balanced: { mode:"balanced", effects:"reduced", maxAssetWidth:1600, animationScale:.72 },
  performance: { mode:"performance", effects:"minimal", maxAssetWidth:960, animationScale:.35 },
};

export function resolveGraphicsProfile(): VisualRuntimeProfile {
  const settings = readGameSettings();
  if (settings.qualityMode !== "auto") return profiles[settings.qualityMode];
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (settings.reducedMotion || connection?.saveData || memory && memory <= 2 || connection?.effectiveType === "2g") return profiles.performance;
  if ((memory && memory >= 8) && window.devicePixelRatio >= 1.5) return profiles.high;
  return profiles.balanced;
}

export function applyGraphicsProfile() {
  const profile = resolveGraphicsProfile();
  document.documentElement.dataset.arcadeGraphics = profile.mode;
  document.documentElement.style.setProperty("--arcade-motion-scale", String(profile.animationScale));
  return profile;
}
