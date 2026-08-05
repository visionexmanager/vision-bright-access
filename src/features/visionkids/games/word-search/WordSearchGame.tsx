import { useCallback, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { shuffle } from "@/features/visionkids/games/_shared/QuizGame";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Word search on an 8x8 grid.
 *
 * Selection is "pick the first letter, then pick the last letter" rather than
 * a drag: a drag is unusable with a keyboard and unreliable on a small
 * touchscreen, and two taps express the same straight line. Words are placed
 * horizontally and vertically only — diagonals are hard to scan at this age
 * and impossible to describe cleanly to a screen reader.
 */
const SIZE = 8;
const WORD_POOL = ["CAT", "DOG", "SUN", "MOON", "STAR", "FISH", "BIRD", "TREE", "BOOK", "RAIN", "BLUE", "PLAY"];
const WORDS_PER_ROUND = 5;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface Placement {
  word: string;
  cells: number[];
}

function buildGrid(): { grid: string[]; placements: Placement[] } {
  const grid: string[] = Array(SIZE * SIZE).fill("");
  const placements: Placement[] = [];

  for (const word of shuffle(WORD_POOL).slice(0, WORDS_PER_ROUND)) {
    // 40 attempts is plenty for 5 short words on 64 cells; giving up on a
    // word is better than looping forever on an unlucky layout.
    for (let attempt = 0; attempt < 40; attempt++) {
      const horizontal = Math.random() < 0.5;
      const maxStart = SIZE - word.length;
      if (maxStart < 0) break;
      const line = Math.floor(Math.random() * SIZE);
      const offset = Math.floor(Math.random() * (maxStart + 1));

      const cells = [...word].map((_, i) =>
        horizontal ? line * SIZE + offset + i : (offset + i) * SIZE + line
      );

      const fits = cells.every((cell, i) => grid[cell] === "" || grid[cell] === word[i]);
      if (!fits) continue;

      cells.forEach((cell, i) => { grid[cell] = word[i]; });
      placements.push({ word, cells });
      break;
    }
  }

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === "") grid[i] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }

  return { grid, placements };
}

/** The straight run between two cells, or null if they are not on one line. */
function runBetween(from: number, to: number): number[] | null {
  const fromRow = Math.floor(from / SIZE);
  const fromCol = from % SIZE;
  const toRow = Math.floor(to / SIZE);
  const toCol = to % SIZE;

  if (fromRow === toRow) {
    const [a, b] = fromCol <= toCol ? [fromCol, toCol] : [toCol, fromCol];
    return Array.from({ length: b - a + 1 }, (_, i) => fromRow * SIZE + a + i);
  }
  if (fromCol === toCol) {
    const [a, b] = fromRow <= toRow ? [fromRow, toRow] : [toRow, fromRow];
    return Array.from({ length: b - a + 1 }, (_, i) => (a + i) * SIZE + fromCol);
  }
  return null;
}

export function WordSearchGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [board, setBoard] = useState(buildGrid);
  const [found, setFound] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const { state, start, pause, resume, addScore, finish } = useGameSession({
    game,
    hasTimer: true,
    timeLimitSeconds: 180,
  });

  const foundCells = useMemo(
    () => new Set(board.placements.filter((p) => found.includes(p.word)).flatMap((p) => p.cells)),
    [board.placements, found]
  );

  const handleStart = () => {
    setBoard(buildGrid());
    setFound([]);
    setAnchor(null);
    setMessage("");
    start();
  };

  const tap = useCallback(
    (index: number) => {
      if (state.status !== "playing") return;

      if (anchor === null) {
        setAnchor(index);
        setMessage(t("kids.games.nowPickLastLetter"));
        return;
      }

      if (anchor === index) {
        setAnchor(null);
        setMessage("");
        return;
      }

      const run = runBetween(anchor, index);
      setAnchor(null);

      if (!run) {
        setMessage(t("kids.games.mustBeStraightLine"));
        return;
      }

      const forward = run.map((c) => board.grid[c]).join("");
      const backward = [...forward].reverse().join("");
      const hit = board.placements.find(
        (p) => !found.includes(p.word) && (p.word === forward || p.word === backward)
      );

      if (!hit) {
        setMessage(t("kids.games.notAWord"));
        return;
      }

      const nextFound = [...found, hit.word];
      setFound(nextFound);
      addScore(20);
      setMessage(`${t("kids.games.answerCorrect")} ${hit.word}`);

      if (nextFound.length >= board.placements.length) {
        finish({ won: true, isPerfectScore: true });
      }
    },
    [addScore, anchor, board.grid, board.placements, finish, found, state.status, t]
  );

  return (
    <GameShell
      game={game}
      state={state}
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={
        <p className="text-sm text-muted-foreground">
          {t("kids.games.wordsFound")}: {found.length}/{board.placements.length}
        </p>
      }
    >
      <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-center text-sm text-muted-foreground">{t("kids.games.wordSearchInstruction")}</p>

        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {board.placements.map((p) => (
            <li
              key={p.word}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                found.includes(p.word)
                  ? "border-kids-green bg-kids-green/10 line-through"
                  : "border-border"
              }`}
            >
              {p.word}
            </li>
          ))}
        </ul>

        <div role="grid" aria-label={t("kids.games.wordSearchBoard")} className="mx-auto mt-4 grid w-fit grid-cols-8 gap-1">
          {board.grid.map((letter, index) => {
            const isFound = foundCells.has(index);
            const isAnchor = anchor === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => tap(index)}
                aria-label={`${t("kids.games.rowLabel")} ${Math.floor(index / SIZE) + 1}, ${t("kids.games.columnLabel")} ${(index % SIZE) + 1}: ${letter}`}
                aria-pressed={isAnchor}
                className={`flex h-9 w-9 items-center justify-center rounded-md border-2 text-sm font-bold sm:h-11 sm:w-11 sm:text-base ${
                  isFound
                    ? "border-kids-green bg-kids-green/15"
                    : isAnchor
                      ? "border-kids-primary ring-2 ring-kids-primary/40"
                      : "border-border hover:border-kids-primary/50"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <p className="mt-3 min-h-5 text-center text-sm font-medium" role="status">{message}</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {t("kids.games.wordsFound")}: {found.length}/{board.placements.length}
        </p>
      </div>
    </GameShell>
  );
}

export default WordSearchGame;
