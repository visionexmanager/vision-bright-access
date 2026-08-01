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
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";
import {
  Board, COLS, Level, ROWS, bestColumn, createBoard, drop, indexOf, isFull, landingRow, winningLine,
} from "@/lib/games/connectFourEngine";

const LEVELS: Level[] = ["easy", "medium", "hard"];

export default function ConnectFour() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [level, setLevel] = useState<Level>("medium");
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [turn, setTurn] = useState<"r" | "y">("r");
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "أربعة على التوالي",
    subtitle: "أسقط أقراصك واصنع أربعة متتالية أفقياً أو رأسياً أو قطرياً قبل الخصم.",
    levels: { easy: "سهل", medium: "متوسط", hard: "صعب" },
    newGame: "لعبة جديدة",
    yourTurn: "دورك — اختر عموداً.",
    thinking: "الخصم يفكر…",
    youWin: "فزت! صنعت أربعة على التوالي.",
    youLose: "خسرت — الخصم أكمل أربعة.",
    draw: "تعادل، امتلأت الرقعة.",
    column: "العمود",
    full: "ممتلئ",
    you: "أنت",
    rival: "الخصم",
    empty: "فارغة",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على أي عمود لإسقاط قرصك فيه.",
      "القرص يستقر فوق آخر قرص في العمود.",
      "اربط أربعة أقراص متتالية أفقياً أو رأسياً أو قطرياً لتفوز.",
      "امنع الخصم من إكمال أربعته في نفس الوقت.",
      "تنقّل بين الأعمدة بمفتاح Tab واختر بمفتاح Enter.",
    ],
  } : {
    title: "Four in a Row",
    subtitle: "Drop your discs and line up four across, down, or diagonally before your rival.",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    newGame: "New game",
    yourTurn: "Your turn — pick a column.",
    thinking: "Rival is thinking…",
    youWin: "You win — four in a row!",
    youLose: "You lose — your rival connected four.",
    draw: "Draw, the board is full.",
    column: "Column",
    full: "full",
    you: "You",
    rival: "Rival",
    empty: "empty",
    howTo: "How to play",
    steps: [
      "Select any column to drop your disc into it.",
      "The disc settles on top of the last disc in that column.",
      "Line up four discs across, down, or diagonally to win.",
      "Block your rival from completing their four at the same time.",
      "Move between columns with Tab and choose with Enter.",
    ],
  }), [ar]);

  const line = useMemo(() => winningLine(board), [board]);
  const winner = line ? board[line[0]] : null;
  const over = winner !== null || isFull(board);

  const playColumn = useCallback((col: number, disc: "r" | "y") => {
    if (landingRow(board, col) < 0) return;
    setBoard(drop(board, col, disc));
    setTurn(disc === "r" ? "y" : "r");
    playSound("click");
  }, [board, playSound]);

  // The rival answers once the player's disc has landed.
  useEffect(() => {
    if (turn !== "y" || over) return;
    setThinking(true);
    const timer = setTimeout(() => {
      const col = bestColumn(board, "y", level);
      if (col !== null) {
        setBoard(drop(board, col, "y"));
        setTurn("r");
        playSound("click");
      }
      setThinking(false);
    }, 320);
    return () => { clearTimeout(timer); setThinking(false); };
  }, [turn, board, level, over, playSound]);

  useEffect(() => {
    if (settled.current) return;
    if (winner === "r") {
      settled.current = true;
      playSound("complete");
      setStatus(text.youWin);
      void settleGameResult("win", "Four in a Row");
    } else if (winner === "y") {
      settled.current = true;
      playSound("error");
      setStatus(text.youLose);
      void settleGameResult("loss", "Four in a Row");
    } else if (over) {
      settled.current = true;
      playSound("notification");
      setStatus(text.draw);
    } else {
      setStatus(thinking ? text.thinking : text.yourTurn);
    }
  }, [winner, over, thinking, playSound, settleGameResult, text]);

  const restart = () => {
    setBoard(createBoard());
    setTurn("r");
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const highlight = new Set(line ?? []);

  return (
    <Layout>
      <section className="section-container max-w-2xl py-8">
        <GameHeader title={text.title} />

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
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
          <Badge variant="secondary" className="gap-1">
            <span className="h-3 w-3 rounded-full bg-rose-500" aria-hidden="true" />{text.you}
          </Badge>
        </div>

        <p role="status" aria-live="polite" className="mb-3 flex min-h-5 items-center gap-2 text-sm font-medium text-primary">
          {thinking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {status}
        </p>

        <Card>
          <CardContent className="p-3 sm:p-5">
            <div dir="ltr" className="mx-auto w-full max-w-md">
              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {Array.from({ length: COLS }, (_, col) => {
                  const disabled = over || thinking || turn !== "r" || landingRow(board, col) < 0;
                  return (
                    <Button
                      key={col}
                      variant="outline"
                      size="icon"
                      disabled={disabled}
                      onClick={() => playColumn(col, "r")}
                      aria-label={`${text.column} ${col + 1}${landingRow(board, col) < 0 ? ` — ${text.full}` : ""}`}
                      className="h-8 w-full"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  );
                })}
              </div>

              <div role="grid" aria-label={text.title} className="grid grid-cols-7 gap-1.5 rounded-xl bg-blue-700 p-2 dark:bg-blue-900">
                {Array.from({ length: ROWS }, (_, row) =>
                  Array.from({ length: COLS }, (_, col) => {
                    const index = indexOf(row, col);
                    const disc = board[index];
                    const label = disc === "r" ? text.you : disc === "y" ? text.rival : text.empty;
                    return (
                      <div
                        key={index}
                        role="gridcell"
                        aria-label={ar
                          ? `صف ${row + 1} عمود ${col + 1}: ${label}`
                          : `row ${row + 1} column ${col + 1}: ${label}`}
                        className={[
                          "aspect-square rounded-full border-2 transition-all",
                          disc === "r" ? "border-rose-300 bg-rose-500"
                            : disc === "y" ? "border-amber-200 bg-amber-400"
                            : "border-blue-800/40 bg-blue-50 dark:bg-slate-800",
                          highlight.has(index) ? "ring-4 ring-emerald-400" : "",
                        ].join(" ")}
                      />
                    );
                  }),
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
