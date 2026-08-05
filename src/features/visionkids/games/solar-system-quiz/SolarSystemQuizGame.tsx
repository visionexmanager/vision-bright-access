import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, optionsWithAnswer, shuffle, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { PLANETS, PLANET_NAMES } from "@/features/visionkids/games/_shared/space.data";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Rotates through four question shapes over the same planet data, so the
 * quiz keeps asking something new rather than becoming a memorised list:
 * position from the Sun, moon count, rocky vs gas, and which of two is
 * closer to the Sun.
 */
function buildRound(t: (key: string) => string): QuizRound {
  const kind = Math.floor(Math.random() * 4);
  const planet = shuffle(PLANETS)[0];

  if (kind === 0) {
    const answer = String(planet.order);
    return {
      prompt: planet.name,
      detail: t("kids.games.whichPositionDetail"),
      answer,
      options: optionsWithAnswer(answer, PLANETS.map((p) => String(p.order))),
    };
  }

  if (kind === 1) {
    const answer = String(planet.moons);
    return {
      prompt: planet.name,
      detail: t("kids.games.howManyMoonsDetail"),
      answer,
      options: optionsWithAnswer(answer, PLANETS.map((p) => String(p.moons))),
    };
  }

  if (kind === 2) {
    const answer = planet.kind === "rocky" ? t("kids.games.planetRocky") : t("kids.games.planetGas");
    return {
      prompt: planet.name,
      detail: t("kids.games.rockyOrGasDetail"),
      answer,
      options: shuffle([t("kids.games.planetRocky"), t("kids.games.planetGas")]),
    };
  }

  const [a, b] = shuffle(PLANETS).slice(0, 2);
  const closer = a.order < b.order ? a : b;
  return {
    prompt: `${a.name} · ${b.name}`,
    detail: t("kids.games.whichIsCloserDetail"),
    answer: closer.name,
    options: shuffle([a.name, b.name]),
  };
}

export function SolarSystemQuizGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(() => buildRound(t), [t])}
      instruction={t("kids.games.solarSystemInstruction")}
      winTarget={10}
      timeLimitSeconds={90}
    />
  );
}

export default SolarSystemQuizGame;
