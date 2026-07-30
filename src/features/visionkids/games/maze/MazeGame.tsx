import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { MAZES } from "@/features/visionkids/games/maze/mazes.data";
import type { Game } from "@/features/visionkids/types/games.types";

function parseMaze(rows: string[]) {
  let start = { r: 1, c: 1 };
  let exit = { r: 1, c: 1 };
  const grid = rows.map((row, r) =>
    row.split("").map((cell, c) => {
      if (cell === "S") start = { r, c };
      if (cell === "E") exit = { r, c };
      return cell === "#";
    })
  );
  return { grid, start, exit };
}

export function MazeGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const difficulty = game.difficulty;
  const { grid, start, exit } = useMemo(() => parseMaze(MAZES[difficulty]), [difficulty]);

  const [pos, setPos] = useState(start);
  const [hintPulse, setHintPulse] = useState(false);

  const { state, start: startEngine, pause, resume, restart, addScore, consumeHint, finish } = useGameSession({ game, hasHints: true, startingHints: 3 });
  // move() is called from a keydown listener that only re-subscribes when
  // state.status changes (see the effect below) — a ref mirror keeps the
  // elapsedSeconds/hints it reads for the win bonus from going stale
  // between those re-subscriptions.
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleStart = () => { setPos(start); startEngine(); };

  const move = (dr: number, dc: number) => {
    if (stateRef.current.status !== "playing") return;
    setPos((prev) => {
      const nr = prev.r + dr;
      const nc = prev.c + dc;
      if (grid[nr]?.[nc]) return prev; // wall
      if (nr === exit.r && nc === exit.c) {
        const bonus = Math.max(0, 200 - stateRef.current.elapsedSeconds * 2);
        addScore(bonus);
        window.setTimeout(() => finish({ won: true, isPerfectScore: stateRef.current.hints === 3 }), 0);
      }
      return { r: nr, c: nc };
    });
  };

  useEffect(() => {
    if (state.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
      };
      const delta = map[e.key];
      if (delta) { e.preventDefault(); move(delta[0], delta[1]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, grid]);

  const handleHint = () => {
    if (!consumeHint()) return;
    setHintPulse(true);
    window.setTimeout(() => setHintPulse(false), 1500);
  };

  return (
    <GameShell game={game} state={state} hasHints onStart={handleStart} onPause={pause} onResume={resume} onRestart={handleStart} onHint={handleHint}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="grid gap-0.5 rounded-xl border-2 border-border bg-card p-2"
          style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1.6rem))` }}
          role="img"
          aria-label={t("kids.games.mazeBoard")}
        >
          {grid.map((row, r) =>
            row.map((isWall, c) => {
              const isPlayer = pos.r === r && pos.c === c;
              const isExit = exit.r === r && exit.c === c;
              return (
                <div
                  key={`${r}-${c}`}
                  className={`h-6 w-6 rounded-sm ${
                    isWall ? "bg-foreground/20" : isExit ? `bg-kids-green/40 ${hintPulse ? "animate-pulse ring-2 ring-kids-green" : ""}` : "bg-muted"
                  } flex items-center justify-center text-xs`}
                >
                  {isPlayer ? "🧒" : isExit ? "🚪" : ""}
                </div>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-3 gap-1" role="group" aria-label={t("kids.games.mazeControls")}>
          <span />
          <button type="button" onClick={() => move(-1, 0)} className="rounded-lg border-2 border-border p-2 hover:bg-muted" aria-label={t("kids.games.moveUp")}><ArrowUp className="h-5 w-5" aria-hidden="true" /></button>
          <span />
          <button type="button" onClick={() => move(0, -1)} className="rounded-lg border-2 border-border p-2 hover:bg-muted" aria-label={t("kids.games.moveLeft")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => move(1, 0)} className="rounded-lg border-2 border-border p-2 hover:bg-muted" aria-label={t("kids.games.moveDown")}><ArrowDown className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => move(0, 1)} className="rounded-lg border-2 border-border p-2 hover:bg-muted" aria-label={t("kids.games.moveRight")}><ArrowRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{t("kids.games.mazeKeyboardHint")}</p>
      </div>
    </GameShell>
  );
}

export default MazeGame;
