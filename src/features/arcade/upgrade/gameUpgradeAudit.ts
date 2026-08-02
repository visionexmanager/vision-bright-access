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
    !game.accessible ? "Full screen-reader gameplay verification and event descriptions are pending" : "Requires manual verification on NVDA, JAWS, VoiceOver, and TalkBack",
  ].filter((issue): issue is string => Boolean(issue));
  return {
    id:game.slug, name:game.title, type:game.categories.join(", "), files:[sourceFiles[game.slug], "src/components/game/GameEconomyGate.tsx", "src/features/arcade/ArcadeGameExperience.tsx"],
    codeStatus:"stable-legacy-with-premium-adapter" as const,
    graphicsStatus:visualPending ? "redesign-required" as const : "production-approved" as const,
    audioStatus:audioPending ? "production-assets-partial" as const : "production-approved" as const,
    performanceStatus:["velocity-racing","tactical-strike","jungle-survival"].includes(game.slug) ? "requires-device-profiling" as const : "lazy-loaded" as const,
    priority, issues, quality, approved:quality.total >= 80 && quality.audio >= 80 && quality.graphics >= 80 && quality.accessibility >= 75,
  };
});

export const MINIMUM_ARCADE_QUALITY_SCORE = 80;
