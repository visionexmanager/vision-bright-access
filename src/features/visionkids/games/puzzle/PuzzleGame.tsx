import { useCallback, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * A 3x3 sliding-tile puzzle. Tiles carry numbers rather than slices of a
 * picture: a number says where it belongs out loud, so the board can be read
 * by a screen reader, and arrow keys move the blank — the same control scheme
 * the maze game already uses.
 */
const SIZE = 3;
const TILES = SIZE * SIZE;
const SOLVED = [...Array(TILES - 1).keys()].map((n) => n + 1).concat(0);

type Board = number[];

function isSolved(board: Board): boolean {
  return board.every((v, i) => v === SOLVED[i]);
}

/** Shuffles by walking the blank backwards from the solved state, which can
 *  only ever produce a solvable board — a plain shuffle is unsolvable half
 *  the time. */
function scramble(moves = 60): Board {
  const board = [...SOLVED];
  let blank = TILES - 1;
  for (let i = 0; i < moves; i++) {
    const options = neighbours(blank);
    const target = options[Math.floor(Math.random() * options.length)];
    [board[blank], board[target]] = [board[target], board[blank]];
    blank = target;
  }
  return isSolved(board) ? scramble(moves) : board;
}

function neighbours(index: number): number[] {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const out: number[] = [];
  if (row > 0) out.push(index - SIZE);
  if (row < SIZE - 1) out.push(index + SIZE);
  if (col > 0) out.push(index - 1);
  if (col < SIZE - 1) out.push(index + 1);
  return out;
}

export function PuzzleGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [board, setBoard] = useState<Board>(() => scramble());
  const [moves, setMoves] = useState(0);

  const { state, start, pause, resume, addScore, finish } = useGameSession({
    game,
    hasTimer: true,
    timeLimitSeconds: 240,
  });

  const handleStart = () => {
    setBoard(scramble());
    setMoves(0);
    start();
  };

  const slide = useCallback(
    (tileIndex: number) => {
      if (state.status !== "playing") return;
      const blank = board.indexOf(0);
      if (!neighbours(blank).includes(tileIndex)) return;

      const next = [...board];
      [next[blank], next[tileIndex]] = [next[tileIndex], next[blank]];
      setBoard(next);
      setMoves((m) => m + 1);

      if (isSolved(next)) {
        // Fewer moves is a better solve; 60 is a generous par for a 60-step
        // scramble, and the floor keeps a slow solve from scoring nothing.
        addScore(Math.max(20, 200 - moves * 2));
        finish({ won: true, isPerfectScore: moves < 40 });
      }
    },
    [addScore, board, finish, moves, state.status]
  );

  /** Arrow keys move the tile *into* the blank, which is what "press up"
   *  means to a player looking at the board. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const blank = board.indexOf(0);
    const map: Record<string, number> = {
      ArrowUp: blank + SIZE,
      ArrowDown: blank - SIZE,
      ArrowLeft: blank + 1,
      ArrowRight: blank - 1,
    };
    const target = map[e.key];
    if (target === undefined) return;
    e.preventDefault();
    if (target >= 0 && target < TILES && neighbours(blank).includes(target)) slide(target);
  };

  return (
    <GameShell
      game={game}
      state={state}
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.movesUsed")}: {moves}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">{t("kids.games.puzzleInstruction")}</p>

        <div
          role="grid"
          aria-label={t("kids.games.puzzleBoard")}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="mx-auto mt-4 grid w-fit grid-cols-3 gap-2 rounded-xl p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-kids-primary"
        >
          {board.map((value, index) => (
            <button
              key={index}
              type="button"
              onClick={() => slide(index)}
              disabled={value === 0}
              aria-label={
                value === 0
                  ? t("kids.games.emptySlot")
                  : `${value}${value === SOLVED[index] ? ` — ${t("kids.games.inPlace")}` : ""}`
              }
              className={`flex h-20 w-20 items-center justify-center rounded-xl border-2 text-2xl font-extrabold transition-colors ${
                value === 0
                  ? "border-dashed border-border bg-transparent"
                  : value === SOLVED[index]
                    ? "border-kids-green bg-kids-green/10"
                    : "border-border bg-muted hover:border-kids-primary/60"
              }`}
            >
              {value === 0 ? "" : value}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">{t("kids.games.puzzleKeyboardHint")}</p>
        <p className="mt-1 text-center text-sm" role="status">{t("kids.games.movesUsed")}: {moves}</p>
      </div>
    </GameShell>
  );
}

export default PuzzleGame;
