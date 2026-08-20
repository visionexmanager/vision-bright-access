import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ear, Gauge, Play, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useLanguage } from "@/contexts/LanguageContext";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadeGameLoop, useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";
import { useArcadeAccessibility } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import {
  SNAKE_CONFIG,
  createSnakeState,
  describeSnakeBoard,
  dangerAhead,
  queueTurn,
  startSnake,
  stepDurationMs,
  stepSnake,
  type Direction,
  type SnakeConfig,
  type SnakeState,
} from "@/lib/games/snakeEngine";

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

type CellKind = "empty" | "head" | "body" | "tail" | "food" | "wall";

/** Colour alone never carries meaning: every kind has its own glyph and ring. */
const CELL_STYLE: Record<CellKind, { className: string; glyph: string; label: string }> = {
  empty: { className: "bg-white/[.04]", glyph: "", label: "empty" },
  head:  { className: "bg-cyan-300 text-slate-950 ring-2 ring-white", glyph: "◆", label: "snake head" },
  body:  { className: "bg-violet-500 text-white", glyph: "●", label: "snake body" },
  tail:  { className: "bg-violet-700 text-white", glyph: "○", label: "snake tail" },
  food:  { className: "bg-amber-300 text-slate-950 ring-2 ring-amber-100", glyph: "✦", label: "food" },
  wall:  { className: "bg-slate-500 text-slate-900 ring-1 ring-slate-300", glyph: "▩", label: "wall" },
};

/**
 * Both props exist because the engine is seeded and configurable, and both are
 * worth reaching from outside: `seed` replays an exact reported round, and
 * `config` sets the round shape — board size, target, speed ramp, when walls
 * start. The Arcade loader renders this with no props, so ordinary play gets a
 * fresh random round on SNAKE_CONFIG.
 */
