import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { optionsWithAnswer, shuffle } from "@/features/visionkids/games/_shared/quizHelpers";
import type { Game } from "@/features/visionkids/types/games.types";

/** Each shape is drawn as inline SVG rather than an emoji so it stays crisp
 *  at any size and carries no font-dependent rendering surprises. */
const SHAPES = [
  { key: "circle", labelKey: "kids.games.shapeCircle", path: <circle cx="50" cy="50" r="38" /> },
  { key: "square", labelKey: "kids.games.shapeSquare", path: <rect x="14" y="14" width="72" height="72" rx="4" /> },
  { key: "triangle", labelKey: "kids.games.shapeTriangle", path: <polygon points="50,12 88,84 12,84" /> },
  { key: "rectangle", labelKey: "kids.games.shapeRectangle", path: <rect x="8" y="28" width="84" height="44" rx="4" /> },
  { key: "star", labelKey: "kids.games.shapeStar", path: <polygon points="50,8 61,38 93,38 67,57 77,88 50,69 23,88 33,57 7,38 39,38" /> },
  { key: "heart", labelKey: "kids.games.shapeHeart", path: <path d="M50 86 L16 52 A20 20 0 0 1 50 26 A20 20 0 0 1 84 52 Z" /> },
  { key: "diamond", labelKey: "kids.games.shapeDiamond", path: <polygon points="50,10 90,50 50,90 10,50" /> },
  { key: "oval", labelKey: "kids.games.shapeOval", path: <ellipse cx="50" cy="50" rx="42" ry="28" /> },
];

function buildRound(t: (key: string) => string): QuizRound {
  const shape = shuffle(SHAPES)[0];
  const name = t(shape.labelKey);
  return {
    prompt: shape.key,
    answer: name,
    options: optionsWithAnswer(name, SHAPES.map((s) => t(s.labelKey))),
  };
}

export function ShapeMatchingGame({ game }: { game: Game }) {
  const { t } = useLanguage();

  return (
    <QuizGame
      game={game}
      buildRound={useCallback(() => buildRound(t), [t])}
      instruction={t("kids.games.whichShape")}
      winTarget={10}
      timeLimitSeconds={60}
      renderPrompt={(round) => {
        const shape = SHAPES.find((s) => s.key === round.prompt);
        if (!shape) return null;
        return (
          <svg
            viewBox="0 0 100 100"
            className="mx-auto mt-3 h-32 w-32 fill-kids-primary"
            role="img"
            aria-label={t("kids.games.shapeOnScreen")}
          >
            {shape.path}
          </svg>
        );
      }}
    />
  );
}

export default ShapeMatchingGame;
