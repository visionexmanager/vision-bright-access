import { useCallback, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import type { Game } from "@/features/visionkids/types/games.types";

export interface QuizRound {
  /** The question as it is read out. Already-localized text, or a plain
   *  string like "7 × 8" that needs no translation. */
  prompt: string;
  /** Answer choices, in the order they should be shown. */
  options: string[];
  /** Must be one of `options`. */
  answer: string;
  /** Optional extra line under the prompt (a fact, a hint, a clue). */
  detail?: string;
}

export interface QuizGameProps {
  game: Game;
  /** Builds one round. Called once per question, so it may be random. */
  buildRound: () => QuizRound;
  /** Correct answers needed to win. */
  winTarget?: number;
  timeLimitSeconds?: number;
  startingLives?: number;
  /** Points added per correct answer. */
  pointsPerCorrect?: number;
  /** Instruction line above the question, already localized. */
  instruction: string;
  /** Renders the prompt as something richer than text (a shape, a swatch). */
  renderPrompt?: (round: QuizRound) => React.ReactNode;
  /** Column count for the answer grid. Two reads better for long options. */
  optionColumns?: 1 | 2;
}

/**
 * The shared multiple-choice engine behind the quiz-shaped VisionKids games.
 *
 * Eight of the launch games are "read a prompt, pick one of four" with
 * different content — planets, capitals, times tables, letters. They were
 * each a placeholder; building them as one engine plus a data module keeps
 * them from being eight near-identical copies that drift apart.
 *
 * Every answer is a real <button> in a list, so the whole game is keyboard
 * operable, and the result of each answer is announced through a live region
 * rather than shown only as a colour change.
 */
export function QuizGame({
  game,
  buildRound,
  winTarget = 10,
  timeLimitSeconds = 60,
  startingLives = 3,
  pointsPerCorrect = 10,
  instruction,
  renderPrompt,
  optionColumns = 2,
}: QuizGameProps) {
  const { t } = useLanguage();
  const [round, setRound] = useState<QuizRound>(() => buildRound());
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");

  const { state, start, pause, resume, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives,
    hasTimer: true,
    timeLimitSeconds,
  });

  const nextRound = useCallback(() => {
    setRound(buildRound());
    setPicked(null);
  }, [buildRound]);

  const handleStart = () => {
    setCorrect(0);
    setFeedback("");
    nextRound();
    start();
  };

  const pick = (option: string) => {
    if (picked) return;
    setPicked(option);

    if (option === round.answer) {
      addScore(pointsPerCorrect);
      const total = correct + 1;
      setCorrect(total);
      setFeedback(t("kids.games.answerCorrect"));
      window.setTimeout(() => {
        if (total >= winTarget) finish({ won: true, isPerfectScore: state.lives === startingLives });
        else nextRound();
      }, 600);
    } else {
      loseLife();
      setFeedback(`${t("kids.games.answerWrong")} ${round.answer}`);
      window.setTimeout(nextRound, 900);
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
      resultSummary={
        <p className="text-sm text-muted-foreground">
          {t("kids.games.correctAnswers")}: {correct}/{winTarget}
        </p>
      }
    >
      <div className="rounded-2xl border-2 border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{instruction}</p>

        {renderPrompt ? (
          renderPrompt(round)
        ) : (
          <p className="mt-2 font-heading text-3xl font-extrabold">{round.prompt}</p>
        )}

        {round.detail && <p className="mt-2 text-sm text-muted-foreground">{round.detail}</p>}

        <ul className={`mt-6 grid gap-3 ${optionColumns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {round.options.map((option) => {
            const isAnswer = option === round.answer;
            const isPicked = option === picked;
            const tone = !picked
              ? "border-border hover:border-kids-primary/60"
              : isAnswer
                ? "border-kids-green bg-kids-green/10"
                : isPicked
                  ? "border-destructive bg-destructive/10"
                  : "border-border opacity-60";
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  disabled={!!picked}
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-base font-semibold transition-colors ${tone}`}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 min-h-5 text-sm font-medium" role="status">{feedback}</p>

        <p className="mt-1 text-xs text-muted-foreground">
          {t("kids.games.correctAnswers")}: {correct}/{winTarget}
        </p>
      </div>
    </GameShell>
  );
}

