import { ARCADE_GAMES, type ArcadeGame } from "../catalog";
import { audioLibrary } from "../audio/audioLibrary";
import { auditGameVisuals } from "../visual/visualQuality";

const sourceFiles: Record<string, string> = {
  "quiz-challenge":"src/pages/QuizChallenge.tsx", memory:"src/pages/MemoryGame.tsx", "word-puzzle":"src/pages/WordPuzzle.tsx",
  hangman:"src/pages/games/Hangman.tsx", akinator:"src/pages/games/Akinator.tsx", "jungle-survival":"src/pages/games/JungleSurvival.tsx",
  "neon-breach":"src/pages/games/NeonBreach.tsx", "tactical-strike":"src/pages/games/TacticalStrike.tsx", "velocity-racing":"src/pages/games/VelocityXRacing.tsx",
  "star-chef":"src/pages/games/StarChef.tsx", "dream-home":"src/pages/games/DreamHome.tsx", "music-ear":"src/pages/games/MusicEarMaster.tsx",
  "fashion-designer":"src/pages/games/FashionDesigner.tsx", "uno-ultra":"src/pages/games/UnoUltra.tsx", dominoes:"src/pages/games/Dominoes.tsx",
  farkle:"src/pages/games/FarkleGame.tsx", briscola:"src/pages/games/Briscola.tsx", "card-99":"src/pages/games/Card99.tsx",
  logiquest:"src/pages/games/LogiQuest.tsx", "trade-tycoon":"src/pages/games/TradeTycoon.tsx", "laptop-tech":"src/pages/games/LaptopTechMaster.tsx",
  visionopoly:"src/pages/games/Visionopoly.tsx",
  "2048":"src/pages/games/expansion/Game2048.tsx", minesweeper:"src/pages/games/expansion/Minesweeper.tsx",
  "connect-four":"src/pages/games/expansion/ConnectFour.tsx", "reaction-test":"src/pages/games/expansion/ReactionTest.tsx",
  "tic-tac-toe":"src/pages/games/expansion/TicTacToe.tsx", "typing-speed":"src/pages/games/expansion/TypingSpeed.tsx",
  "math-challenge":"src/pages/games/expansion/MathChallenge.tsx", "simon-says":"src/pages/games/expansion/SimonSays.tsx",
  trivia:"src/pages/games/expansion/KnowledgeQuiz.tsx", "geography-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx",
  "science-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx", "history-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx",
  "blind-maze":"src/pages/games/expansion/BlindMaze.tsx",
  sudoku:"src/pages/games/expansion/Sudoku.tsx", nonogram:"src/pages/games/expansion/Nonogram.tsx",
  mastermind:"src/pages/games/expansion/Mastermind.tsx", "word-search":"src/pages/games/expansion/WordSearch.tsx",
  "color-match":"src/pages/games/expansion/ColorMatch.tsx", "audio-direction":"src/pages/games/expansion/AudioDirection.tsx",
  reversi:"src/pages/games/expansion/Reversi.tsx", checkers:"src/pages/games/expansion/Checkers.tsx",
  "peg-solitaire":"src/pages/games/expansion/PegSolitaire.tsx", battleship:"src/pages/games/expansion/Battleship.tsx",
  "mini-golf":"src/pages/games/expansion/MiniGolf.tsx", bowling:"src/pages/games/expansion/Bowling.tsx",
  archery:"src/pages/games/expansion/Archery.tsx", darts:"src/pages/games/expansion/Darts.tsx",
  "airport-manager":"src/pages/games/expansion/AirportManager.tsx", "traffic-control":"src/pages/games/expansion/TrafficControl.tsx",
  "train-dispatcher":"src/pages/games/expansion/TrainDispatcher.tsx", "harbor-manager":"src/pages/games/expansion/HarborManager.tsx",
  "learn-letters":"src/pages/games/expansion/LearnLetters.tsx", "learn-numbers":"src/pages/games/expansion/LearnNumbers.tsx",
  "learn-shapes":"src/pages/games/expansion/LearnShapes.tsx", "matching-studio":"src/pages/games/expansion/MatchingStudio.tsx",
  crossword:"src/pages/games/expansion/Crossword.tsx", "anagram-arena":"src/pages/games/expansion/AnagramArena.tsx",
  "word-ladder":"src/pages/games/expansion/WordLadder.tsx", "spelling-master":"src/pages/games/expansion/SpellingMaster.tsx",
  "restaurant-manager":"src/pages/games/expansion/RestaurantManager.tsx", "farm-manager":"src/pages/games/expansion/FarmManager.tsx",
  "city-builder":"src/pages/games/expansion/CityBuilder.tsx", "delivery-simulator":"src/pages/games/expansion/DeliverySimulator.tsx",
  snake:"src/pages/games/expansion/Snake.tsx", "block-stacker":"src/pages/games/expansion/BlockStacker.tsx",
  breakout:"src/pages/games/expansion/Breakout.tsx", "bubble-shooter":"src/pages/games/expansion/BubbleShooter.tsx",
  "technology-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx", "nature-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx",
  "space-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx", "sports-quiz":"src/pages/games/expansion/KnowledgeQuiz.tsx",
  "audio-memory":"src/pages/games/expansion/AudioMemory.tsx", "sound-hunt":"src/pages/games/expansion/SoundHunt.tsx",
  "echo-locator":"src/pages/games/expansion/EchoLocator.tsx", "rhythm-navigation":"src/pages/games/expansion/RhythmNavigation.tsx",
  "balance-lab":"src/pages/games/expansion/BalanceLab.tsx", "pendulum-puzzle":"src/pages/games/expansion/PendulumPuzzle.tsx",
  "trajectory-master":"src/pages/games/expansion/TrajectoryMaster.tsx", "magnet-lab":"src/pages/games/expansion/MagnetLab.tsx",
  "penalty-shootout":"src/pages/games/expansion/PenaltyShootout.tsx", "basketball-challenge":"src/pages/games/expansion/BasketballChallenge.tsx",
  "table-tennis":"src/pages/games/expansion/TableTennis.tsx", "air-hockey":"src/pages/games/expansion/AirHockey.tsx",
  "rhythm-keys":"src/pages/games/expansion/RhythmKeys.tsx", "melody-memory":"src/pages/games/expansion/MelodyMemory.tsx",
  "beat-matcher":"src/pages/games/expansion/BeatMatcher.tsx", "piano-trainer":"src/pages/games/expansion/PianoTrainer.tsx",
  "symmetry-sketch":"src/pages/games/expansion/SymmetrySketch.tsx", "pixel-canvas":"src/pages/games/expansion/PixelCanvas.tsx",
  "shape-designer":"src/pages/games/expansion/ShapeDesigner.tsx", "pattern-artist":"src/pages/games/expansion/PatternArtist.tsx",
  "lemonade-stand":"src/pages/games/expansion/LemonadeStand.tsx", "space-miner-idle":"src/pages/games/expansion/SpaceMinerIdle.tsx",
  "factory-idle":"src/pages/games/expansion/FactoryIdle.tsx", "aquarium-keeper":"src/pages/games/expansion/AquariumKeeper.tsx",
  "garden-planner":"src/pages/games/expansion/GardenPlanner.tsx", "museum-curator":"src/pages/games/expansion/MuseumCurator.tsx",
  "wildlife-rescue":"src/pages/games/expansion/WildlifeRescue.tsx",
};

