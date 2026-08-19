import { useEffect, useRef, useSyncExternalStore } from "react";
import { gameManager } from "./gameManager";
import type { GameRuntimeSnapshot } from "./types";

/** The shared Arcade runtime snapshot (status, score, restart revision). */
export function useArcadeRuntime(): GameRuntimeSnapshot {
  return useSyncExternalStore(gameManager.subscribe, gameManager.getSnapshot, gameManager.getSnapshot);
}

/**
 * True whenever the shell has paused the session. Games must consult this:
 * the shell only dims the game window, so a game that keeps its own timer
 * running would otherwise keep playing — and losing — behind the overlay.
 */
export function useArcadePaused(): boolean {
  return useArcadeRuntime().status === "paused";
}

/**
 * A fixed-step game loop that honours the shell's pause button and clears
 * itself on unmount. `intervalMs` may change between renders (difficulty
 * ramps) without the caller having to tear the loop down by hand.
 */
export function useArcadeGameLoop(tick: () => void, intervalMs: number, active = true) {
  const paused = useArcadePaused();
  const saved = useRef(tick);
  saved.current = tick;

  useEffect(() => {
    if (!active || paused || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    const timer = window.setInterval(() => saved.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, paused, intervalMs]);
}
