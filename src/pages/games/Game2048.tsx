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
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from "lucide-react";
import {
  Board, Direction, SIZE, canMove, createBoard, hasWon, move, spawnTile, tileClass,
} from "@/lib/games/game2048Engine";

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

export default function Game2048() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { highScore, updateHighScore } = useHighScore("2048");
  const { settleGameResult } = useGameEconomy();

  const [board, setBoard] = useState<Board>(() => createBoard());
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState("");
  const [won, setWon] = useState(false);
  const settled = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const text = useMemo(() => (ar ? {
    title: "2048",
    subtitle: "ادمج البلاطات المتشابهة حتى تصل إلى بلاطة 2048.",
    newGame: "لعبة جديدة",
    over: "انتهت اللعبة! لا توجد حركات متاحة.",
    reached: "وصلت إلى 2048! يمكنك المتابعة للحصول على نقاط أعلى.",
    move: "حرّك",
    directions: { up: "أعلى", down: "أسفل", left: "يسار", right: "يمين" },
    empty: "فارغة",
    howTo: "كيف تلعب",
    steps: [
      "استخدم أسهم لوحة المفاتيح أو أزرار الاتجاهات لتحريك كل البلاطات.",
      "عند اصطدام بلاطتين تحملان الرقم نفسه تندمجان في بلاطة واحدة مضاعفة.",
      "بعد كل حركة تظهر بلاطة جديدة بقيمة 2 أو 4.",
      "تفوز عند تكوين بلاطة 2048، وتخسر إذا امتلأت الشبكة بلا حركات.",
      "على الهاتف يمكنك السحب بإصبعك في أي اتجاه.",
    ],
  } : {
    title: "2048",
    subtitle: "Merge matching tiles until you build the 2048 tile.",
    newGame: "New game",
    over: "Game over — no moves left.",
    reached: "You reached 2048! Keep going for a higher score.",
    move: "Move",
    directions: { up: "up", down: "down", left: "left", right: "right" },
    empty: "empty",
    howTo: "How to play",
    steps: [
      "Use the arrow keys or the direction buttons to slide every tile.",
      "When two tiles with the same number collide they merge into one doubled tile.",
      "After each move a new 2 or 4 tile appears.",
      "You win by making the 2048 tile, and lose when the grid fills with no moves.",
      "On a phone you can swipe in any direction.",
    ],
  }), [ar]);

  // Resolved outside the state updater so the sounds and reward fire exactly
  // once, even when React double-invokes updaters in development.
  const play = useCallback((direction: Direction) => {
    const result = move(board, direction);
    if (!result.moved) return;

    const next = spawnTile(result.board);
    setBoard(next);

    if (result.gained > 0) {
      setScore((value) => value + result.gained);
      playSound("points");
    } else {
      playSound("click");
    }

    if (!won && hasWon(next)) {
      setWon(true);
      setStatus(text.reached);
      playSound("complete");
      if (!settled.current) {
        settled.current = true;
        void settleGameResult("win", "2048");
      }
    }
  }, [board, playSound, settleGameResult, text.reached, won]);

  const over = !canMove(board);

  useEffect(() => {
    if (!over || settled.current) return;
    settled.current = true;
    updateHighScore(score);
    playSound("error");
    setStatus(text.over);
    void settleGameResult("loss", "2048");
  }, [over, score, updateHighScore, playSound, settleGameResult, text.over]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key];
      if (!direction || over) return;
      event.preventDefault();
      play(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, over]);

  const restart = () => {
    updateHighScore(score);
    setBoard(createBoard());
    setScore(0);
    setWon(false);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || over) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const arrows: { direction: Direction; icon: typeof ArrowUp; cell: string }[] = [
    { direction: "up", icon: ArrowUp, cell: "col-start-2 row-start-1" },
    { direction: "left", icon: ArrowLeft, cell: "col-start-1 row-start-2" },
    { direction: "right", icon: ArrowRight, cell: "col-start-3 row-start-2" },
    { direction: "down", icon: ArrowDown, cell: "col-start-2 row-start-3" },
  ];

  return (
    <Layout>
      <section className="section-container max-w-xl py-8">
        <GameHeader title={text.title} score={score} highScore={highScore} />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="p-4">
            <div
              dir="ltr"
              role="grid"
              aria-label={text.title}
              className="mx-auto grid aspect-square w-full max-w-sm grid-cols-4 gap-2 rounded-xl bg-muted/50 p-2"
              onTouchStart={(event) => {
                touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
              }}
              onTouchEnd={onTouchEnd}
            >
              {board.map((value, index) => (
                <div
                  key={index}
                  role="gridcell"
                  aria-label={
                    ar
                      ? `صف ${Math.floor(index / SIZE) + 1} عمود ${(index % SIZE) + 1}: ${value === 0 ? text.empty : value}`
                      : `row ${Math.floor(index / SIZE) + 1} column ${(index % SIZE) + 1}: ${value === 0 ? text.empty : value}`
                  }
                  className={[
                    "flex items-center justify-center rounded-lg font-black tabular-nums transition-all duration-150",
                    value >= 1024 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
                    tileClass(value),
                  ].join(" ")}
                >
                  {value === 0 ? "" : value}
                </div>
              ))}
            </div>

            <div dir="ltr" className="mx-auto mt-5 grid w-40 grid-cols-3 gap-2">
              {arrows.map(({ direction, icon: Icon, cell }) => (
                <Button
                  key={direction}
                  variant="outline"
                  size="icon"
                  disabled={over}
                  className={cell}
                  aria-label={`${text.move} ${text.directions[direction]}`}
                  onClick={() => play(direction)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Button>
              ))}
            </div>

            <div className="mt-5 flex justify-center">
              <Button onClick={restart} variant="secondary" className="gap-1.5">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {text.newGame}
              </Button>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
