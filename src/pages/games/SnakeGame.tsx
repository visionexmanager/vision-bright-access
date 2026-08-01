import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useHighScore } from "@/hooks/useHighScore";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from "lucide-react";
import {
  Direction, GRID, Level, Snake, colOf, createSnake, rowOf, step, tickDelay, turn,
} from "@/lib/games/snakeEngine";

const KEYS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

const LEVELS: Level[] = ["calm", "brisk", "fast"];

export default function SnakeGame() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { highScore, updateHighScore } = useHighScore("snake");
  const { settleGameResult } = useGameEconomy();

  const [level, setLevel] = useState<Level>("calm");
  const [snake, setSnake] = useState<Snake>(() => createSnake());
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);
  const lengthRef = useRef(snake.body.length);

  const text = useMemo(() => (ar ? {
    title: "الأفعى",
    subtitle: "كُل الطعام لتنمو، وتجنّب الجدران وجسدك.",
    levels: { calm: "هادئة", brisk: "متوسطة", fast: "سريعة" },
    start: "ابدأ",
    pause: "إيقاف مؤقت",
    newGame: "لعبة جديدة",
    over: "اصطدمت! انتهت الجولة.",
    eat: "التهمت الطعام.",
    length: "الطول",
    move: "اتجاه",
    directions: { up: "أعلى", down: "أسفل", left: "يسار", right: "يمين" },
    howTo: "كيف تلعب",
    steps: [
      "اضغط «ابدأ» ثم وجّه الأفعى بأسهم لوحة المفاتيح أو بأزرار الاتجاهات.",
      "كل قطعة طعام تزيد طولك عشر نقاط.",
      "لا يمكنك الانعطاف عكس اتجاهك مباشرة.",
      "تنتهي الجولة إذا اصطدمت بالجدار أو بجسدك.",
      "كلما زادت نقاطك زادت سرعة الأفعى تدريجياً.",
    ],
  } : {
    title: "Snake",
    subtitle: "Eat the food to grow, and avoid the walls and your own body.",
    levels: { calm: "Calm", brisk: "Brisk", fast: "Fast" },
    start: "Start",
    pause: "Pause",
    newGame: "New game",
    over: "You crashed — round over.",
    eat: "Food eaten.",
    length: "Length",
    move: "Turn",
    directions: { up: "up", down: "down", left: "left", right: "right" },
    howTo: "How to play",
    steps: [
      "Press Start, then steer with the arrow keys or the direction buttons.",
      "Every piece of food adds ten points to your score.",
      "You cannot turn straight back into your own neck.",
      "The round ends if you hit a wall or your own body.",
      "The snake speeds up gradually as your score climbs.",
    ],
  }), [ar]);

  // One interval per speed change; the delay shortens as the score climbs.
  useEffect(() => {
    if (!running || !snake.alive) return;
    const timer = setInterval(() => setSnake((current) => step(current)), tickDelay(level, snake.score));
    return () => clearInterval(timer);
  }, [running, snake.alive, snake.score, level]);

  useEffect(() => {
    if (snake.body.length > lengthRef.current) {
      playSound("points");
      setStatus(text.eat);
    }
    lengthRef.current = snake.body.length;
  }, [snake.body.length, playSound, text.eat]);

  useEffect(() => {
    if (snake.alive || settled.current) return;
    settled.current = true;
    setRunning(false);
    updateHighScore(snake.score);
    playSound("error");
    setStatus(text.over);
    void settleGameResult("loss", "Snake");
  }, [snake.alive, snake.score, updateHighScore, playSound, settleGameResult, text.over]);

  const steer = useCallback((direction: Direction) => {
    setSnake((current) => turn(current, direction));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      if (!direction) return;
      event.preventDefault();
      steer(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steer]);

  const restart = () => {
    const fresh = createSnake();
    setSnake(fresh);
    lengthRef.current = fresh.body.length;
    setRunning(true);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const head = snake.body[0];
  const bodySet = new Set(snake.body.slice(1));

  const arrows: { direction: Direction; icon: typeof ArrowUp; cell: string }[] = [
    { direction: "up", icon: ArrowUp, cell: "col-start-2 row-start-1" },
    { direction: "left", icon: ArrowLeft, cell: "col-start-1 row-start-2" },
    { direction: "right", icon: ArrowRight, cell: "col-start-3 row-start-2" },
    { direction: "down", icon: ArrowDown, cell: "col-start-2 row-start-3" },
  ];

  return (
    <Layout>
      <section className="section-container max-w-xl py-8">
        <GameHeader
          title={text.title}
          score={snake.score}
          highScore={highScore}
          isPaused={!running}
          onPause={() => { if (snake.alive) { setRunning(!running); playSound("toggle"); } }}
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {LEVELS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={level === option ? "default" : "outline"}
              aria-pressed={level === option}
              onClick={() => { playSound("select"); setLevel(option); }}
            >
              {text.levels[option]}
            </Button>
          ))}
          <Button size="sm" onClick={restart} className="gap-1.5">
            {snake.alive && running
              ? <RotateCcw className="h-4 w-4" aria-hidden="true" />
              : <Play className="h-4 w-4" aria-hidden="true" />}
            {snake.alive && running ? text.newGame : text.start}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="p-4">
            <div
              dir="ltr"
              role="img"
              aria-label={ar
                ? `رقعة الأفعى، الطول ${snake.body.length}، الرأس في صف ${rowOf(head) + 1} عمود ${colOf(head) + 1}`
                : `Snake board, length ${snake.body.length}, head at row ${rowOf(head) + 1} column ${colOf(head) + 1}`}
              className="mx-auto grid aspect-square w-full max-w-sm gap-px rounded-xl bg-emerald-950/20 p-1"
              style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: GRID * GRID }, (_, index) => (
                <div
                  key={index}
                  className={[
                    "rounded-[2px]",
                    index === head ? "bg-emerald-400"
                      : bodySet.has(index) ? "bg-emerald-600"
                      : index === snake.food ? "bg-rose-500"
                      : "bg-muted/40",
                  ].join(" ")}
                />
              ))}
            </div>

            <div dir="ltr" className="mx-auto mt-5 grid w-40 grid-cols-3 gap-2">
              {arrows.map(({ direction, icon: Icon, cell }) => (
                <Button
                  key={direction}
                  variant="outline"
                  size="icon"
                  className={cell}
                  disabled={!snake.alive}
                  aria-label={`${text.move} ${text.directions[direction]}`}
                  onClick={() => steer(direction)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
