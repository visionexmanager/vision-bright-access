import { useCallback, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, Undo2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Build a program, then run it — the first idea in programming that is worth
 * teaching: the robot does not move as you press, it moves when you run the
 * whole list. Commands are queued into a visible sequence the child can undo
 * and re-run, so a wrong answer is a program to fix rather than a life lost.
 */
const SIZE = 5;

type Direction = "up" | "down" | "left" | "right";

const STEPS: Record<Direction, { dr: number; dc: number; icon: typeof ArrowUp; labelKey: string }> = {
  up: { dr: -1, dc: 0, icon: ArrowUp, labelKey: "kids.games.moveUp" },
  down: { dr: 1, dc: 0, icon: ArrowDown, labelKey: "kids.games.moveDown" },
  left: { dr: 0, dc: -1, icon: ArrowLeft, labelKey: "kids.games.moveLeft" },
  right: { dr: 0, dc: 1, icon: ArrowRight, labelKey: "kids.games.moveRight" },
};

interface Level {
  start: [number, number];
  goal: [number, number];
  walls: string[];
}

function buildLevel(index: number): Level {
  // Deterministic per level number so a level is the same puzzle for everyone,
  // with the goal moving further away as the child progresses.
  const distance = Math.min(SIZE - 1, 2 + index);
  const start: [number, number] = [SIZE - 1, 0];
  const goal: [number, number] = [SIZE - 1 - distance, Math.min(SIZE - 1, distance)];

  const walls: string[] = [];
  for (let i = 0; i < index && i < 4; i++) {
    const r = (i * 2 + 1) % SIZE;
    const c = (i * 3 + 2) % SIZE;
    const key = `${r}-${c}`;
    if (key !== `${start[0]}-${start[1]}` && key !== `${goal[0]}-${goal[1]}`) walls.push(key);
  }
  return { start, goal, walls };
}

export function CodingPuzzleGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [levelIndex, setLevelIndex] = useState(0);
  const [level, setLevel] = useState<Level>(() => buildLevel(0));
  const [program, setProgram] = useState<Direction[]>([]);
  const [robot, setRobot] = useState<[number, number]>(() => buildLevel(0).start);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const { state, start, pause, resume, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
    hasTimer: true,
    timeLimitSeconds: 300,
  });

  const loadLevel = useCallback((index: number) => {
    const next = buildLevel(index);
    setLevel(next);
    setRobot(next.start);
    setProgram([]);
    setLevelIndex(index);
  }, []);

  const handleStart = () => {
    loadLevel(0);
    setMessage("");
    start();
  };

  const run = useCallback(async () => {
    if (state.status !== "playing" || isRunning || program.length === 0) return;
    setIsRunning(true);

    let [r, c] = level.start;
    setRobot([r, c]);

    for (const command of program) {
      const step = STEPS[command];
      const nr = r + step.dr;
      const nc = c + step.dc;
      const blocked = nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || level.walls.includes(`${nr}-${nc}`);
      if (!blocked) { r = nr; c = nc; }
      setRobot([r, c]);
      // Paced so the child can watch each step happen rather than see a jump.
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    }

    setIsRunning(false);

    if (r === level.goal[0] && c === level.goal[1]) {
      addScore(30);
      setMessage(t("kids.games.robotReachedGoal"));
      if (levelIndex >= 4) {
        finish({ won: true, isPerfectScore: state.lives === 3 });
      } else {
        window.setTimeout(() => { loadLevel(levelIndex + 1); setMessage(""); }, 700);
      }
    } else {
      loseLife();
      setMessage(t("kids.games.robotMissedGoal"));
      window.setTimeout(() => { setRobot(level.start); setProgram([]); }, 700);
    }
  }, [addScore, finish, isRunning, level, levelIndex, loadLevel, loseLife, program, state.lives, state.status, t]);

  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE] as const);

  return (
    <GameShell
      game={game}
      state={state}
      hasLives
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.levelsCleared")}: {levelIndex}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-center text-sm text-muted-foreground">{t("kids.games.codingInstruction")}</p>

        <div role="grid" aria-label={t("kids.games.codingBoard")} className="mx-auto mt-4 grid w-fit grid-cols-5 gap-1">
          {cells.map(([r, c]) => {
            const isRobot = robot[0] === r && robot[1] === c;
            const isGoal = level.goal[0] === r && level.goal[1] === c;
            const isWall = level.walls.includes(`${r}-${c}`);
            const label = isRobot
              ? t("kids.games.robotHere")
              : isGoal
                ? t("kids.games.goalHere")
                : isWall
                  ? t("kids.games.wallHere")
                  : t("kids.games.emptySlot");
            return (
              <div
                key={`${r}-${c}`}
                role="gridcell"
                aria-label={`${t("kids.games.rowLabel")} ${r + 1}, ${t("kids.games.columnLabel")} ${c + 1}: ${label}`}
                className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl ${
                  isWall ? "border-border bg-muted" : "border-border bg-card"
                }`}
              >
                <span aria-hidden="true">{isRobot ? "🤖" : isGoal ? "⭐" : isWall ? "🧱" : ""}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(Object.keys(STEPS) as Direction[]).map((dir) => {
            const Icon = STEPS[dir].icon;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => setProgram((p) => [...p, dir])}
                disabled={isRunning}
                aria-label={t(STEPS[dir].labelKey)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border hover:border-kids-primary/60 disabled:opacity-50"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setProgram((p) => p.slice(0, -1))}
            disabled={isRunning || program.length === 0}
            aria-label={t("kids.games.undoStep")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border hover:border-kids-primary/60 disabled:opacity-50"
          >
            <Undo2 className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={isRunning || program.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-kids-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("kids.games.runProgram")}
          </button>
        </div>

        <p className="mt-3 text-center text-sm" role="status">
          {t("kids.games.yourProgram")}: {program.length === 0 ? t("kids.games.programEmpty") : program.map((d) => t(STEPS[d].labelKey)).join(" → ")}
        </p>
        <p className="mt-1 min-h-5 text-center text-sm font-medium" role="status">{message}</p>
      </div>
    </GameShell>
  );
}

export default CodingPuzzleGame;
