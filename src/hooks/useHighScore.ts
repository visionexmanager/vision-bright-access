import { useState, useCallback } from "react";

/** Persist per-game high scores in localStorage */
export function useHighScore(gameId: string) {
  const key = `vx_hs_${gameId}`;

  const [highScore, setHighScoreState] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(key) ?? "0") || 0; }
    catch { return 0; }
  });

  /** Call with the finished-game score. Returns true if it's a new record. */
  const updateHighScore = useCallback((score: number): boolean => {
    if (score > highScore) {
      setHighScoreState(score);
      try { localStorage.setItem(key, String(score)); } catch {}
      return true;
    }
    return false;
  }, [highScore, key]);

  const resetHighScore = useCallback(() => {
    setHighScoreState(0);
    try { localStorage.removeItem(key); } catch {}
  }, [key]);

  return { highScore, updateHighScore, resetHighScore };
}
