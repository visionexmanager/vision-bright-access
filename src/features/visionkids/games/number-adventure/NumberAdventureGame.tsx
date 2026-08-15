import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { optionsWithAnswer } from "@/features/visionkids/games/_shared/quizHelpers";
import type { Game } from "@/features/visionkids/types/games.types";

/** "What comes next?" over three patterns a 3-5 year old meets first:
 *  counting up, counting down, and skip-counting by 2, 5 or 10. */
function buildRound(): QuizRound {
  const kind = Math.floor(Math.random() * 3);
  const step = kind === 2 ? [2, 5, 10][Math.floor(Math.random() * 3)] : 1;
  const direction = kind === 1 ? -1 : 1;
  const start = direction === -1 ? 10 + Math.floor(Math.random() * 20) : 1 + Math.floor(Math.random() * 20);

  const shown = [0, 1, 2].map((i) => start + direction * step * i);
  const answer = start + direction * step * 3;

  const distractors = [answer + step, answer - step, answer + direction * step * 2, answer + 1]
    .filter((n) => n > 0 && n !== answer);

  return {
    prompt: `${shown.join(" · ")} · ?`,
    answer: String(answer),
    options: optionsWithAnswer(String(answer), distractors.map(String)),
  };
}

export function NumberAdventureGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(buildRound, [])}
      instruction={t("kids.games.whatComesNext")}
      winTarget={8}
      timeLimitSeconds={75}
    />
  );
}

export default NumberAdventureGame;
