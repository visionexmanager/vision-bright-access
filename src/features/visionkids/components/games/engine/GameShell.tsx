import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Pause as PauseIcon, Trophy, Frown, Home, Sparkles, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { bounceIn, fadeIn } from "@/features/visionkids/utils/animations";
import { GameHUD } from "@/features/visionkids/components/games/engine/GameHUD";
import type { GameEngineState } from "@/features/visionkids/types/games.types";
import type { Game } from "@/features/visionkids/types/games.types";

interface GameShellProps {
  game: Game;
  state: GameEngineState;
  hasLives?: boolean;
  hasHints?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onHint?: () => void;
  children: ReactNode;
  /** Extra copy shown on the win/lose result screen (e.g. "12 words found"). */
  resultSummary?: ReactNode;
}

export function GameShell({ game, state, hasLives, hasHints, onStart, onPause, onResume, onRestart, onHint, children, resultSummary }: GameShellProps) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  if (state.status === "idle") {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
        <h2 className="font-heading text-2xl font-extrabold">{game.title}</h2>
        {game.description && <p className="max-w-md text-muted-foreground">{game.description}</p>}
        <Button size="lg" onClick={onStart} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
          <Play className="h-5 w-5" aria-hidden="true" /> {t("kids.games.start")}
        </Button>
      </div>
    );
  }

  if (state.status === "won" || state.status === "lost") {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={bounceIn(reduced)}
        className={`flex flex-col items-center gap-4 rounded-2xl border-2 p-10 text-center ${state.status === "won" ? "border-kids-green/40 bg-kids-green/10" : "border-border bg-card"}`}
      >
        {state.status === "won" ? <Trophy className="h-14 w-14 text-kids-accent" aria-hidden="true" /> : <Frown className="h-14 w-14 text-muted-foreground" aria-hidden="true" />}
        <p className="font-heading text-2xl font-extrabold">{state.status === "won" ? t("kids.games.youWon") : t("kids.games.gameOver")}</p>
        <p className="text-lg font-semibold text-kids-primary">{t("kids.games.score")}: {state.score}</p>
        {resultSummary}
        {state.status === "won" && (
          <div className="flex items-center gap-4 text-sm font-semibold">
            <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> +{game.xp_reward} XP</span>
            <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> +{game.coins_reward}</span>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button onClick={onRestart} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.games.playAgain")}
          </Button>
          <Button asChild variant="outline">
            <Link to="/kids/games">
              <Home className="h-4 w-4" aria-hidden="true" /> {t("kids.games.moreGames")}
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GameHUD state={state} hasLives={hasLives} hasHints={hasHints} onHint={onHint} onPause={onPause} />

      <div className="relative">
        {children}

        <AnimatePresence>
          {state.status === "paused" && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={fadeIn(reduced)}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/95 backdrop-blur"
            >
              <PauseIcon className="h-10 w-10 text-kids-primary" aria-hidden="true" />
              <p className="font-heading text-xl font-bold">{t("kids.games.paused")}</p>
              <div className="flex gap-2">
                <Button onClick={onResume} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
                  <Play className="h-4 w-4" aria-hidden="true" /> {t("kids.games.resume")}
                </Button>
                <Button variant="outline" onClick={onRestart} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.games.restart")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
