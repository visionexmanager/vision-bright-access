import { useCallback, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { shuffle } from "@/features/visionkids/games/_shared/QuizGame";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Copy the picture onto your own grid.
 *
 * A freehand drawing game cannot be played without sight or a pointer, and it
 * cannot be scored automatically either. Copying a pattern cell by cell keeps
 * the drawing idea — look at a shape, reproduce it — while staying fully
 * keyboard operable and objectively checkable. Each cell announces its row,
 * column, and whether it is filled.
 */
const SIZE = 5;

interface Pattern {
  nameKey: string;
  /** Row strings; "#" is filled. */
  rows: string[];
}

const PATTERNS: Pattern[] = [
  { nameKey: "kids.games.patternHeart", rows: [".#.#.", "#####", "#####", ".###.", "..#.."] },
  { nameKey: "kids.games.patternHouse", rows: ["..#..", ".###.", "#####", "#.#.#", "#.#.#"] },
  { nameKey: "kids.games.patternTree", rows: ["..#..", ".###.", "#####", "..#..", "..#.."] },
  { nameKey: "kids.games.patternSmile", rows: [".....", ".#.#.", ".....", "#...#", ".###."] },
  { nameKey: "kids.games.patternArrow", rows: ["..#..", ".###.", "#.#.#", "..#..", "..#.."] },
  { nameKey: "kids.games.patternCross", rows: ["..#..", "..#..", "#####", "..#..", "..#.."] },
];

function toCells(rows: string[]): boolean[] {
  return rows.join("").split("").map((c) => c === "#");
}

const ROUNDS = 4;

export function DrawingChallengeGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [pattern, setPattern] = useState<Pattern>(() => shuffle(PATTERNS)[0]);
  const [canvas, setCanvas] = useState<boolean[]>(() => Array(SIZE * SIZE).fill(false));
  const [completed, setCompleted] = useState(0);
  const [message, setMessage] = useState("");

  const { state, start, pause, resume, addScore, finish } = useGameSession({
    game,
    hasTimer: true,
    timeLimitSeconds: 240,
  });

  const target = useMemo(() => toCells(pattern.rows), [pattern]);

  const nextPattern = useCallback((exclude: Pattern) => {
    const next = shuffle(PATTERNS.filter((p) => p.nameKey !== exclude.nameKey))[0] ?? exclude;
    setPattern(next);
    setCanvas(Array(SIZE * SIZE).fill(false));
  }, []);

  const handleStart = () => {
    const first = shuffle(PATTERNS)[0];
    setPattern(first);
    setCanvas(Array(SIZE * SIZE).fill(false));
    setCompleted(0);
    setMessage("");
    start();
  };

  const toggle = (index: number) => {
    if (state.status !== "playing") return;

    const next = [...canvas];
    next[index] = !next[index];
    setCanvas(next);

    if (next.every((v, i) => v === target[i])) {
      addScore(50);
      const total = completed + 1;
      setCompleted(total);
      setMessage(t("kids.games.pictureMatched"));
      window.setTimeout(() => {
        if (total >= ROUNDS) finish({ won: true, isPerfectScore: true });
        else { nextPattern(pattern); setMessage(""); }
      }, 800);
    }
  };

  const filledCount = canvas.filter(Boolean).length;
  const targetCount = target.filter(Boolean).length;

  return (
    <GameShell
      game={game}
      state={state}
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.picturesCopied")}: {completed}/{ROUNDS}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-center text-sm text-muted-foreground">{t("kids.games.drawingInstruction")}</p>
        <p className="mt-1 text-center font-heading text-lg font-bold">{t(pattern.nameKey)}</p>

        <div className="mt-4 flex flex-wrap items-start justify-center gap-6">
          <div>
            <h3 className="mb-2 text-center text-xs font-semibold uppercase text-muted-foreground">
              {t("kids.games.copyThis")}
            </h3>
            <div role="img" aria-label={t(pattern.nameKey)} className="grid w-fit grid-cols-5 gap-1">
              {target.map((filled, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`h-9 w-9 rounded-md border-2 ${filled ? "border-kids-primary bg-kids-primary" : "border-border bg-card"}`}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-center text-xs font-semibold uppercase text-muted-foreground">
              {t("kids.games.yourPicture")}
            </h3>
            <div role="grid" aria-label={t("kids.games.yourPicture")} className="grid w-fit grid-cols-5 gap-1">
              {canvas.map((filled, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={filled}
                  aria-label={`${t("kids.games.rowLabel")} ${Math.floor(i / SIZE) + 1}, ${t("kids.games.columnLabel")} ${(i % SIZE) + 1}: ${filled ? t("kids.games.cellFilled") : t("kids.games.cellEmpty")}`}
                  className={`h-9 w-9 rounded-md border-2 transition-colors ${
                    filled ? "border-kids-pink bg-kids-pink" : "border-border bg-card hover:border-kids-pink/60"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-sm" role="status">
          {t("kids.games.cellsFilled")}: {filledCount}/{targetCount}
        </p>
        <p className="mt-1 min-h-5 text-center text-sm font-medium" role="status">{message}</p>
      </div>
    </GameShell>
  );
}

export default DrawingChallengeGame;
