import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, optionsWithAnswer, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import type { Game } from "@/features/visionkids/types/games.types";

/** Times tables 2..9. Distractors are near-misses (off-by-one row/column and
 *  a digit swap) rather than random numbers, so guessing by size alone does
 *  not work. */
function buildRound(): QuizRound {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const answer = a * b;

  const nearMisses = new Set<number>([
    (a + 1) * b,
    a * (b + 1),
    Math.max(1, (a - 1) * b),
    Math.max(1, a * (b - 1)),
    answer + 10,
    Math.max(1, answer - 10),
  ]);
  nearMisses.delete(answer);

  return {
    prompt: `${a} × ${b}`,
    answer: String(answer),
    options: optionsWithAnswer(String(answer), [...nearMisses].map(String)),
  };
}

export function MultiplicationHeroGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(buildRound, [])}
      instruction={t("kids.games.solveTheProduct")}
      winTarget={10}
      timeLimitSeconds={75}
    />
  );
}

export default MultiplicationHeroGame;
