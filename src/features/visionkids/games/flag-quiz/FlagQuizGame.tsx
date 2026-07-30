import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { FLAGS, type FlagEntry } from "@/features/visionkids/games/flag-quiz/flags.data";
import type { Game } from "@/features/visionkids/types/games.types";

const ROUNDS = 8;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(): { entry: FlagEntry; options: string[] } {
  const shuffled = shuffle(FLAGS);
  const entry = shuffled[0];
  const options = shuffle(shuffled.slice(0, 4).map((f) => f.name));
  return { entry, options };
}

export function FlagQuizGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const [round, setRound] = useState(() => buildRound());
  const [roundNumber, setRoundNumber] = useState(1);
  const [feedback, setFeedback] = useState<{ option: string; correct: boolean } | null>(null);

  const { state, start, pause, resume, restart, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
  });

  const nextRound = useCallback(() => {
    setRound(buildRound());
    setFeedback(null);
  }, []);

  const handleStart = () => {
    setRoundNumber(1);
    nextRound();
    start();
  };

  const answer = (option: string) => {
    if (feedback) return;
    const correct = option === round.entry.name;
    setFeedback({ option, correct });
    if (correct) addScore(10);
    else loseLife();

    window.setTimeout(() => {
      if (roundNumber >= ROUNDS) finish({ won: true, isPerfectScore: state.lives === 3 });
      else {
        setRoundNumber((n) => n + 1);
        nextRound();
      }
    }, 700);
  };

  return (
    <GameShell
      game={game}
      state={state}
      hasLives
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.round")} {Math.min(roundNumber, ROUNDS)}/{ROUNDS}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-8 text-center">
        <p className="mb-2 text-sm text-muted-foreground">{t("kids.games.round")} {roundNumber}/{ROUNDS}</p>
        <AnimatePresence mode="wait">
          <motion.p key={round.entry.flag + roundNumber} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)} className="text-7xl" aria-label={t("kids.games.whichCountry")}>
            {round.entry.flag}
          </motion.p>
        </AnimatePresence>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {round.options.map((option) => {
            const isFeedback = feedback?.option === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => answer(option)}
                disabled={!!feedback}
                className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start font-semibold transition-colors ${
                  isFeedback && feedback.correct ? "border-kids-green bg-kids-green/10" : isFeedback ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"
                }`}
              >
                {option}
                {isFeedback && (feedback.correct ? <CheckCircle2 className="h-5 w-5 text-kids-green" aria-hidden="true" /> : <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />)}
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}

export default FlagQuizGame;
