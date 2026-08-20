import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Ear, Heart, Play, RotateCcw, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useLanguage } from "@/contexts/LanguageContext";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadeAnimationFrame, useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";
import { useArcadeAccessibility } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import {
  BREAKOUT_CONFIG,
  ballBearing,
  bricksRemaining,
  createBreakoutState,
  describeBreakoutBoard,
  launchBall,
  movePaddle,
  paddleY,
  stepBreakout,
  type BreakoutConfig,
  type BreakoutState,
} from "@/lib/games/breakoutEngine";

/** Hit points decide the brick's face, so damage is visible without colour. */
const BRICK_FACE: Record<number, { className: string; glyph: string }> = {
  3: { className: "bg-rose-500 text-rose-50", glyph: "▨" },
  2: { className: "bg-amber-400 text-amber-950", glyph: "▤" },
  1: { className: "bg-cyan-400 text-cyan-950", glyph: "▁" },
};

export default function Breakout({ config = BREAKOUT_CONFIG, seed }: { config?: BreakoutConfig; seed?: number } = {}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const { announce } = useArcadeAccessibility();
  const sounds = useGameSounds();
  const paused = useArcadePaused();

  const [state, setState] = useState(() => createBreakoutState(seed ?? Date.now(), config));
  const [audioGuide, setAudioGuide] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef({ left: false, right: false });
  const settledRef = useRef(false);
  const guideRef = useRef({ at: 0, side: "" });

  const running = state.status === "running";
  const finished = state.status === "over" || state.status === "won";
  const percentX = (value: number) => `${(value / config.fieldWidth) * 100}%`;
  const percentY = (value: number) => `${(value / config.fieldHeight) * 100}%`;

  const launch = useCallback(() => {
    setState((current) => {
      const next = launchBall(current);
      if (next !== current) sounds.arcadeMove();
      return next;
    });
    fieldRef.current?.focus();
  }, [sounds]);

  const reset = useCallback(() => {
    settledRef.current = false;
    setState(createBreakoutState(seed ?? Date.now(), config));
    fieldRef.current?.focus();
    announce(ar ? "لعبة جديدة. اضغط مسافة للإطلاق." : "New game. Press Space to launch.", "assertive");
  }, [announce, ar, config, seed]);

  // One animation frame of physics. The engine takes sub-steps internally, so
  // a slow frame can never let the ball pass through a brick or the paddle.
  useArcadeAnimationFrame((seconds) => {
    const direction = (heldRef.current.right ? 1 : 0) - (heldRef.current.left ? 1 : 0);
    setState((current) => stepBreakout(current, seconds, direction));
  }, !finished);

  useEffect(() => {
    if (state.score > 0) gameManager.recordScore(state.score);
  }, [state.score]);

  useEffect(() => {
    gameManager.recordLevel(state.level);
  }, [state.level]);

  // Sound and speech follow the events the engine reports for the last frame.
  useEffect(() => {
    if (!state.events.length) return;
    if (state.events.includes("break")) sounds.arcadePickup();
    else if (state.events.includes("brick")) sounds.arcadeMove();
    if (state.events.includes("paddle") || state.events.includes("wall")) sounds.arcadeMove();
    if (state.events.includes("life")) {
      sounds.arcadeCrash();
      announce(ar ? `فقدت كرة. بقي ${state.lives}.` : `Ball lost. ${state.lives} lives left.`, "assertive");
    }
    if (state.events.includes("level")) {
      sounds.arcadeLevelUp();
      announce(ar ? `المستوى ${state.level}. اضغط مسافة للإطلاق.` : `Level ${state.level}. Press Space to launch.`, "assertive");
    }
  }, [announce, ar, sounds, state.events, state.level, state.lives]);

  /**
   * Tracking a bouncing ball by sight is the whole game, so a player who cannot
   * see it needs the same information in words: which way the ball is off the
   * paddle and how long there is to get there. Throttled to twice a second and
   * only spoken when the answer changes, so it guides instead of chattering.
   */
  useEffect(() => {
    if (!audioGuide || !running || state.attached) return;
    const now = Date.now();
    const bearing = ballBearing(state);
    if (now - guideRef.current.at < 500 || bearing.side === guideRef.current.side) return;
    guideRef.current = { at: now, side: bearing.side };
    if (bearing.side === "centred") announce(ar ? "الكرة أمام المضرب." : "Ball lined up.");
    else announce(ar ? (bearing.side === "left" ? "تحرك يساراً." : "تحرك يميناً.") : `Move ${bearing.side}.`);
  }, [announce, ar, audioGuide, running, state]);

  useEffect(() => {
    if (!finished || settledRef.current) return;
    settledRef.current = true;
    if (state.status === "won") {
      sounds.arcadeVictory();
      announce(ar ? `فوز! ${state.score} نقطة.` : `Run won with ${state.score} points.`, "assertive");
      void settleGameResult("win", "Breakout");
    } else {
      sounds.arcadeCrash();
      announce(ar ? `انتهت اللعبة. ${state.score} نقطة.` : `Game over with ${state.score} points.`, "assertive");
      void settleGameResult("loss", "Breakout");
    }
  }, [announce, ar, finished, settleGameResult, sounds, state.score, state.status]);

  const setHeld = (key: "left" | "right", down: boolean) => { heldRef.current[key] = down; };

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") { event.preventDefault(); setHeld("left", true); return; }
    if (key === "ArrowRight" || key === "d" || key === "D") { event.preventDefault(); setHeld("right", true); return; }
    if (key === " " || key === "Enter") {
      event.preventDefault();
      if (finished) reset(); else launch();
      return;
    }
    if (key.toLowerCase() === "b") {
      event.preventDefault();
      announce(describeBreakoutBoard(state), "assertive");
    }
  }, [announce, finished, launch, reset, state]);

  const onKeyUp = useCallback((event: React.KeyboardEvent) => {
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") setHeld("left", false);
    if (key === "ArrowRight" || key === "d" || key === "D") setHeld("right", false);
  }, []);

  // Pointer and touch aim the paddle directly at the finger, which is how the
  // game is played on a phone.
  const aimAt = (clientX: number) => {
    const box = fieldRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setState((current) => movePaddle(current, ((clientX - box.left) / box.width) * config.fieldWidth));
  };

  useEffect(() => {
    // A key released outside the game must not leave the paddle gliding.
    const release = () => { heldRef.current.left = false; heldRef.current.right = false; };
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, []);

  const summary = describeBreakoutBoard(state);
  const remaining = bricksRemaining(state);
  const liveBricks = useMemo(() => state.bricks.filter((brick) => brick.hp > 0), [state.bricks]);

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="breakout-heading">
      <h2 id="breakout-heading" className="sr-only">{ar ? "لعبة كسر الطوب" : "Breakout"}</h2>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "النقاط" : "Score"}</dt>
            <dd className="text-xl font-black tabular-nums">{state.score.toLocaleString(lang)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "المستوى" : "Level"}</dt>
            <dd className="font-bold tabular-nums">{state.level} / {config.levels}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">{ar ? "المحاولات" : "Lives"}</dt>
            <dd className="flex items-center gap-1 font-bold">
              <span className="sr-only">{state.lives}</span>
              {Array.from({ length: config.lives }, (_, index) => (
                <Heart key={index} aria-hidden="true" className={`h-4 w-4 ${index < state.lives ? "fill-rose-400 text-rose-400" : "text-slate-600"}`} />
              ))}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="flex items-center gap-1 text-muted-foreground"><Zap className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "أفضل تتابع" : "Best combo"}</dt>
            <dd className="font-bold tabular-nums">{state.bestCombo}</dd>
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
          {state.attached && !finished && (
            <Button type="button" onClick={launch}><Play className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "أطلق" : "Launch"}</Button>
          )}
          {finished && (
            <Button type="button" onClick={reset}><RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "لعبة جديدة" : "Play again"}</Button>
          )}
        </div>
      </header>

      <div
        ref={fieldRef}
        tabIndex={0}
        role="img"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={(event) => { fieldRef.current?.focus(); aimAt(event.clientX); if (state.attached && !finished) launch(); }}
        onPointerMove={(event) => { if (event.buttons > 0) aimAt(event.clientX); }}
        onTouchMove={(event) => aimAt(event.touches[0].clientX)}
        className="relative w-full touch-none overflow-hidden rounded-2xl bg-slate-950 outline-none ring-offset-2 ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300"
        style={{ aspectRatio: `${config.fieldWidth} / ${config.fieldHeight}` }}
      >
        {liveBricks.map((brick) => {
          const face = BRICK_FACE[brick.hp] ?? BRICK_FACE[1];
          return (
            <span
              key={brick.id}
              aria-hidden="true"
              className={`absolute grid place-items-center rounded-[3px] text-[8px] leading-none ${face.className}`}
              style={{ left: percentX(brick.x), top: percentY(brick.y), width: percentX(brick.width), height: percentY(brick.height) }}
            >
              {face.glyph}
            </span>
          );
        })}

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-white ring-2 ring-cyan-200"
          style={{
            left: percentX(state.ball.x - config.ballRadius),
            top: percentY(state.ball.y - config.ballRadius),
            width: percentX(config.ballRadius * 2),
            height: percentY(config.ballRadius * 2),
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
          style={{
            left: percentX(state.paddleX - config.paddleWidth / 2),
            top: percentY(paddleY(config)),
            width: percentX(config.paddleWidth),
            height: percentY(config.paddleHeight),
          }}
        />

        {state.attached && !finished && (
          <p className="absolute inset-x-0 bottom-[22%] text-center text-xs font-semibold text-cyan-100" aria-hidden="true">
            {ar ? "مسافة للإطلاق" : "Space to launch"}
          </p>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm text-muted-foreground">
        {paused
          ? (ar ? "اللعبة متوقفة مؤقتاً." : "Paused.")
          : state.status === "won"
            ? (ar ? `فوز! ${state.score} نقطة.` : `Run won with ${state.score} points.`)
            : state.status === "over"
              ? (ar ? `انتهت اللعبة. ${state.score} نقطة.` : `Game over with ${state.score} points.`)
              : state.attached
                ? (ar ? "الكرة على المضرب. مسافة للإطلاق، الأسهم أو A و D للتحرك، B لوصف اللوحة." : "Ball on the paddle. Space launches, arrows or A and D move, B describes the board.")
                : (ar ? `المستوى ${state.level}. بقي ${remaining} طوبة.` : `Level ${state.level}. ${remaining} bricks left.`)}
      </p>

      <div className="flex items-center justify-center gap-3" role="group" aria-label={ar ? "تحريك المضرب" : "Paddle controls"}>
        <Button
          type="button"
          variant="secondary"
          className="h-14 w-28"
          aria-label={ar ? "يسار" : "Move left"}
          onPointerDown={() => setHeld("left", true)}
          onPointerUp={() => setHeld("left", false)}
          onPointerLeave={() => setHeld("left", false)}
          onClick={() => setState((current) => movePaddle(current, current.paddleX - 12))}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-14 w-28"
          aria-label={ar ? "يمين" : "Move right"}
          onPointerDown={() => setHeld("right", true)}
          onPointerUp={() => setHeld("right", false)}
          onPointerLeave={() => setHeld("right", false)}
          onClick={() => setState((current) => movePaddle(current, current.paddleX + 12))}
        >
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{ar ? "طريقة اللعب والتحكم" : "How to play and controls"}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{ar ? "الأسهم أو A و D لتحريك المضرب. اسحب بإصبعك أو بالفأرة داخل الملعب أيضاً." : "Arrow keys or A and D move the paddle. Dragging inside the field with a finger or the mouse also aims it."}</li>
          <li>{ar ? "مسافة أو Enter لإطلاق الكرة، ولبدء لعبة جديدة بعد الانتهاء." : "Space or Enter launches the ball, and starts a new game once one ends."}</li>
          <li>{ar ? "حرف B لوصف اللوحة: اتجاه الكرة والوقت المتبقي قبل وصولها." : "Press B to hear the board: which way the ball is and how long before it arrives."}</li>
          <li>{ar ? "موضع ارتداد الكرة على المضرب يحدد زاويتها، فالحواف ترسلها بعيداً." : "Where the ball lands on the paddle sets its angle: the edges send it wide."}</li>
          <li>{ar ? "الصفوف العليا تحتاج أكثر من ضربة، وكل مستوى يضيف صفاً ويزيد السرعة." : "The top rows take more than one hit, and every level adds a row and speeds the ball up."}</li>
          <li>{ar ? "كسر عدة طوبات قبل عودة الكرة إلى المضرب يضاعف النقاط." : "Breaking several bricks before the ball returns to the paddle multiplies the points."}</li>
        </ul>
      </details>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
        {ar ? `أنهِ ${config.levels} مستويات لإكمال الجولة.` : `Clear ${config.levels} levels to finish the run.`}
      </p>
    </section>
  );
}