export type GameQualityScore = { gameplay:number; audio:number; graphics:number; performance:number; accessibility:number; total:number };

function score(game: ArcadeGame): GameQualityScore {
  const gameplay = game.featured ? 84 : game.trending ? 80 : 75;
  const gameAudio = audioLibrary.forGame(game.slug);
  const approvedAudio = gameAudio.filter((asset) => asset.quality === "production" && asset.licenseStatus === "approved").length;
  const audio = Math.round(30 + 55 * (approvedAudio / gameAudio.length));
  const graphics = auditGameVisuals(game).status === "approved" ? 85 : 42;
  const performance = ["velocity-racing","tactical-strike","jungle-survival"].includes(game.slug) ? 72 : 82;
  const accessibility = game.accessible ? 82 : game.controls.includes("Keyboard") ? 58 : 40;
  return { gameplay, audio, graphics, performance, accessibility, total:Math.round((gameplay + audio + graphics + performance + accessibility) / 5) };
}

export const GAME_UPGRADE_AUDIT = ARCADE_GAMES.map((game) => {
  const quality = score(game);
  const priority = game.featured || game.trending ? 1 : quality.total < 62 ? 2 : 3;
  const audioPending = audioLibrary.forGame(game.slug).some((asset) => asset.quality !== "production" || asset.licenseStatus !== "approved");
  const visualPending = auditGameVisuals(game).status !== "approved";
  const issues = [
    audioPending ? "Some required licensed production audio assets are still pending" : undefined,
    visualPending ? "Dedicated HD cover, thumbnail, and background production is pending" : undefined,
    !game.accessible ? "Full screen-reader gameplay implementation and event descriptions are pending" : undefined,
  ].filter((issue): issue is string => Boolean(issue));
  return {
    id:game.slug, name:game.title, type:game.categories.join(", "), files:[sourceFiles[game.slug], "src/components/game/GameEconomyGate.tsx", "src/features/arcade/ArcadeGameExperience.tsx"],
    codeStatus:"stable-legacy-with-premium-adapter" as const,
    graphicsStatus:visualPending ? "redesign-required" as const : "production-approved" as const,
    audioStatus:audioPending ? "production-assets-partial" as const : "production-approved" as const,
    performanceStatus:["velocity-racing","tactical-strike","jungle-survival"].includes(game.slug) ? "requires-device-profiling" as const : "lazy-loaded" as const,
    priority, issues, quality, manualAssistiveTechnologyTest:"deferred-by-project-owner" as const,
    approved:quality.total >= 80 && quality.audio >= 80 && quality.graphics >= 80 && quality.accessibility >= 75,
  };
});

export const MINIMUM_ARCADE_QUALITY_SCORE = 80;
