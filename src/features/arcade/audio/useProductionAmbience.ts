import { useEffect } from "react";
import { advancedAudioEngine } from "./AdvancedAudioEngine";
import { playProductionSound } from "./playProductionSound";

/** Starts approved ambience after the first user gesture and always releases it. */
export function useProductionAmbience(assetId: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      void playProductionSound(assetId, { loop:true, volume:0.72 });
    };
    window.addEventListener("pointerdown", start, { once:true });
    window.addEventListener("keydown", start, { once:true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      advancedAudioEngine.stop(assetId, 0.35);
    };
  }, [assetId, enabled]);
}
