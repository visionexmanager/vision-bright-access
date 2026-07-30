import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import type { Game } from "@/features/visionkids/types/games.types";

const WIN_TARGET = 10;

interface Problem {
  question: string;
  answer: number;
  options: number[];
}

function generateProblem(difficulty: Game["difficulty"]): Problem {
  const max = difficulty === "easy" ? 10 : difficulty === "medium" ? 20 : 50;
  const op = ["+", "-", "×"][Math.floor(Math.random() * (difficulty === "easy" ? 2 : 3))];
  let a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  if (op === "×") { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; }
  if (op === "-" && a < b) [a, b] = [b, a];

  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const delta = Math.floor(Math.random() * 9) - 4;
    const candidate = answer + delta;
    if (candidate >= 0 && candidate !== answer) options.add(candidate);
  }
  return { question: `${a} ${op} ${b}`, answer, options: [...options].sort(() => Math.random() - 0.5) };
}

export function MathChallengeGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const [problem, setProblem] = useState<Problem>(() => generateProblem(game.difficulty));
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<{ option: number; correct: boolean } | null>(null);

  const { state, start, pause, resume, restart, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
    hasTimer: true,
    timeLimitSeconds: 60,
  });

  const nextProblem = useCallback(() => {
    setProblem(generateProblem(game.difficulty));
    setFeedback(null);
  }, [game.difficulty]);

  const handleStart = () => {
    setCorrectCount(0);
    nextProblem();
    start();
  };

  const answer = (option: number) => {
    if (feedback) return;
    const correct = option === problem.answer;
    setFeedback({ option, correct });
    if (correct) {
      addScore(10);
      const total = correctCount + 1;
      setCorrectCount(total);
      window.setTimeout(() => {
        if (total >= WIN_TARGET) finish({ won: true, isPerfectScore: state.lives === 3 });
        else nextProblem();
      }, 500);
    } else {
      window.setTimeout(() => { loseLife(); nextProblem(); }, 500);
    }
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
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.correctAnswers")}: {correctCount}/{WIN_TARGET}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-8 text-center">
        <p className="mb-1 text-sm text-muted-foreground">{correctCount}/{WIN_TARGET} {t("kids.games.correctAnswers")}</p>
        <AnimatePresence mode="wait">
          <motion.p key={problem.question} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)} className="font-heading text-4xl font-extrabold">
            {problem.question} = ?
          </motion.p>
        </AnimatePresence>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {problem.options.map((option) => {
            const isFeedback = feedback?.option === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => answer(option)}
                disabled={!!feedback}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 font-heading text-2xl font-bold transition-colors ${
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

export default MathChallengeGame;
