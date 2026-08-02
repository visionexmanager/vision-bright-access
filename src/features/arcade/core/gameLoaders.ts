import type { ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

export const GAME_LOADERS: Record<string, Loader> = {
  "quiz-challenge": () => import("@/pages/QuizChallenge"),
  memory: () => import("@/pages/MemoryGame"),
  "word-puzzle": () => import("@/pages/WordPuzzle"),
  hangman: () => import("@/pages/games/Hangman"),
  akinator: () => import("@/pages/games/Akinator"),
  "jungle-survival": () => import("@/pages/games/JungleSurvival"),
  "neon-breach": () => import("@/pages/games/NeonBreach"),
  "tactical-strike": () => import("@/pages/games/TacticalStrike"),
  "velocity-racing": () => import("@/pages/games/VelocityXRacing"),
  "star-chef": () => import("@/pages/games/StarChef"),
  "dream-home": () => import("@/pages/games/DreamHome"),
  "music-ear": () => import("@/pages/games/MusicEarMaster"),
  "fashion-designer": () => import("@/pages/games/FashionDesigner"),
  "uno-ultra": () => import("@/pages/games/UnoUltra"),
  dominoes: () => import("@/pages/games/Dominoes"),
  farkle: () => import("@/pages/games/FarkleGame"),
  briscola: () => import("@/pages/games/Briscola"),
  "card-99": () => import("@/pages/games/Card99"),
  logiquest: () => import("@/pages/games/LogiQuest"),
  "trade-tycoon": () => import("@/pages/games/TradeTycoon"),
  "laptop-tech": () => import("@/pages/games/LaptopTechMaster"),
  visionopoly: () => import("@/pages/games/Visionopoly"),
};
