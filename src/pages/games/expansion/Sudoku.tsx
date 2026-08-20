import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Lightbulb, Pencil, RotateCcw, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useLanguage } from "@/contexts/LanguageContext";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadeGameLoop, useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";
import { useArcadeAccessibility } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import {
  boxIndex,
  cloneGrid,
  conflicts,
  describeSudokuBoard,
  describeSudokuCell,
  generateSudoku,
  hintCell,
  isComplete,
  isLegal,
  remainingByDigit,
  type Difficulty,
  type Grid,
} from "@/lib/games/sudokuEngine";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL: Record<Difficulty, { en: string; ar: string }> = {
  easy: { en: "Easy", ar: "سهل" },
  medium: { en: "Medium", ar: "متوسط" },
  hard: { en: "Hard", ar: "صعب" },
};

/** Mistakes allowed before the round is lost. Lenient on purpose. */
const MISTAKE_LIMIT = 5;

const emptyNotes = (): Set<number>[][] => Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));

export default function Sudoku({ seed, initialDifficulty = "medium" }: { seed?: number; initialDifficulty?: Difficulty } = {}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const { announce } = useArcadeAccessibility();
  const sounds = useGameSounds();
  const paused = useArcadePaused();

  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [puzzle, setPuzzle] = useState(() => generateSudoku(seed ?? Date.now(), initialDifficulty));
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(puzzle.puzzle));
  const [notes, setNotes] = useState(emptyNotes);
  const [noteMode, setNoteMode] = useState(false);
  const [cursor, setCursor] = useState({ row: 0, column: 0 });
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const settledRef = useRef(false);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  const solved = useMemo(() => isComplete(grid), [grid]);
  const lost = mistakes >= MISTAKE_LIMIT;
  const finished = solved || lost;
  const clashes = useMemo(() => new Set(conflicts(grid).map((cell) => `${cell.row},${cell.column}`)), [grid]);
  const remaining = useMemo(() => remainingByDigit(grid), [grid]);
  const labels = useMemo(
    () => grid.map((row, r) => row.map((_, c) => describeSudokuCell(grid, puzzle.given, r, c))),
    [grid, puzzle.given],
  );

  useArcadeGameLoop(() => setSeconds((value) => value + 1), 1000, !finished);

  const newPuzzle = useCallback((level: Difficulty) => {
    const next = generateSudoku(seed ?? Date.now(), level);
    settledRef.current = false;
    setDifficulty(level);
    setPuzzle(next);
    setGrid(cloneGrid(next.puzzle));
    setNotes(emptyNotes());
    setMistakes(0);
    setHintsUsed(0);
    setSeconds(0);
    setCursor({ row: 0, column: 0 });
    announce(ar ? `لغز ${DIFFICULTY_LABEL[level].ar} جديد.` : `New ${level} puzzle.`, "assertive");
  }, [announce, ar, seed]);

  const focusCell = (row: number, column: number) => {
    setCursor({ row, column });
    cellRefs.current.get(`${row},${column}`)?.focus();
  };

  const place = useCallback((value: number, at: { row: number; column: number } = cursor) => {
    const { row, column } = at;
    if (puzzle.given[row][column] || finished) return;

    if (noteMode && value) {
      setNotes((current) => {
        const next = current.map((line) => line.map((set) => new Set(set)));
        if (next[row][column].has(value)) next[row][column].delete(value);
        else next[row][column].add(value);
        return next;
      });
      sounds.arcadeMove();
      return;
    }

    setGrid((current) => {
      const next = cloneGrid(current);
      next[row][column] = value;
      if (value && !isLegal(next, row, column, value)) {
        setMistakes((count) => count + 1);
        sounds.arcadeDanger();
        announce(ar ? `${value} يتعارض هنا.` : `${value} conflicts here.`, "assertive");
      } else if (value) {
        sounds.arcadePickup();
      } else {
        sounds.arcadeMove();
      }
      return next;
    });

    if (value) {
      setNotes((current) => {
        const next = current.map((line) => line.map((set) => new Set(set)));
        next[row][column].clear();
        return next;
      });
    }
  }, [announce, ar, cursor, finished, noteMode, puzzle.given, sounds]);

  const revealHint = useCallback(() => {
    if (finished) return;
    const hint = hintCell(puzzle, grid);
    if (!hint) return;
    setGrid((current) => {
      const next = cloneGrid(current);
      next[hint.row][hint.column] = hint.value;
      return next;
    });
    setHintsUsed((count) => count + 1);
    focusCell(hint.row, hint.column);
    sounds.arcadeLevelUp();
    announce(
      ar ? `تلميح: ${hint.value} في الصف ${hint.row + 1} والعمود ${hint.column + 1}.` : `Hint: ${hint.value} at row ${hint.row + 1}, column ${hint.column + 1}.`,
      "assertive",
    );
  }, [announce, ar, finished, grid, puzzle, sounds]);

  useEffect(() => {
    if (!finished || settledRef.current) return;
    settledRef.current = true;
    if (solved) {
      // Faster and cleaner solves are worth more; hints are paid for.
      const score = Math.max(200, 4000 - seconds * 5 - mistakes * 150 - hintsUsed * 250);
      gameManager.recordScore(score);
      sounds.arcadeVictory();
      announce(ar ? `تم الحل في ${seconds} ثانية.` : `Solved in ${seconds} seconds.`, "assertive");
      void settleGameResult("win", "Sudoku");
    } else {
      sounds.arcadeCrash();
      announce(ar ? "انتهت المحاولات." : "Out of mistakes.", "assertive");
      void settleGameResult("loss", "Sudoku");
    }
  }, [announce, ar, finished, hintsUsed, mistakes, seconds, settleGameResult, solved, sounds]);

  const onKeyDown = (event: React.KeyboardEvent, row: number, column: number) => {
    const key = event.key;
    const move = (dr: number, dc: number) => {
      event.preventDefault();
      focusCell((row + dr + 9) % 9, (column + dc + 9) % 9);
    };
    if (key === "ArrowUp") return move(-1, 0);
    if (key === "ArrowDown") return move(1, 0);
    if (key === "ArrowLeft") return move(0, -1);
    if (key === "ArrowRight") return move(0, 1);
    if (/^[1-9]$/.test(key)) { event.preventDefault(); return place(Number(key), { row, column }); }
    if (key === "0" || key === "Backspace" || key === "Delete") { event.preventDefault(); return place(0, { row, column }); }
    if (key.toLowerCase() === "n") { event.preventDefault(); setNoteMode((value) => !value); return; }
    if (key.toLowerCase() === "h") { event.preventDefault(); return revealHint(); }
    if (key.toLowerCase() === "b") {
      event.preventDefault();
      announce(`${describeSudokuBoard(grid, difficulty)} ${labels[row][column]}`, "assertive");
    }
  };

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="sudoku-heading">
      <h2 id="sudoku-heading" className="sr-only">{ar ? "سودوكو" : "Sudoku"}</h2>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="flex items-center gap-1 text-muted-foreground"><Timer className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "الوقت" : "Time"}</dt>
            <dd className="font-bold tabular-nums">{clock}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="flex items-center gap-1 text-muted-foreground"><TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "الأخطاء" : "Mistakes"}</dt>
            <dd className="font-bold tabular-nums">{mistakes} / {MISTAKE_LIMIT}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{ar ? "التلميحات" : "Hints"}</dt>
            <dd className="font-bold tabular-nums">{hintsUsed}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? "مستوى الصعوبة" : "Difficulty"}>
          {DIFFICULTIES.map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={level === difficulty ? "default" : "outline"}
              aria-pressed={level === difficulty}
              onClick={() => newPuzzle(level)}
            >
              {ar ? DIFFICULTY_LABEL[level].ar : DIFFICULTY_LABEL[level].en}
            </Button>
          ))}
        </div>
      </header>

      <div
        role="grid"
        aria-label={ar ? "لوحة سودوكو تسعة في تسعة" : "Nine by nine Sudoku board"}
        aria-rowcount={9}
        aria-colcount={9}
        className="mx-auto grid w-full max-w-md grid-cols-9 gap-[1px] rounded-xl bg-slate-700 p-[2px]"
      >
        {grid.map((row, r) => (
          <div key={r} role="row" className="contents">
            {row.map((value, c) => {
              const given = puzzle.given[r][c];
              const clashing = clashes.has(`${r},${c}`);
              const selected = cursor.row === r && cursor.column === c;
              const peer = cursor.row === r || cursor.column === c || boxIndex(cursor.row, cursor.column) === boxIndex(r, c);
              const marks = notes[r][c];
              return (
                <button
                  key={c}
                  ref={(node) => { if (node) cellRefs.current.set(`${r},${c}`, node); else cellRefs.current.delete(`${r},${c}`); }}
                  type="button"
                  role="gridcell"
                  aria-rowindex={r + 1}
                  aria-colindex={c + 1}
                  aria-readonly={given}
                  aria-invalid={clashing}
                  aria-label={labels[r][c]}
                  tabIndex={selected ? 0 : -1}
                  disabled={finished}
                  onFocus={() => setCursor({ row: r, column: c })}
                  onClick={() => focusCell(r, c)}
                  onKeyDown={(event) => onKeyDown(event, r, c)}
                  className={[
                    "relative grid aspect-square place-items-center text-[max(12px,2.4vw)] font-bold tabular-nums outline-none sm:text-lg",
                    (r % 3 === 0 && r !== 0) ? "mt-[2px]" : "",
                    (c % 3 === 0 && c !== 0) ? "ms-[2px]" : "",
                    given ? "bg-slate-800 text-slate-100" : "bg-slate-950 text-cyan-200",
                    peer && !selected ? "bg-slate-900" : "",
                    selected ? "ring-2 ring-cyan-300" : "",
                    clashing ? "text-rose-300 underline decoration-rose-400 decoration-2 underline-offset-4" : "",
                    finished ? "opacity-80" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {value ? (
                    <span>{value}</span>
                  ) : marks.size ? (
                    <span aria-hidden="true" className="grid grid-cols-3 gap-px text-[max(6px,1vw)] font-normal leading-none text-slate-400">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <span key={digit} className="h-[1em] w-[1em]">{marks.has(digit) ? digit : ""}</span>
                      ))}
                    </span>
                  ) : null}
                  {clashing && <span aria-hidden="true" className="absolute end-[2px] top-0 text-[9px] text-rose-400">!</span>}
                  {given && <span aria-hidden="true" className="absolute bottom-[2px] start-[2px] text-[8px] text-slate-500">•</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center text-sm text-muted-foreground">
        {paused
          ? (ar ? "اللعبة متوقفة مؤقتاً." : "Paused.")
          : solved
            ? (ar ? `تم الحل في ${clock} بـ${mistakes} خطأ.` : `Solved in ${clock} with ${mistakes} mistakes.`)
            : lost
              ? (ar ? "انتهت المحاولات. ابدأ لغزاً جديداً." : "Out of mistakes. Start a new puzzle.")
              : describeSudokuBoard(grid, difficulty)}
      </p>

      <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2" role="group" aria-label={ar ? "لوحة الأرقام" : "Number pad"}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="secondary"
            className="h-14 flex-col gap-0"
            disabled={finished}
            aria-label={ar ? `ضع ${digit}، بقي ${remaining[digit]}` : `Place ${digit}, ${remaining[digit]} left`}
            onClick={() => { place(digit); cellRefs.current.get(`${cursor.row},${cursor.column}`)?.focus(); }}
          >
            <span className="text-lg font-bold">{digit}</span>
            <span aria-hidden="true" className="text-[10px] text-muted-foreground">{remaining[digit]}</span>
          </Button>
        ))}
        <Button type="button" variant="secondary" className="h-14" disabled={finished} aria-label={ar ? "امسح الخانة" : "Clear the cell"} onClick={() => { place(0); cellRefs.current.get(`${cursor.row},${cursor.column}`)?.focus(); }}>
          <Eraser className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" aria-pressed={noteMode} onClick={() => setNoteMode((value) => !value)}>
          <Pencil className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "وضع الملاحظات" : "Notes mode"}
        </Button>
        <Button type="button" variant="outline" disabled={finished} onClick={revealHint}>
          <Lightbulb className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "تلميح" : "Hint"}
        </Button>
        <Button type="button" onClick={() => newPuzzle(difficulty)}>
          <RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "لغز جديد" : "New puzzle"}
        </Button>
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{ar ? "طريقة اللعب والتحكم" : "How to play and controls"}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{ar ? "الأسهم تتنقل بين الخانات، والأرقام ١ إلى ٩ تضع رقماً، و0 أو Backspace تمسح." : "Arrow keys move between cells, 1 to 9 place a digit, 0 or Backspace clears one."}</li>
          <li>{ar ? "حرف N يبدّل وضع الملاحظات، وحرف H يعطي تلميحاً، وحرف B ينطق حالة اللوحة والخانة." : "N toggles notes mode, H gives a hint, and B speaks the board and the current cell."}</li>
          <li>{ar ? "الخانات المعطاة مميزة بنقطة ولا يمكن تغييرها." : "Given cells carry a dot and cannot be changed."}</li>
          <li>{ar ? "الخانة المتعارضة تظهر بعلامة تعجب وخط تحتها، لا باللون وحده." : "A conflicting cell is marked with an exclamation mark and an underline, not by colour alone."}</li>
          <li>{ar ? `لديك ${MISTAKE_LIMIT} أخطاء مسموحة. النتيجة تعتمد على الوقت والأخطاء والتلميحات.` : `You have ${MISTAKE_LIMIT} mistakes to spend. The score follows your time, mistakes and hints.`}</li>
          <li>{ar ? "كل لغز يُولَّد من جديد وله حل وحيد." : "Every puzzle is generated fresh and has exactly one solution."}</li>
        </ul>
      </details>
    </section>
  );
}
