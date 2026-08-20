import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Ear, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useLanguage } from "@/contexts/LanguageContext";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadeGameLoop, useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";
import { useArcadeAccessibility } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import {
  BLOCK_STACKER_CONFIG,
  PIECES,
  createBlockStackerState,
  describeBlockStackerBoard,
  dropIntervalMs,
  ghostPiece,
  hardDrop,
  moveHorizontally,
  pieceCells,
  rotatePiece,
  startBlockStacker,
  stepDown,
  type BlockStackerConfig,
} from "@/lib/games/blockStackerEngine";

/**
 * One face per shape. The glyph matters as much as the colour: a player with
 * low colour vision still has to be able to tell a locked cell from the piece
 * that is still falling.
 */
const FACES = [
  { className: "bg-cyan-400 text-cyan-950", glyph: "▰" },
  { className: "bg-amber-400 text-amber-950", glyph: "▣" },
  { className: "bg-violet-400 text-violet-950", glyph: "▲" },
  { className: "bg-emerald-400 text-emerald-950", glyph: "◤" },
  { className: "bg-rose-400 text-rose-950", glyph: "◥" },
  { className: "bg-sky-300 text-sky-950", glyph: "◆" },
  { className: "bg-orange-300 text-orange-950", glyph: "◇" },
];

