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
import { Eraser, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import {
  Difficulty, Grid, boxOf, colOf, conflictingCells, generatePuzzle, hintCell, isSolved, rowOf,
} from "@/lib/games/sudokuEngine";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const MAX_MISTAKES = 3;

export default function Sudoku() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [puzzle, setPuzzle] = useState<{ grid: Grid; solution: Grid; givens: boolean[] } | null>(null);
  const [selected, setSelected] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "سودوكو",
    subtitle: "املأ الشبكة بالأرقام من 1 إلى 9 دون تكرار في أي صف أو عمود أو مربع.",
    difficulty: { easy: "سهل", medium: "متوسط", hard: "صعب" },
    newGame: "لعبة جديدة",
    hint: "تلميح",
    erase: "مسح",
    mistakes: "الأخطاء",
    time: "الوقت",
    generating: "جاري توليد لغز بحل وحيد…",
    won: "أحسنت! حللت الشبكة بالكامل.",
    lost: "انتهت المحاولات. جرّب لغزاً جديداً.",
    wrong: "رقم خاطئ.",
    placed: "تم وضع الرقم.",
    noHint: "لا يوجد تلميح متاح.",
    hintGiven: "كشفنا لك خانة.",
    howTo: "كيف تلعب",
    steps: [
      "اختر مستوى الصعوبة ثم اضغط على أي خانة فارغة.",
      "تنقّل بين الخانات بأسهم لوحة المفاتيح، واكتب رقماً من 1 إلى 9.",
      "اضغط Backspace أو زر المسح لإزالة رقم أدخلته.",
      "الأرقام المتعارضة تظهر بالأحمر، ولديك 3 محاولات خاطئة فقط.",
      "استخدم التلميح لكشف خانة واحدة عند الحاجة.",
    ],
  } : {
    title: "Sudoku",
    subtitle: "Fill the grid with 1–9 so no row, column, or box repeats a digit.",
    difficulty: { easy: "Easy", medium: "Medium", hard: "Hard" },
    newGame: "New game",
    hint: "Hint",
    erase: "Erase",
    mistakes: "Mistakes",
    time: "Time",
    generating: "Generating a puzzle with a unique solution…",
    won: "Brilliant! You solved the whole grid.",
    lost: "Out of attempts. Try a fresh puzzle.",
    wrong: "Wrong digit.",
    placed: "Digit placed.",
    noHint: "No hint available.",
    hintGiven: "Revealed one cell for you.",
    howTo: "How to play",
    steps: [
      "Pick a difficulty, then select any empty cell.",
      "Move between cells with the arrow keys and type a digit from 1 to 9.",
      "Press Backspace or the erase button to clear a digit you entered.",
      "Clashing digits turn red, and you only get 3 wrong attempts.",
      "Use a hint to reveal a single cell when you get stuck.",
    ],
  }), [ar]);

  const startGame = useCallback((level: Difficulty) => {
    setPuzzle(null);
    setMistakes(0);
    setSeconds(0);
    setSelected(0);
    setStatus(text.generating);
    settled.current = false;
    // Digging for a unique solution is synchronous work; defer it one frame so
    // the loading state paints before the main thread blocks.
    const timer = setTimeout(() => {
      const generated = generatePuzzle(level);
      setPuzzle({ grid: generated.puzzle, solution: generated.solution, givens: generated.givens });
      setStatus("");
    }, 30);
    return () => clearTimeout(timer);
  }, [text.generating]);

  useEffect(() => startGame(difficulty), [difficulty, startGame]);

  const finished = puzzle ? isSolved(puzzle.grid) || mistakes >= MAX_MISTAKES : false;

  useEffect(() => {
    if (!puzzle || finished) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [puzzle, finished]);

  useEffect(() => {
    if (!puzzle || settled.current) return;
    if (isSolved(puzzle.grid)) {
      settled.current = true;
      playSound("complete");
      setStatus(text.won);
      void settleGameResult("win", "Sudoku");
    } else if (mistakes >= MAX_MISTAKES) {
      settled.current = true;
      playSound("error");
      setStatus(text.lost);
      void settleGameResult("loss", "Sudoku");
    }
  }, [puzzle, mistakes, playSound, settleGameResult, text.won, text.lost]);

  const conflicts = useMemo(() => (puzzle ? conflictingCells(puzzle.grid) : new Set<number>()), [puzzle]);

  const enterDigit = useCallback((value: number) => {
    if (!puzzle || finished) return;
    if (puzzle.givens[selected]) return;

    setPuzzle((current) => {
      if (!current) return current;
      const grid = [...current.grid];
      grid[selected] = value;
      return { ...current, grid };
    });

    if (value === 0) { playSound("click"); return; }

    if (value === puzzle.solution[selected]) {
      playSound("points");
      setStatus(text.placed);
    } else {
      playSound("error");
      setMistakes((count) => count + 1);
      setStatus(text.wrong);
    }
  }, [puzzle, selected, finished, playSound, text.placed, text.wrong]);

  const useHint = () => {
    if (!puzzle || finished) return;
    const index = hintCell(puzzle.grid, puzzle.solution);
    if (index === null) { setStatus(text.noHint); return; }
    setPuzzle((current) => {
      if (!current) return current;
      const grid = [...current.grid];
      grid[index] = current.solution[index];
      const givens = [...current.givens];
      givens[index] = true;
      return { ...current, grid, givens };
    });
    setSelected(index);
    playSound("achievement");
    setStatus(text.hintGiven);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setSelected((index) => {
        const next = index + moves[event.key];
        if (next < 0 || next > 80) return index;
        // Block wrapping across a row edge when stepping sideways.
        if (Math.abs(moves[event.key]) === 1 && rowOf(next) !== rowOf(index)) return index;
        return next;
      });
      return;
    }
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enterDigit(Number(event.key)); return; }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      enterDigit(0);
    }
  };

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Layout>
      <section className="section-container max-w-3xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <>
              <Badge variant="outline">{text.time} {clock}</Badge>
              <Badge variant={mistakes > 0 ? "destructive" : "secondary"}>
                {text.mistakes} {mistakes}/{MAX_MISTAKES}
              </Badge>
            </>
          }
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {DIFFICULTIES.map((level) => (
            <Button
              key={level}
              size="sm"
              variant={difficulty === level ? "default" : "outline"}
              aria-pressed={difficulty === level}
              onClick={() => { playSound("select"); setDifficulty(level); }}
            >
              {text.difficulty[level]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => startGame(difficulty)} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="p-3 sm:p-5">
            {!puzzle ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
                {text.generating}
              </div>
            ) : (
              <div
                dir="ltr"
                role="grid"
                aria-label={text.title}
                className="mx-auto grid w-full max-w-md grid-cols-9 gap-px rounded-lg bg-border p-px"
                onKeyDown={onKeyDown}
              >
                {puzzle.grid.map((value, index) => {
                  const isGiven = puzzle.givens[index];
                  const isConflict = conflicts.has(index);
                  const isSelected = index === selected;
                  const sameValue = value !== 0 && puzzle.grid[selected] === value;
                  const box = boxOf(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      role="gridcell"
                      // Roving tabindex keeps the grid a single tab stop.
                      tabIndex={isSelected ? 0 : -1}
                      disabled={finished}
                      aria-label={
                        ar
                          ? `صف ${rowOf(index) + 1} عمود ${colOf(index) + 1}: ${value === 0 ? "فارغ" : value}`
                          : `row ${rowOf(index) + 1} column ${colOf(index) + 1}: ${value === 0 ? "empty" : value}`
                      }
                      aria-selected={isSelected}
                      onClick={() => { setSelected(index); playSound("click"); }}
                      className={[
                        "aspect-square text-sm font-semibold transition-colors sm:text-base",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        box % 2 === 0 ? "bg-card" : "bg-muted/40",
                        isSelected ? "!bg-primary/25 ring-2 ring-primary ring-inset" : "",
                        !isSelected && sameValue ? "!bg-primary/10" : "",
                        isConflict ? "text-destructive" : isGiven ? "text-foreground" : "text-primary",
                      ].join(" ")}
                    >
                      {value === 0 ? "" : value}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-5 gap-2 sm:grid-cols-10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  disabled={!puzzle || finished}
                  onClick={() => enterDigit(digit)}
                  aria-label={ar ? `أدخل الرقم ${digit}` : `Enter digit ${digit}`}
                  className="h-11 text-base font-bold"
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="outline"
                disabled={!puzzle || finished}
                onClick={() => enterDigit(0)}
                aria-label={text.erase}
                className="h-11"
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-3 flex justify-center">
              <Button variant="secondary" size="sm" onClick={useHint} disabled={!puzzle || finished} className="gap-1.5">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                {text.hint}
              </Button>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
