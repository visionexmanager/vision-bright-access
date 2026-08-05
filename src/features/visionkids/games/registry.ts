import { lazy } from "react";

/**
 * Central game registry — maps kids_games.engine_key to the React component
 * that plays it. This is the ONE file that needs a new line when a game
 * ships; the game's own code lives entirely in its own folder here
 * (src/features/visionkids/games/<slug>/), never touching any other game.
 *
 * Every seeded game now has an entry. A DB row whose engine_key is NULL or
 * unknown still falls back to ComingSoonGame — that path is the safety net
 * for a row added ahead of its code, not a shipping state.
 *
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
  "word-search": lazy(() => import("@/features/visionkids/games/word-search/WordSearchGame")),
  "puzzle": lazy(() => import("@/features/visionkids/games/puzzle/PuzzleGame")),
  "sudoku-kids": lazy(() => import("@/features/visionkids/games/sudoku-kids/SudokuKidsGame")),
  "guess-sound": lazy(() => import("@/features/visionkids/games/guess-sound/GuessSoundGame")),
  "shape-matching": lazy(() => import("@/features/visionkids/games/shape-matching/ShapeMatchingGame")),
  "typing-kids": lazy(() => import("@/features/visionkids/games/typing-kids/TypingKidsGame")),
  "coding-puzzle": lazy(() => import("@/features/visionkids/games/coding-puzzle/CodingPuzzleGame")),
  "planet-explorer": lazy(() => import("@/features/visionkids/games/planet-explorer/PlanetExplorerGame")),
  "solar-system-quiz": lazy(() => import("@/features/visionkids/games/solar-system-quiz/SolarSystemQuizGame")),
  "geography-quiz": lazy(() => import("@/features/visionkids/games/geography-quiz/GeographyQuizGame")),
  "multiplication-hero": lazy(() => import("@/features/visionkids/games/multiplication-hero/MultiplicationHeroGame")),
  "alphabet-adventure": lazy(() => import("@/features/visionkids/games/alphabet-adventure/AlphabetAdventureGame")),
  "number-adventure": lazy(() => import("@/features/visionkids/games/number-adventure/NumberAdventureGame")),
  "drawing-challenge": lazy(() => import("@/features/visionkids/games/drawing-challenge/DrawingChallengeGame")),
};

export const ComingSoonGame = lazy(() => import("@/features/visionkids/games/_placeholder/ComingSoonGame"));

export function resolveGameComponent(engineKey: string | null): ReturnType<typeof lazy> {
  return (engineKey && GAME_REGISTRY[engineKey]) || ComingSoonGame;
}