export default function BlockStacker({ config = BLOCK_STACKER_CONFIG, seed }: { config?: BlockStackerConfig; seed?: number } = {}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const { announce } = useArcadeAccessibility();
  const sounds = useGameSounds();
  const paused = useArcadePaused();

  const [state, setState] = useState(() => createBlockStackerState(seed ?? Date.now(), config));
  const [showGhost, setShowGhost] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);

  const running = state.status === "running";
  const over = state.status === "over";

  const begin = useCallback(() => {
    setState(startBlockStacker);
    boardRef.current?.focus();
  }, []);

  const reset = useCallback(() => {
    settledRef.current = false;
    setState(startBlockStacker(createBlockStackerState(seed ?? Date.now(), config)));
    boardRef.current?.focus();
    announce(ar ? "لعبة جديدة." : "New game.", "assertive");
  }, [announce, ar, config, seed]);

  // Gravity. The shared loop stops itself while the shell is paused.
  useArcadeGameLoop(() => setState(stepDown), dropIntervalMs(state), running);

  useEffect(() => {
    if (state.score > 0) gameManager.recordScore(state.score);
  }, [state.score]);

  useEffect(() => {
    gameManager.recordLevel(state.level);
  }, [state.level]);

  useEffect(() => {
    if (!state.events.length) return;
    if (state.events.includes("clear")) {
      sounds.arcadePickup();
      announce(
        state.lastCleared > 1
          ? (ar ? `${state.lastCleared} صفوف دفعة واحدة!` : `${state.lastCleared} rows at once!`)
          : (ar ? "صف مكتمل." : "Row cleared."),
      );
    } else if (state.events.includes("lock")) sounds.arcadeMove();
    if (state.events.includes("level")) {
      sounds.arcadeLevelUp();
      announce(ar ? `المستوى ${state.level}. زادت السرعة.` : `Level ${state.level}. The pieces fall faster.`, "assertive");
    }
  }, [announce, ar, sounds, state.events, state.lastCleared, state.level]);

  useEffect(() => {
    if (!over || settledRef.current) return;
    settledRef.current = true;
    sounds.arcadeCrash();
    announce(ar ? `انتهت اللعبة. ${state.score} نقطة.` : `Game over with ${state.score} points.`, "assertive");
    // There is no winning end state in an endless stacker: the run is the score.
    void settleGameResult(state.rowsCleared >= config.rowsPerLevel ? "win" : "loss", "Block Stacker");
  }, [announce, ar, config.rowsPerLevel, over, settleGameResult, sounds, state.rowsCleared, state.score]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const key = event.key;
    const act = (fn: (previous: typeof state) => typeof state) => {
      event.preventDefault();
      if (state.status === "ready") begin();
      setState((current) => {
        const next = fn(current);
        if (next !== current) sounds.arcadeMove();
        return next;
      });
    };

    if (key === "ArrowLeft" || key === "a" || key === "A") return act((current) => moveHorizontally(current, -1));
    if (key === "ArrowRight" || key === "d" || key === "D") return act((current) => moveHorizontally(current, 1));
    if (key === "ArrowDown" || key === "s" || key === "S") return act(stepDown);
    if (key === "ArrowUp" || key === "w" || key === "W" || key === "x" || key === "X") return act(rotatePiece);
    if (key === " ") return act(hardDrop);
    if (key === "Enter") {
      event.preventDefault();
      if (over) reset(); else begin();
      return;
    }
    if (key.toLowerCase() === "b") {
      event.preventDefault();
      announce(describeBlockStackerBoard(state), "assertive");
    }
  }, [announce, begin, over, reset, sounds, state]);

  const control = (fn: (previous: typeof state) => typeof state) => () => {
    if (state.status === "ready") begin();
    setState((current) => {
      const next = fn(current);
      if (next !== current) sounds.arcadeMove();
      return next;
    });
    boardRef.current?.focus();
  };

  const cells = useMemo(() => {
    const active = new Map<string, number>();
    if (state.piece) for (const [x, y] of pieceCells(state.piece)) active.set(`${x},${y}`, state.piece.shapeIndex + 1);

    const landing = new Set<string>();
    const ghost = showGhost && running ? ghostPiece(state) : null;
    if (ghost) for (const [x, y] of pieceCells(ghost)) if (!active.has(`${x},${y}`)) landing.add(`${x},${y}`);

    return state.grid.flatMap((row, y) =>
      row.map((locked, x) => ({
        key: `${x},${y}`,
        value: active.get(`${x},${y}`) ?? locked,
        falling: active.has(`${x},${y}`),
        landing: landing.has(`${x},${y}`),
      })),
    );
  }, [running, showGhost, state]);

  const summary = describeBlockStackerBoard(state);
  const nextCells = PIECES[state.nextShapeIndex].rotations[0];
  const nextWidth = Math.max(...nextCells.map(([x]) => x)) + 1;
  const nextHeight = Math.max(...nextCells.map(([, y]) => y)) + 1;

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="stacker-heading">
      <h2 id="stacker-heading" className="sr-only">{ar ? "لعبة تكديس القطع" : "Block Stacker"}</h2>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "النقاط" : "Score"}</dt>
            <dd className="text-xl font-black tabular-nums">{state.score.toLocaleString(lang)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "المستوى" : "Level"}</dt>
            <dd className="font-bold tabular-nums">{state.level}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "الصفوف" : "Rows"}</dt>
            <dd className="font-bold tabular-nums">{state.rowsCleared}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-pressed={showGhost} onClick={() => setShowGhost((value) => !value)}>
            <Ear className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "معاينة الهبوط" : "Landing preview"}
          </Button>
          {state.status === "ready" && (
            <Button type="button" onClick={begin}><Play className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "ابدأ" : "Start"}</Button>
          )}
          {over && (
            <Button type="button" onClick={reset}><RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "لعبة جديدة" : "Play again"}</Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div
          ref={boardRef}
          tabIndex={0}
          role="img"
          aria-label={summary}
          onKeyDown={onKeyDown}
          className="grid flex-1 touch-none gap-[2px] rounded-2xl bg-slate-950 p-2 outline-none ring-offset-2 ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300"
          style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => {
            const face = cell.value ? FACES[(cell.value - 1) % FACES.length] : null;
            return (
              <span
                key={cell.key}
                aria-hidden="true"
                className={`grid aspect-square place-items-center rounded-[3px] text-[max(7px,1.1vw)] leading-none sm:rounded-md sm:text-xs ${
                  face ? `${face.className} ${cell.falling ? "ring-2 ring-white" : ""}` : cell.landing ? "bg-white/10 ring-1 ring-cyan-300/60" : "bg-white/[.04]"
                }`}
              >
                {face ? face.glyph : cell.landing ? "·" : ""}
              </span>
            );
          })}
        </div>

        <aside className="flex w-full shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:block sm:w-24" aria-label={ar ? "القطعة التالية" : "Next piece"}>
          <p className="text-xs font-semibold text-muted-foreground sm:mb-2">{ar ? "التالي" : "Next"}</p>
          <div className="grid w-14 gap-[2px] sm:w-auto" style={{ gridTemplateColumns: `repeat(${nextWidth}, minmax(0, 1fr))` }} aria-hidden="true">
            {Array.from({ length: nextWidth * nextHeight }, (_, index) => {
              const x = index % nextWidth;
              const y = Math.floor(index / nextWidth);
              const filled = nextCells.some(([cx, cy]) => cx === x && cy === y);
              const face = FACES[state.nextShapeIndex % FACES.length];
              return (
                <span key={index} className={`grid aspect-square place-items-center rounded-[3px] text-[10px] ${filled ? face.className : "bg-transparent"}`}>
                  {filled ? face.glyph : ""}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground sm:mt-2">{PIECES[state.nextShapeIndex].id}</p>
        </aside>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm text-muted-foreground">
        {paused
          ? (ar ? "اللعبة متوقفة مؤقتاً." : "Paused.")
          : over
            ? (ar ? `انتهت اللعبة. ${state.score} نقطة و${state.rowsCleared} صفاً.` : `Game over with ${state.score} points and ${state.rowsCleared} rows.`)
            : state.status === "ready"
              ? (ar ? "الأسهم للتحريك، أعلى للتدوير، مسافة للإسقاط، B لوصف اللوحة." : "Arrows move, Up rotates, Space drops, B describes the board.")
              : summary}
      </p>

      <div className="mx-auto grid w-full max-w-sm grid-cols-4 gap-2" role="group" aria-label={ar ? "أزرار التحكم" : "Piece controls"}>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "يسار" : "Move left"} onClick={control((current) => moveHorizontally(current, -1))}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "تدوير" : "Rotate"} onClick={control(rotatePiece)}><RotateCw className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "نزول خطوة" : "Soft drop"} onClick={control(stepDown)}><ArrowDown className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "يمين" : "Move right"} onClick={control((current) => moveHorizontally(current, 1))}><ArrowRight className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="col-span-4 h-14" aria-label={ar ? "إسقاط سريع" : "Hard drop"} onClick={control(hardDrop)}><ChevronsDown className="me-2 h-5 w-5" aria-hidden="true" />{ar ? "إسقاط" : "Drop"}</Button>
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{ar ? "طريقة اللعب والتحكم" : "How to play and controls"}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{ar ? "الأسهم يمين ويسار للتحريك، سهم أعلى أو X للتدوير، سهم أسفل لنزول خطوة." : "Left and right move, Up or X rotates, Down drops the piece one row."}</li>
          <li>{ar ? "مسافة تُسقط القطعة فوراً وتمنح نقاطاً على المسافة." : "Space drops the piece straight down and pays for the distance."}</li>
          <li>{ar ? "حرف B ينطق حالة اللوحة: القطعة الحالية وأعمدتها وأين ستهبط والقطعة التالية." : "Press B to hear the board: the piece, its columns, where it lands, and what comes next."}</li>
          <li>{ar ? "أكمل صفاً ليُمسح. أربعة صفوف دفعة واحدة تساوي أكثر بكثير من أربعة صفوف منفردة." : "Complete a row to clear it. Four rows at once are worth far more than four separate rows."}</li>
          <li>{ar ? `كل ${config.rowsPerLevel} صفوف ترفع المستوى وتسرّع السقوط.` : `Every ${config.rowsPerLevel} rows raises the level and speeds the fall.`}</li>
          <li>{ar ? "التدوير بجوار الجدار يزيح القطعة تلقائياً بدل رفض الحركة." : "Rotating against a wall nudges the piece across instead of refusing the turn."}</li>
        </ul>
      </details>
    </section>
  );
}
