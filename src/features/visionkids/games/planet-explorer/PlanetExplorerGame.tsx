import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { optionsWithAnswer, shuffle } from "@/features/visionkids/games/_shared/quizHelpers";
import { PLANETS, PLANET_NAMES } from "@/features/visionkids/games/_shared/space.data";
import type { Game } from "@/features/visionkids/types/games.types";

/** "Which planet is this?" from its distinguishing fact. */
function buildRound(): QuizRound {
  const planet = shuffle(PLANETS)[0];
  return {
    prompt: planet.emoji,
    detail: planet.fact,
    answer: planet.name,
    options: optionsWithAnswer(planet.name, PLANET_NAMES),
  };
}

export function PlanetExplorerGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(buildRound, [])}
      instruction={t("kids.games.whichPlanet")}
      winTarget={8}
      timeLimitSeconds={90}
      renderPrompt={(round) => (
        <p className="mt-2 text-5xl" aria-hidden="true">{round.prompt}</p>
      )}
    />
  );
}

export default PlanetExplorerGame;
