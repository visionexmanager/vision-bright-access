import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, optionsWithAnswer, shuffle, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { CAPITALS, CONTINENTS, COUNTRIES, COUNTRY_NAMES } from "@/features/visionkids/games/_shared/geography.data";
import type { Game } from "@/features/visionkids/types/games.types";

/** Three question shapes over the same country data: capital of, country of
 *  a capital, and which continent. Distinct from flag-quiz, which asks only
 *  "whose flag is this". */
function buildRound(t: (key: string) => string): QuizRound {
  const kind = Math.floor(Math.random() * 3);
  const entry = shuffle(COUNTRIES)[0];

  if (kind === 0) {
    return {
      prompt: entry.country,
      detail: t("kids.games.whichCapitalDetail"),
      answer: entry.capital,
      options: optionsWithAnswer(entry.capital, CAPITALS),
    };
  }

  if (kind === 1) {
    return {
      prompt: entry.capital,
      detail: t("kids.games.whichCountryDetail"),
      answer: entry.country,
      options: optionsWithAnswer(entry.country, COUNTRY_NAMES),
    };
  }

  return {
    prompt: entry.country,
    detail: t("kids.games.whichContinentDetail"),
    answer: entry.continent,
    options: optionsWithAnswer(entry.continent, CONTINENTS),
  };
}

export function GeographyQuizGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(() => buildRound(t), [t])}
      instruction={t("kids.games.geographyInstruction")}
      winTarget={10}
      timeLimitSeconds={90}
    />
  );
}

export default GeographyQuizGame;
