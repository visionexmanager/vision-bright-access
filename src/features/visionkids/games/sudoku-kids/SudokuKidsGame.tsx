import { useCallback, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { shuffle } from "@/features/visionkids/games/_shared/quizHelpers";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * 4x4 sudoku — the child-sized version: digits 1-4, four 2x2 boxes. Puzzles
 * are generated rather than listed, by permuting the digits of a valid base
 * grid and then removing cells, so the game never repeats the same board.
 */
const BASE: number[][] = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

type Grid = number[][];

function generateSolution(): Grid {
  const digits = shuffle([1, 2, 3, 4]);
  const map = new Map(BASE[0].map((d, i) => [d, digits[i]]));
  const rowsWithinBand = Math.random() < 0.5;
  const grid = BASE.map((row) => row.map((v) => map.get(v)!));
  if (rowsWithinBand) {
    [grid[0], grid[1]] = [grid[1], grid[0]];
    [grid[2], grid[3]] = [grid[3], grid[2]];
  }
  return grid;
}

/** Removes 8 of the 16 cells — enough to be a puzzle, few enough that a
 *  4-7 year old can finish it without guesswork. */
function generatePuzzle(): { puzzle: Grid; solution: Grid } {
  const solution = generateSolution();
  const puzzle = solution.map((row) => [...row]);
  const cells = shuffle([...Array(16).keys()]).slice(0, 8);
  for (const cell of cells) puzzle[Math.floor(cell / 4)][cell % 4] = 0;
  return { puzzle, solution };
}

export function SudokuKidsGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [{ puzzle, solution }, setBoards] = useState(generatePuzzle);
  const [grid, setGrid] = useState<Grid>(() => puzzle.map((r) => [...r]));
  const [selected, setSelected] = useState<[number, number]>([0, 0]);
  const [message, setMessage] = useState("");

  const { state, start, pause, resume, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
    hasTimer: true,
    timeLimitSeconds: 300,
  });

  const handleStart = () => {
    const fresh = generatePuzzle();
    setBoards(fresh);
    setGrid(fresh.puzzle.map((r) => [...r]));
    setSelected([0, 0]);
    setMessage("");
    start();
  };

  const isGiven = useCallback((r: number, c: number) => puzzle[r][c] !== 0, [puzzle]);

  const place = useCallback(
    (value: number) => {
      if (state.status !== "playing") return;
      const [r, c] = selected;
      if (isGiven(r, c)) return;

      if (solution[r][c] !== value) {
        loseLife();
        setMessage(t("kids.games.notQuiteTryAnother"));
        return;
      }

      const next = grid.map((row) => [...row]);
      next[r][c] = value;
      setGrid(next);
      addScore(10);
      setMessage(t("kids.games.answerCorrect"));

      if (next.every((row, ri) => row.every((v, ci) => v === solution[ri][ci]))) {
        finish({ won: true, isPerfectScore: state.lives === 3 });
      }
    },
    [addScore, finish, grid, loseLife, selected, solution, state.lives, state.status, t, isGiven]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const [r, c] = selected;
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected([Math.max(0, r - 1), c]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected([Math.min(3, r + 1), c]); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); setSelected([r, Math.max(0, c - 1)]); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); setSelected([r, Math.min(3, c + 1)]); return; }
    if (["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); place(Number(e.key)); }
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
    >
      <div className="rounded-2xl border-2 border-border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">{t("kids.games.sudokuInstruction")}</p>

        <div
          role="grid"
          aria-label={t("kids.games.sudokuBoard")}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="mx-auto mt-4 grid w-fit grid-cols-4 gap-1 rounded-xl p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-kids-primary"
        >
          {grid.map((row, r) =>
            row.map((value, c) => {
              const isSelected = selected[0] === r && selected[1] === c;
              const given = isGiven(r, c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => setSelected([r, c])}
                  aria-label={`${t("kids.games.rowLabel")} ${r + 1}, ${t("kids.games.columnLabel")} ${c + 1}: ${value === 0 ? t("kids.games.emptySlot") : value}`}
                  aria-pressed={isSelected}
                  className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 text-2xl font-extrabold ${
                    isSelected ? "border-kids-primary ring-2 ring-kids-primary/40" : "border-border"
                  } ${given ? "bg-muted text-muted-foreground" : "bg-card"} ${
                    // The 2x2 boxes get a heavier inner edge so the regions read visually.
                    c === 1 ? "me-1" : ""
                  } ${r === 1 ? "mb-1" : ""}`}
                >
                  {value === 0 ? "" : value}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => place(n)}
              className="h-12 w-12 rounded-xl border-2 border-border text-xl font-bold hover:border-kids-primary/60"
            >
              {n}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">{t("kids.games.sudokuKeyboardHint")}</p>
        <p className="mt-1 min-h-5 text-center text-sm font-medium" role="status">{message}</p>
      </div>
    </GameShell>
  );
}

export default SudokuKidsGame;
