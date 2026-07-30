import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStartGameSession, useEndGameSession } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useAwardXp, useAwardCoins, useAwardAchievement, usePlayerGameStats } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useBumpDailyChallengeProgress, useBumpWeeklyChallengeProgress, useDailyChallenges, useWeeklyChallenges } from "@/features/visionkids/hooks/games/useGameChallenges";
import type { Game } from "@/features/visionkids/types/games.types";
import type { GameEngineState } from "@/features/visionkids/types/games.types";

export interface UseGameSessionOptions {
  game: Game;
  hasTimer?: boolean;
  timeLimitSeconds?: number;
  hasLives?: boolean;
  startingLives?: number;
  hasHints?: boolean;
  startingHints?: number;
  /** Called once when a countdown timer hits zero — defaults to finishing as a loss. */
  onTimeUp?: () => void;
}

export interface FinishOptions {
  won: boolean;
  isPerfectScore?: boolean;
}

/**
 * The unified VisionKids game engine session. Every game folder under
 * src/features/visionkids/games/ wraps its own UI/logic around this one
 * hook so timer/score/lives/hints/pause/resume/save-progress/restart and
 * the Supabase session + XP/coins/achievements/challenges wiring are
 * never reimplemented per game — adding game #21..#500 reuses this as-is.
 */
export function useGameSession(options: UseGameSessionOptions) {
  const { game, hasTimer, timeLimitSeconds, hasLives, startingLives = 3, hasHints, startingHints = 3, onTimeUp } = options;
  const { user } = useAuth();

  const [state, setState] = useState<GameEngineState>({
    status: "idle",
    score: 0,
    lives: startingLives,
    hints: startingHints,
    elapsedSeconds: 0,
    timeLeftSeconds: hasTimer ? timeLimitSeconds ?? 60 : null,
  });

  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startSession = useStartGameSession();
  const endSession = useEndGameSession();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();
  const { data: playerStats } = usePlayerGameStats();
  const { data: dailyChallenges } = useDailyChallenges();
  const { data: weeklyChallenges } = useWeeklyChallenges();
  const bumpDaily = useBumpDailyChallengeProgress();
  const bumpWeekly = useBumpWeeklyChallengeProgress();

  const clearTicker = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTicker, [clearTicker]);

  const start = useCallback(async () => {
    finishedRef.current = false;
    setState({
      status: "playing",
      score: 0,
      lives: startingLives,
      hints: startingHints,
      elapsedSeconds: 0,
      timeLeftSeconds: hasTimer ? timeLimitSeconds ?? 60 : null,
    });

    if (user) {
      try {
        const session = await startSession.mutateAsync(game.id);
        sessionIdRef.current = session.id;
      } catch {
        sessionIdRef.current = null;
      }
    }

    clearTicker();
    intervalRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.status !== "playing") return prev;
        const elapsedSeconds = prev.elapsedSeconds + 1;
        const timeLeftSeconds = prev.timeLeftSeconds !== null ? Math.max(0, prev.timeLeftSeconds - 1) : null;
        return { ...prev, elapsedSeconds, timeLeftSeconds };
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, hasTimer, timeLimitSeconds, startingLives, startingHints, user]);

  const pause = useCallback(() => setState((prev) => (prev.status === "playing" ? { ...prev, status: "paused" } : prev)), []);
  const resume = useCallback(() => setState((prev) => (prev.status === "paused" ? { ...prev, status: "playing" } : prev)), []);

  const addScore = useCallback((delta: number) => setState((prev) => ({ ...prev, score: Math.max(0, prev.score + delta) })), []);

  const consumeHint = useCallback((): boolean => {
    let granted = false;
    setState((prev) => {
      if (!hasHints || prev.hints <= 0) return prev;
      granted = true;
      return { ...prev, hints: prev.hints - 1 };
    });
    return granted;
  }, [hasHints]);

  const finish = useCallback(
    async ({ won, isPerfectScore }: FinishOptions) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTicker();

      setState((prev) => ({ ...prev, status: won ? "won" : "lost" }));

      if (!user) return;

      const currentScore = stateRef.current.score;
      const duration = stateRef.current.elapsedSeconds;
      const livesUsed = Math.max(0, startingLives - stateRef.current.lives);
      const hintsUsed = Math.max(0, startingHints - stateRef.current.hints);

      if (sessionIdRef.current) {
        await endSession.mutateAsync({
          sessionId: sessionIdRef.current,
          score: currentScore,
          livesUsed,
          hintsUsed,
          durationSeconds: duration,
          won,
        }).catch(() => {});
      }

      if (game.xp_reward > 0) await awardXp.mutateAsync({ amount: game.xp_reward, reason: `Game completed: ${game.slug}` }).catch(() => {});
      if (game.coins_reward > 0) await awardCoins.mutateAsync({ amount: game.coins_reward, reason: `Game completed: ${game.slug}` }).catch(() => {});

      const playsSoFar = (playerStats?.games_played ?? 0) + 1;
      if (playsSoFar === 1) awardAchievement.mutate("first_game");
      if (playsSoFar === 5) awardAchievement.mutate("five_games");
      if (playsSoFar === 10) awardAchievement.mutate("ten_games");
      if (isPerfectScore) awardAchievement.mutate("perfect_score");

      for (const challenge of dailyChallenges ?? []) {
        if (challenge.progress?.completed_at) continue;
        if (challenge.target_type === "complete_any_game") bumpDaily.mutate({ challengeId: challenge.id, targetValue: challenge.target_value });
        else if (challenge.target_type === "score_at_least" && currentScore >= challenge.target_value) bumpDaily.mutate({ challengeId: challenge.id, targetValue: challenge.target_value, incrementBy: challenge.target_value });
        else if (challenge.target_type === "win_count" && won) bumpDaily.mutate({ challengeId: challenge.id, targetValue: challenge.target_value });
      }
      for (const challenge of weeklyChallenges ?? []) {
        if (challenge.progress?.completed_at) continue;
        if (challenge.target_type === "complete_any_game") bumpWeekly.mutate({ challengeId: challenge.id, targetValue: challenge.target_value });
        else if (challenge.target_type === "score_at_least" && currentScore >= challenge.target_value) bumpWeekly.mutate({ challengeId: challenge.id, targetValue: challenge.target_value, incrementBy: challenge.target_value });
        else if (challenge.target_type === "win_count" && won) bumpWeekly.mutate({ challengeId: challenge.id, targetValue: challenge.target_value });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, user, startingLives, startingHints, playerStats, dailyChallenges, weeklyChallenges]
  );

  const loseLife = useCallback(() => {
    setState((prev) => {
      if (!hasLives) return prev;
      const lives = Math.max(0, prev.lives - 1);
      if (lives === 0) window.setTimeout(() => finish({ won: false }), 0);
      return { ...prev, lives };
    });
  }, [hasLives, finish]);

  // Timer expiry
  useEffect(() => {
    if (state.status === "playing" && state.timeLeftSeconds === 0) {
      if (onTimeUp) onTimeUp();
      else finish({ won: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timeLeftSeconds, state.status]);

  const restart = useCallback(() => start(), [start]);

  return { state, start, pause, resume, restart, addScore, consumeHint, loseLife, finish };
}
