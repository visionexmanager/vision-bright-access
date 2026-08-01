import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { Bomb, Flag, RotateCcw } from "lucide-react";
import {
  Board, LEVELS, Level, createEmptyBoard, flagCount, isCleared, numberClass,
  placeMines, reveal, revealAllMines, toggleFlag,
} from "@/lib/games/minesweeperEngine";

const ORDER: Level[] = ["easy", "medium", "hard"];

export default function Minesweeper() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [level, setLevel] = useState<Level>("easy");
  const config = LEVELS[level];
  const [board, setBoard] = useState<Board>(() => createEmptyBoard(LEVELS.easy));
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "كاسحة الألغام",
    subtitle: "اكشف كل الخانات الآمنة دون أن تفجّر لغماً. الأرقام تدل على عدد الألغام المجاورة.",
    levels: { easy: "سهل", medium: "متوسط", hard: "صعب" },
    newGame: "لعبة جديدة",
    flagMode: "وضع العلم",
    mines: "الألغام",
    time: "الوقت",
    boom: "انفجر لغم! انتهت الجولة.",
    cleared: "ممتاز! كشفت الحقل بالكامل.",
    flagged: "تم وضع علم.",
    unflagged: "تم رفع العلم.",
    hidden: "مغلقة",
    flag: "معلَّمة",
    mine: "لغم",
    safe: "آمنة",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على أي خانة لكشفها — أول ضغطة آمنة دائماً.",
      "الرقم داخل الخانة يخبرك بعدد الألغام في الخانات الثماني المجاورة.",
      "فعّل وضع العلم أو اضغط F لتعليم خانة تشك أنها لغم.",
      "تنقّل بالأسهم واكشف بمفتاح Enter أو المسافة.",
      "تفوز عندما تكشف كل الخانات الخالية من الألغام.",
    ],
  } : {
    title: "Minesweeper",
    subtitle: "Clear every safe square without hitting a mine. Numbers count the mines next door.",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    newGame: "New game",
    flagMode: "Flag mode",
    mines: "Mines",
    time: "Time",
    boom: "You hit a mine — round over.",
    cleared: "Excellent! The whole field is cleared.",
    flagged: "Flag placed.",
    unflagged: "Flag removed.",
    hidden: "hidden",
    flag: "flagged",
    mine: "mine",
    safe: "safe",
    howTo: "How to play",
    steps: [
      "Select any square to uncover it — the first click is always safe.",
      "The number in a square counts the mines in the eight squares around it.",
      "Turn on flag mode or press F to mark a square you think holds a mine.",
      "Move with the arrow keys and uncover with Enter or Space.",
      "You win once every mine-free square is uncovered.",
    ],
  }), [ar]);

  const reset = useCallback((next: Level) => {
    setBoard(createEmptyBoard(LEVELS[next]));
    setStarted(false);
    setDead(false);
    setSeconds(0);
    setCursor(0);
    setStatus("");
    settled.current = false;
  }, []);

  useEffect(() => { reset(level); }, [level, reset]);

  const cleared = started && !dead && isCleared(board);

  useEffect(() => {
    if (!started || dead || cleared) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [started, dead, cleared]);

  useEffect(() => {
    if (settled.current) return;
    if (cleared) {
      settled.current = true;
      playSound("complete");
      setStatus(text.cleared);
      void settleGameResult("win", "Minesweeper");
    } else if (dead) {
      settled.current = true;
      playSound("error");
      setStatus(text.boom);
      void settleGameResult("loss", "Minesweeper");
    }
  }, [cleared, dead, playSound, settleGameResult, text.cleared, text.boom]);

  const openCell = (row: number, col: number) => {
    if (dead || cleared || board[row][col].flagged) return;

    // Mines are only laid once the player has committed to an opening square.
    let current = board;
    if (!started) {
      current = placeMines(current, config, row, col);
      setStarted(true);
    }

    if (current[row][col].mine) {
      setBoard(revealAllMines(current));
      setDead(true);
      return;
    }

    setBoard(reveal(current, row, col));
    playSound("click");
  };

  const flagCell = (row: number, col: number) => {
    if (dead || cleared || board[row][col].revealed) return;
    setBoard(toggleFlag(board, row, col));
    playSound("toggle");
    setStatus(board[row][col].flagged ? text.unflagged : text.flagged);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const { rows, cols } = config;
    const row = Math.floor(cursor / cols);
    const col = cursor % cols;
    const step: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };

    if (event.key in step) {
      event.preventDefault();
      const [dr, dc] = step[event.key];
      const nr = Math.min(rows - 1, Math.max(0, row + dr));
      const nc = Math.min(cols - 1, Math.max(0, col + dc));
      setCursor(nr * cols + nc);
      return;
    }
    if (event.key.toLowerCase() === "f") { event.preventDefault(); flagCell(row, col); }
  };

  const remaining = config.mines - flagCount(board);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Layout>
      <section className="section-container max-w-3xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <>
              <Badge variant="outline">{text.time} {clock}</Badge>
              <Badge variant="secondary" className="gap-1">
                <Bomb className="h-3 w-3" aria-hidden="true" />{remaining}
              </Badge>
            </>
          }
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {ORDER.map((option) => (
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
          <Button
            size="sm"
            variant={flagMode ? "default" : "outline"}
            aria-pressed={flagMode}
            onClick={() => { setFlagMode(!flagMode); playSound("toggle"); }}
            className="gap-1.5"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            {text.flagMode}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reset(level)} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="overflow-x-auto p-3 sm:p-5">
            <div
              dir="ltr"
              role="grid"
              aria-label={text.title}
              onKeyDown={onKeyDown}
              className="mx-auto grid w-fit gap-px rounded-lg bg-border p-px"
              style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
            >
              {board.map((line, row) =>
                line.map((cell, col) => {
                  const index = row * config.cols + col;
                  const state = cell.revealed
                    ? cell.mine ? text.mine : cell.adjacent > 0 ? String(cell.adjacent) : text.safe
                    : cell.flagged ? text.flag : text.hidden;
                  return (
                    <button
                      key={index}
                      type="button"
                      role="gridcell"
                      tabIndex={index === cursor ? 0 : -1}
                      aria-label={
                        ar
                          ? `صف ${row + 1} عمود ${col + 1}: ${state}`
                          : `row ${row + 1} column ${col + 1}: ${state}`
                      }
                      onFocus={() => setCursor(index)}
                      onClick={() => (flagMode ? flagCell(row, col) : openCell(row, col))}
                      onContextMenu={(event) => { event.preventDefault(); flagCell(row, col); }}
                      className={[
                        "flex h-7 w-7 items-center justify-center text-xs font-bold transition-colors sm:h-8 sm:w-8 sm:text-sm",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        cell.revealed
                          ? cell.mine ? "bg-destructive text-destructive-foreground" : "bg-muted/60"
                          : "bg-card hover:bg-accent",
                        cell.revealed && !cell.mine ? numberClass(cell.adjacent) : "",
                      ].join(" ")}
                    >
                      {cell.revealed
                        ? cell.mine
                          ? <Bomb className="h-3.5 w-3.5" aria-hidden="true" />
                          : cell.adjacent > 0 ? cell.adjacent : ""
                        : cell.flagged
                          ? <Flag className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                          : ""}
                    </button>
                  );
                }),
              )}
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