export default function Snake({ config = SNAKE_CONFIG, seed }: { config?: SnakeConfig; seed?: number } = {}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const { announce } = useArcadeAccessibility();
  const sounds = useGameSounds();
  const paused = useArcadePaused();

  const [state, setState] = useState(() => createSnakeState(seed ?? Date.now(), config));
  const [best, setBest] = useState(0);
  const [audioGuide, setAudioGuide] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const dangerAnnouncedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const size = state.config.size;
  const running = state.status === "running";
  const finished = state.status === "over" || state.status === "won";

  const turn = useCallback((direction: Direction) => {
    setState((current) => {
      const next = queueTurn(current, direction);
      if (next !== current) sounds.arcadeMove();
      return next;
    });
  }, [sounds]);

  const begin = useCallback(() => {
    setState((current) => startSnake(current));
    boardRef.current?.focus();
  }, []);

  const reset = useCallback(() => {
    settledRef.current = false;
    dangerAnnouncedRef.current = false;
    setState(startSnake(createSnakeState(seed ?? Date.now(), config)));
    boardRef.current?.focus();
    announce(ar ? "جولة جديدة. ابدأ التحرك." : "New round. Start moving.", "assertive");
  }, [announce, ar, config, seed]);

  // One tick of play. The shared loop stops itself while the shell is paused,
  // which the old implementation did not do: it kept moving behind the overlay.
  useArcadeGameLoop(() => setState(stepSnake), stepDurationMs(state), running);

  // Score, level and audio feedback follow the engine rather than duplicating it.
  useEffect(() => {
    if (state.score <= 0) return;
    gameManager.recordScore(state.score);
    setBest((current) => Math.max(current, state.score));
  }, [state.score]);

  useEffect(() => {
    gameManager.recordLevel(state.level);
  }, [state.level]);

  useEffect(() => {
    if (state.lastGain <= 0) return;
    sounds.arcadePickup();
    if (audioGuide) announce(ar ? `أكلت. ${state.score} نقطة.` : `Eaten. ${state.score} points.`);
  }, [announce, ar, audioGuide, sounds, state.lastGain, state.score]);

  useEffect(() => {
    if (state.level <= 1) return;
    sounds.arcadeLevelUp();
    announce(ar ? `المستوى ${state.level}. زادت السرعة.` : `Level ${state.level}. The board is faster.`, "assertive");
  }, [announce, ar, sounds, state.level]);

  // A blind player needs the hazard before they hit it, not after.
  useEffect(() => {
    if (!running || !audioGuide) { dangerAnnouncedRef.current = false; return; }
    const danger = dangerAhead(state);
    if (danger && !dangerAnnouncedRef.current) {
      dangerAnnouncedRef.current = true;
      sounds.arcadeDanger();
      announce(ar ? "خطر أمامك. غيّر الاتجاه." : "Blocked ahead. Turn now.", "assertive");
    } else if (!danger) {
      dangerAnnouncedRef.current = false;
    }
  }, [announce, ar, audioGuide, running, sounds, state]);

  useEffect(() => {
    if (!finished || settledRef.current) return;
    settledRef.current = true;
    if (state.status === "won") {
      sounds.arcadeVictory();
      announce(ar ? `فوز! ${state.score} نقطة.` : `You win with ${state.score} points.`, "assertive");
      void settleGameResult("win", "Snake");
    } else {
      sounds.arcadeCrash();
      announce(ar ? `انتهت الجولة. ${state.score} نقطة.` : `Round over with ${state.score} points.`, "assertive");
      void settleGameResult("loss", "Snake");
    }
  }, [announce, ar, finished, settleGameResult, sounds, state.score, state.status]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      if (state.status === "ready") begin();
      turn(direction);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (finished) reset(); else if (state.status === "ready") begin();
      return;
    }
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      announce(describeSnakeBoard(state), "assertive");
    }
  }, [announce, begin, finished, reset, state, turn]);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (state.status === "ready") begin();
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const cells = useMemo(() => {
    const kinds = new Map<string, CellKind>();
    state.obstacles.forEach((wall) => kinds.set(`${wall.x},${wall.y}`, "wall"));
    state.snake.forEach((part, index) => {
      kinds.set(`${part.x},${part.y}`, index === 0 ? "head" : index === state.snake.length - 1 ? "tail" : "body");
    });
    kinds.set(`${state.food.x},${state.food.y}`, kinds.get(`${state.food.x},${state.food.y}`) ?? "food");
    return Array.from({ length: size * size }, (_, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      return { x, y, kind: kinds.get(`${x},${y}`) ?? ("empty" as CellKind) };
    });
  }, [size, state.food, state.obstacles, state.snake]);

  const boardSummary = describeSnakeBoard(state);
  const progress = Math.round((state.foodEaten / state.config.target) * 100);

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="snake-heading">
      <h2 id="snake-heading" className="sr-only">{ar ? "لعبة الثعبان" : "Snake"}</h2>

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
            <dt className="text-muted-foreground">{ar ? "الطول" : "Length"}</dt>
            <dd className="font-bold tabular-nums">{state.snake.length}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="flex items-center gap-1 text-muted-foreground"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "الأفضل" : "Best"}</dt>
            <dd className="font-bold tabular-nums">{best.toLocaleString(lang)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={audioGuide}
            onClick={() => {
              const next = !audioGuide;
              setAudioGuide(next);
              announce(next ? (ar ? "الإرشاد الصوتي مفعل." : "Audio guidance on.") : (ar ? "الإرشاد الصوتي متوقف." : "Audio guidance off."));
            }}
          >
            <Ear className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "إرشاد صوتي" : "Audio guidance"}
          </Button>
          {state.status === "ready" && (
            <Button type="button" onClick={begin}><Play className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "ابدأ" : "Start"}</Button>
          )}
          {finished && (
            <Button type="button" onClick={reset}><RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "جولة جديدة" : "Play again"}</Button>
          )}
        </div>
      </header>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "التقدم" : "Progress"}</span>
          <span className="tabular-nums">{state.foodEaten} / {state.config.target}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={state.config.target}
          aria-valuenow={state.foodEaten}
          aria-label={ar ? "التقدم نحو إنهاء الجولة" : "Progress towards finishing the round"}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div
        ref={boardRef}
        tabIndex={0}
        role="img"
        aria-label={boardSummary}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="grid touch-none gap-[2px] rounded-2xl bg-slate-950 p-2 outline-none ring-offset-2 ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300 sm:gap-1 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const style = CELL_STYLE[cell.kind];
          return (
            <span
              key={`${cell.x},${cell.y}`}
              aria-hidden="true"
              className={`grid aspect-square place-items-center rounded-[4px] text-[max(8px,1.6vw)] leading-none sm:rounded-md sm:text-xs ${style.className}`}
            >
              {style.glyph}
            </span>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm text-muted-foreground">
        {paused
          ? (ar ? "اللعبة متوقفة مؤقتاً." : "Paused.")
          : state.status === "ready"
            ? (ar ? "اضغط ابدأ أو أي سهم. الأسهم أو WASD للتحرك، مسافة لإعادة الجولة، حرف B لوصف اللوحة." : "Press Start or any arrow. Arrows or WASD to move, Space to replay, B to describe the board.")
            : state.status === "won"
              ? (ar ? `فوز! ${state.score} نقطة.` : `You win with ${state.score} points.`)
              : state.status === "over"
                ? (ar ? `انتهت الجولة: ${state.cause === "wall" ? "اصطدمت بالجدار" : state.cause === "obstacle" ? "اصطدمت بعائق" : "اصطدمت بنفسك"}. ${state.score} نقطة.` : `Round over: ${state.cause === "wall" ? "you hit the wall" : state.cause === "obstacle" ? "you hit a wall block" : "you hit yourself"}. ${state.score} points.`)
                : boardSummary}
      </p>

      <div className="mx-auto grid w-full max-w-[15rem] grid-cols-3 gap-2" role="group" aria-label={ar ? "أزرار الاتجاه" : "Direction controls"}>
        <span aria-hidden="true" />
        <Button type="button" variant="secondary" className="h-14" onClick={() => { if (state.status === "ready") begin(); turn("up"); }} aria-label={ar ? "أعلى" : "Up"}><ArrowUp className="h-5 w-5" aria-hidden="true" /></Button>
        <span aria-hidden="true" />
        <Button type="button" variant="secondary" className="h-14" onClick={() => { if (state.status === "ready") begin(); turn("left"); }} aria-label={ar ? "يسار" : "Left"}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="h-14" onClick={() => { if (state.status === "ready") begin(); turn("down"); }} aria-label={ar ? "أسفل" : "Down"}><ArrowDown className="h-5 w-5" aria-hidden="true" /></Button>
        <Button type="button" variant="secondary" className="h-14" onClick={() => { if (state.status === "ready") begin(); turn("right"); }} aria-label={ar ? "يمين" : "Right"}><ArrowRight className="h-5 w-5" aria-hidden="true" /></Button>
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{ar ? "طريقة اللعب والتحكم" : "How to play and controls"}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{ar ? "الأسهم أو WASD لتغيير الاتجاه. لا يمكن الالتفاف على نفسك مباشرة." : "Arrow keys or WASD to steer. A direct reversal is ignored, never fatal."}</li>
          <li>{ar ? "مسافة أو Enter: ابدأ أو أعد الجولة." : "Space or Enter starts the round and replays it after it ends."}</li>
          <li>{ar ? "حرف B: وصف كامل للوحة بصوت قارئ الشاشة." : "Press B for a spoken description of the whole board."}</li>
          <li>{ar ? "اسحب بإصبعك على اللوحة أو استخدم أزرار الاتجاه على الشاشة." : "Swipe on the board or use the on-screen direction pad."}</li>
          <li>{ar ? `اجمع ${state.config.target} ثمرة لإنهاء الجولة. كل ٥ ثمرات ترفع المستوى والسرعة، ومن المستوى ٣ تظهر عوائق.` : `Eat ${state.config.target} to finish. Every five raises the level and the speed, and from level ${state.config.obstacleFromLevel} walls appear.`}</li>
          <li>{ar ? "الأكل السريع يمنح نقاطاً إضافية." : "Biting quickly after the last one pays a freshness bonus."}</li>
        </ul>
      </details>
    </section>
  );
}
