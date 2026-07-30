import { lazy } from "react";

/**
 * Central game registry — maps kids_games.engine_key to the React component
 * that plays it. This is the ONE file that needs a new line when a game
 * ships; the game's own code lives entirely in its own folder here
 * (src/features/visionkids/games/<slug>/), never touching any other game.
 * A DB row with engine_key = NULL (or a key not listed here) falls back to
 * ComingSoonGame — see GameDetails/GamePlay for where this is consumed.
 * Designed to scale to 500+ entries without restructuring: this is a flat
 * key->lazy-import map, not a switch statement or a growing component tree.
 */
export const GAME_REGISTRY: Record<string, ReturnType<typeof lazy>> = {
  "memory-cards": lazy(() => import("@/features/visionkids/games/memory-cards/MemoryCardsGame")),
  "math-challenge": lazy(() => import("@/features/visionkids/games/math-challenge/MathChallengeGame")),
  "flag-quiz": lazy(() => import("@/features/visionkids/games/flag-quiz/FlagQuizGame")),
  "guess-animal": lazy(() => import("@/features/visionkids/games/guess-animal/GuessAnimalGame")),
  "color-match": lazy(() => import("@/features/visionkids/games/color-match/ColorMatchGame")),
  "maze": lazy(() => import("@/features/visionkids/games/maze/MazeGame")),
};

export const ComingSoonGame = lazy(() => import("@/features/visionkids/games/_placeholder/ComingSoonGame"));

export function resolveGameComponent(engineKey: string | null): ReturnType<typeof lazy> {
  return (engineKey && GAME_REGISTRY[engineKey]) || ComingSoonGame;
}
