import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizGame, type QuizRound } from "@/features/visionkids/games/_shared/QuizGame";
import { optionsWithAnswer, shuffle } from "@/features/visionkids/games/_shared/quizHelpers";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * "Which word starts with this letter?" Latin letters only — the Arabic
 * alphabet needs its own letterforms and word list rather than a translated
 * copy of this one, which is a separate game rather than a string swap.
 */
const WORDS: Record<string, string[]> = {
  A: ["Apple", "Ant", "Arrow"],
  B: ["Ball", "Bear", "Boat"],
  C: ["Cat", "Cake", "Cloud"],
  D: ["Dog", "Drum", "Door"],
  E: ["Egg", "Elephant", "Eagle"],
  F: ["Fish", "Flower", "Fox"],
  G: ["Goat", "Grapes", "Guitar"],
  H: ["Hat", "Horse", "House"],
  I: ["Ice", "Island", "Insect"],
  J: ["Jam", "Jug", "Jacket"],
  K: ["Kite", "Key", "Koala"],
  L: ["Lion", "Leaf", "Lamp"],
  M: ["Moon", "Mouse", "Map"],
  N: ["Nest", "Nose", "Nut"],
  O: ["Orange", "Owl", "Ocean"],
  P: ["Pen", "Panda", "Pear"],
  Q: ["Queen", "Quilt", "Question"],
  R: ["Rain", "Rabbit", "Ring"],
  S: ["Sun", "Star", "Snake"],
  T: ["Tree", "Tiger", "Train"],
  U: ["Umbrella", "Unicorn", "Uncle"],
  V: ["Van", "Violin", "Vase"],
  W: ["Water", "Whale", "Window"],
  X: ["Xylophone", "X-ray", "Box"],
  Y: ["Yarn", "Yacht", "Yogurt"],
  Z: ["Zebra", "Zip", "Zoo"],
};

const LETTERS = Object.keys(WORDS);

function buildRound(): QuizRound {
  const letter = shuffle(LETTERS)[0];
  const answer = shuffle(WORDS[letter])[0];
  const others = LETTERS.filter((l) => l !== letter).flatMap((l) => WORDS[l]);
  return {
    prompt: letter,
    answer,
    options: optionsWithAnswer(answer, others),
  };
}

export function AlphabetAdventureGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <QuizGame
      game={game}
      buildRound={useCallback(buildRound, [])}
      instruction={t("kids.games.whichWordStartsWith")}
      winTarget={10}
      timeLimitSeconds={75}
      renderPrompt={(round) => (
        <p className="mt-2 font-heading text-6xl font-extrabold text-kids-primary">{round.prompt}</p>
      )}
    />
  );
}

export default AlphabetAdventureGame;
