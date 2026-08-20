import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Eye, Play, RotateCcw, RotateCcwSquare, RotateCwSquare, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useLanguage } from "@/contexts/LanguageContext";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";
import { useArcadeAccessibility } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import {
  BUBBLE_SHOOTER_CONFIG,
  ROW_HEIGHT,
  aim,
  boardHeight,
  boardWidth,
  cellCentre,
  colorName,
  columnsInRow,
  createBubbleShooterState,
  describeBubbleBoard,
  fire,
  remainingBubbles,
  simulateShot,
  startBubbleShooter,
  type BubbleShooterConfig,
} from "@/lib/games/bubbleShooterEngine";

/** Colour plus glyph: a colour-matching game must not rely on colour alone. */
const FACES: Record<number, { className: string; glyph: string }> = {
  1: { className: "bg-rose-500 text-rose-50", glyph: "●" },
  2: { className: "bg-amber-400 text-amber-950", glyph: "▲" },
  3: { className: "bg-emerald-400 text-emerald-950", glyph: "■" },
  4: { className: "bg-sky-400 text-sky-950", glyph: "◆" },
  5: { className: "bg-violet-400 text-violet-950", glyph: "★" },
};

const AIM_STEP = 3;

export default function BubbleShooter({ config = BUBBLE_SHOOTER_CONFIG, seed }: { config?: BubbleShooterConfig; seed?: number } = {}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const { announce } = useArcadeAccessibility();
  const sounds = useGameSounds();
  const paused = useArcadePaused();

  const [state, setState] = useState(() => createBubbleShooterState(seed ?? Date.now(), config));
  const [showPath, setShowPath] = useState(true);
  const fieldRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);

  const finished = state.status === "over" || state.status === "won";
  const width = boardWidth(config);
  const height = boardHeight(config) + 1.6;
  const percentX = (value: number) => `${(value / width) * 100}%`;
  const percentY = (value: number) => `${(value / height) * 100}%`;

  const begin = useCallback(() => {
    setState(startBubbleShooter);
    fieldRef.current?.focus();
  }, []);

  const reset = useCallback(() => {
    settledRef.current = false;
    setState(startBubbleShooter(createBubbleShooterState(seed ?? Date.now(), config)));
    fieldRef.current?.focus();
    announce(ar ? "لوحة جديدة." : "New board.", "assertive");
  }, [announce, ar, config, seed]);

  const nudge = useCallback((delta: number) => {
    setState((current) => {
      const next = aim(startBubbleShooter(current), current.angle + delta);
      if (next.angle !== current.angle) sounds.arcadeMove();
      return next;
    });
  }, [sounds]);

  const shoot = useCallback(() => {
    setState((current) => {
      if (current.status === "ready") return fire(startBubbleShooter(current));
      return fire(current);
    });
    fieldRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.score > 0) gameManager.recordScore(state.score);
  }, [state.score]);

  useEffect(() => {
    if (!state.events.length) return;
    if (state.events.includes("pop")) sounds.arcadePickup();
    else if (state.events.includes("land")) sounds.arcadeMove();
    if (state.events.includes("drop")) sounds.arcadeLevelUp();
    if (state.events.includes("row")) {
      sounds.arcadeDanger();
      announce(ar ? "نزل صف جديد." : "A new row dropped in.", "assertive");
    }
  }, [announce, ar, sounds, state.events]);

  useEffect(() => {
    if (!finished || settledRef.current) return;
    settledRef.current = true;
    if (state.status === "won") {
      sounds.arcadeVictory();
      announce(ar ? `تم تنظيف اللوحة! ${state.score} نقطة.` : `Board cleared with ${state.score} points.`, "assertive");
      void settleGameResult("win", "Bubble Shooter");
    } else {
      sounds.arcadeCrash();
      announce(ar ? `انتهت اللعبة. ${state.score} نقطة.` : `Game over with ${state.score} points.`, "assertive");
      void settleGameResult("loss", "Bubble Shooter");
    }
  }, [announce, ar, finished, settleGameResult, sounds, state.score, state.status]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 1 : AIM_STEP;
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") { event.preventDefault(); return nudge(-step); }
    if (key === "ArrowRight" || key === "d" || key === "D") { event.preventDefault(); return nudge(step); }
    if (key === " " || key === "Enter" || key === "ArrowUp") {
      event.preventDefault();
      if (finished) reset(); else shoot();
      return;
    }
    if (key.toLowerCase() === "b") {
      event.preventDefault();
      announce(describeBubbleBoard(state), "assertive");
    }
  }, [announce, finished, nudge, reset, shoot, state]);

  /** Aiming with a finger or the mouse points the launcher at the pointer. */
  const aimAtPointer = (clientX: number, clientY: number) => {
    const box = fieldRef.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    const x = ((clientX - box.left) / box.width) * width;
    const y = ((clientY - box.top) / box.height) * height;
    const angle = (Math.atan2(x - width / 2, Math.max(0.5, height - 0.8 - y)) * 180) / Math.PI;
    setState((current) => aim(current, angle));
  };

  const preview = useMemo(() => (showPath && !finished ? simulateShot(state) : null), [finished, showPath, state]);

  const bubbles = useMemo(() => {
    const list: { key: string; x: number; y: number; colour: number }[] = [];
    for (let row = 0; row < config.rows; row += 1) {
      for (let column = 0; column < columnsInRow(config, row); column += 1) {
        const colour = state.grid[row][column];
        if (!colour) continue;
        const { x, y } = cellCentre(config, { row, column });
        list.push({ key: `${row},${column}`, x, y, colour });
      }
    }
    return list;
  }, [config, state.grid]);

  const summary = describeBubbleBoard(state);
  const dangerRow = (config.rows - 1) * ROW_HEIGHT + 0.5;

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="bubble-heading">
      <h2 id="bubble-heading" className="sr-only">{ar ? "لعبة رماية الفقاعات" : "Bubble Shooter"}</h2>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "النقاط" : "Score"}</dt>
            <dd className="text-xl font-black tabular-nums">{state.score.toLocaleString(lang)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "الفقاعات" : "Bubbles"}</dt>
            <dd className="font-bold tabular-nums">{remainingBubbles(state)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="flex items-center gap-1 text-muted-foreground"><Target className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "قبل صف جديد" : "Until a new row"}</dt>
            <dd className="font-bold tabular-nums">{Math.max(0, config.shotsPerRow - state.shotsSincePop)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-pressed={showPath} onClick={() => setShowPath((value) => !value)}>
            <Eye className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "خط التصويب" : "Aim line"}
          </Button>
          {state.status === "ready" && (
            <Button type="button" onClick={begin}><Play className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "ابدأ" : "Start"}</Button>
          )}
          {finished && (
            <Button type="button" onClick={reset}><RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "لوحة جديدة" : "Play again"}</Button>
          )}
        </div>
      </header>

      <div className="flex justify-center">
      <div
        ref={fieldRef}
        tabIndex={0}
        role="img"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onPointerMove={(event) => aimAtPointer(event.clientX, event.clientY)}
        onPointerDown={(event) => { fieldRef.current?.focus(); aimAtPointer(event.clientX, event.clientY); }}
        onPointerUp={() => { if (!finished) shoot(); }}
        className="relative touch-none overflow-hidden rounded-2xl bg-slate-950 outline-none ring-offset-2 ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300"
        style={{
          aspectRatio: `${width} / ${height}`,
          // Driving the width keeps the aspect exact: a max-height clamp would
          // squash the bubbles into ellipses on a narrow screen.
          width: `min(100%, calc(${(width / height).toFixed(4)} * min(68vh, 34rem)))`,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-rose-400/60"
          style={{ top: percentY(dangerRow) }}
        />

        {preview?.path.length ? (
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline
              points={preview.path.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="rgba(103,232,249,.55)"
              strokeWidth="0.08"
              strokeDasharray="0.25 0.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}

        {preview?.cell ? (
          <span
            aria-hidden="true"
            className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-cyan-300/70 text-[10px] text-cyan-200"
            style={{
              left: percentX(cellCentre(config, preview.cell).x),
              top: percentY(cellCentre(config, preview.cell).y),
              width: percentX(1),
              height: percentY(1),
            }}
          />
        ) : null}

        {bubbles.map((bubble) => {
          const face = FACES[bubble.colour] ?? FACES[1];
          return (
            <span
              key={bubble.key}
              aria-hidden="true"
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[max(7px,1vw)] leading-none ${face.className}`}
              style={{ left: percentX(bubble.x), top: percentY(bubble.y), width: percentX(0.94), height: percentY(0.94) }}
            >
              {face.glyph}
            </span>
          );
        })}

        <span
          aria-hidden="true"
          className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-white text-[max(7px,1vw)] ${(FACES[state.loaded] ?? FACES[1]).className}`}
          style={{ left: percentX(width / 2), top: percentY(height - 0.8), width: percentX(0.94), height: percentY(0.94) }}
        >
          {(FACES[state.loaded] ?? FACES[1]).glyph}
        </span>
      </div>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm text-muted-foreground">
        {paused
          ? (ar ? "اللعبة متوقفة مؤقتاً." : "Paused.")
          : state.status === "won"
            ? (ar ? `تم تنظيف اللوحة! ${state.score} نقطة.` : `Board cleared with ${state.score} points.`)
            : state.status === "over"
              ? (ar ? `انتهت اللعبة. ${state.score} نقطة.` : `Game over with ${state.score} points.`)
              : summary}
      </p>

      <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2" role="group" aria-label={ar ? "أزرار التصويب" : "Aim controls"}>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "صوّب يساراً" : "Aim left"} onClick={() => nudge(-AIM_STEP)}><RotateCcwSquare className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" className="h-14" aria-label={ar ? "أطلق" : "Fire"} onClick={() => (finished ? reset() : shoot())}>
          <Crosshair className="me-2 h-5 w-5" aria-hidden="true" />{finished ? (ar ? "جديد" : "New") : (ar ? "أطلق" : "Fire")}
        </Button>
        <Button type="button" variant="secondary" className="h-14" aria-label={ar ? "صوّب يميناً" : "Aim right"} onClick={() => nudge(AIM_STEP)}><RotateCwSquare className="h-5 w-5" aria-hidden="true" /></Button>
      </div>

      <p className="text-center text-sm">
        <span className="text-muted-foreground">{ar ? "التالية:" : "Next up:"}</span>{" "}
        <span className={`ms-2 inline-grid h-6 w-6 place-items-center rounded-full align-middle text-xs ${(FACES[state.queued] ?? FACES[1]).className}`} aria-hidden="true">
          {(FACES[state.queued] ?? FACES[1]).glyph}
        </span>{" "}
        <span className="font-semibold">{colorName(state.queued)}</span>
      </p>

      <details className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{ar ? "طريقة اللعب والتحكم" : "How to play and controls"}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{ar ? "الأسهم يمين ويسار تحرك زاوية التصويب ثلاث درجات، ومع Shift درجة واحدة." : "Left and right move the aim by three degrees, or by one with Shift held."}</li>
          <li>{ar ? "مسافة أو Enter أو سهم أعلى تطلق الفقاعة." : "Space, Enter or Up fires the bubble."}</li>
          <li>{ar ? "حرك المؤشر أو إصبعك للتصويب، وارفعه للإطلاق." : "Move the pointer or your finger to aim, and lift it to fire."}</li>
          <li>{ar ? "حرف B ينطق الحالة: اللون المحمّل وأين تهبط الطلقة وكم فقاعة ستنفجر." : "Press B to hear the colour you are holding, where the shot lands, and how many bubbles it would pop."}</li>
          <li>{ar ? "ثلاث فقاعات متصلة بنفس اللون تنفجر، وما يفقد سنده يسقط ويمنح نقاطاً مضاعفة." : "Three connected bubbles of a colour pop, and anything that loses its support falls for double points."}</li>
          <li>{ar ? "الارتداد عن الجدران يصل إلى أهداف مغطاة، والخط المنقط يوضح المسار." : "Banking off the walls reaches covered targets; the dotted line shows the path."}</li>
          <li>{ar ? "كل ست طلقات دون انفجار تُنزل صفاً جديداً. الخط الأحمر هو خط الخسارة." : "Six shots without a pop drops a new row in. The red line is the losing line."}</li>
        </ul>
      </details>
    </section>
  );
}
