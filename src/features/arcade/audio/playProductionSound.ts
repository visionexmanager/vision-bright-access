import { advancedAudioEngine } from "./AdvancedAudioEngine";
import type { AudioPlayOptions } from "./types";

/** Optional production audio must never block a legal game move. */
export async function playProductionSound(assetId: string, options: AudioPlayOptions = {}) {
  try {
    await advancedAudioEngine.play(assetId, options);
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("visionex:arcade-audio-error", {
      detail:{ assetId, message:error instanceof Error ? error.message : "Audio playback failed" },
    }));
    return false;
  }
}
