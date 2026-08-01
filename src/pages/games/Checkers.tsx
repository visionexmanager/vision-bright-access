import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { Crown, Loader2, RotateCcw } from "lucide-react";
import {
  Board, Level, Move, applyMove, bestMove, colOf, countPieces, createBoard,
  isDark, legalMoves, result, rowOf,
} from "@/lib/games/checkersEngine";

const LEVELS: Level[] = ["easy", "medium", "hard"];

export default function Checkers() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [level, setLevel] = useState<Level>("medium");
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "الدامة",
    subtitle: "تلعب بالأحجار الفاتحة. الأكل إجباري، والحجر الذي يبلغ الصف الأخير يصبح داماً.",
    levels: { easy: "سهل", medium: "متوسط", hard: "صعب" },
    newGame: "لعبة جديدة",
    yourTurn: "دورك — اختر حجراً.",
    mustCapture: "الأكل إجباري هذا الدور.",
    thinking: "الخصم يفكر…",
    youWin: "فزت! لم يبقَ للخصم حركة.",
    youLose: "خسرت — لم تبقَ لك حركة.",
    yourPieces: "أحجارك",
    rivalPieces: "أحجار الخصم",
    square: "خانة",
    empty: "فارغة",
    yours: "حجرك",
    rivals: "حجر الخصم",
    king: "دام",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على أحد أحجارك لعرض وجهاته المتاحة.",
      "الحجر العادي يتحرك قطرياً للأمام خانة واحدة.",
      "الأكل بالقفز فوق حجر الخصم إلى خانة فارغة خلفه، والأكل المتسلسل محسوب تلقائياً.",
      "إذا توفر أكل فأنت ملزم به، ولن تظهر لك الحركات العادية.",
      "الحجر الذي يصل الصف الأخير يصبح داماً ويتحرك في الاتجاهين.",
    ],
  } : {
    title: "Checkers",
    subtitle: "You play the light pieces. Capturing is compulsory, and reaching the far row crowns a king.",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    newGame: "New game",
    yourTurn: "Your turn — pick a piece.",
    mustCapture: "A capture is compulsory this turn.",
    thinking: "Rival is thinking…",
    youWin: "You win — your rival has no move left.",
    youLose: "You lose — you have no move left.",
    yourPieces: "Your pieces",
    rivalPieces: "Rival pieces",
    square: "square",
    empty: "empty",
    yours: "your piece",
    rivals: "rival piece",
    king: "king",
    howTo: "How to play",
    steps: [
      "Select one of your pieces to see where it can go.",
      "A plain piece moves one square diagonally forward.",
      "Capture by jumping a rival piece onto the empty square beyond; chains are worked out for you.",
      "When a capture exists you must take it, so quiet moves are hidden.",
      "A piece reaching the far row is crowned and may then move both ways.",
    ],
  }), [ar]);

  const outcome = useMemo(() => result(board, turn), [board, turn]);
  const moves = useMemo(
    () => (turn === "w" && outcome === "playing" ? legalMoves(board, "w") : []),
    [board, turn, outcome],
  );
  const mustCapture = moves.some((move) => move.captures.length > 0);

  const play = (move: Move) => {
    setBoard(applyMove(board, move));
    setTurn("b");
    setSelected(null);
    playSound(move.captures.length > 0 ? "points" : "click");
  };

  const onSquareClick = (index: number) => {
    if (turn !== "w" || outcome !== "playing" || thinking) return;

    if (selected !== null) {
      const move = moves.find((option) =>
        option.path[0] === selected && option.path[option.path.length - 1] === index);
      if (move) { play(move); return; }
    }

    if (moves.some((option) => option.path[0] === index)) {
      setSelected(index === selected ? null : index);
      playSound("select");
    } else {
      setSelected(null);
    }
  };

  // The rival replies once the player's move has rendered.
  useEffect(() => {
    if (turn !== "b" || result(board, "b") !== "playing") return;
    setThinking(true);
    const timer = setTimeout(() => {
      const move = bestMove(board, "b", level);
      if (move) {
        setBoard(applyMove(board, move));
        playSound(move.captures.length > 0 ? "points" : "click");
      }
      setTurn("w");
      setThinking(false);
    }, 320);
    return () => { clearTimeout(timer); setThinking(false); };
  }, [turn, board, level, playSound]);

  useEffect(() => {
    if (settled.current) return;
    if (outcome === "w") {
      settled.current = true;
      playSound("complete");
      setStatus(text.youWin);
      void settleGameResult("win", "Checkers");
    } else if (outcome === "b") {
      settled.current = true;
      playSound("error");
      setStatus(text.youLose);
      void settleGameResult("loss", "Checkers");
    } else if (thinking) {
      setStatus(text.thinking);
    } else {
      setStatus(mustCapture ? text.mustCapture : text.yourTurn);
    }
  }, [outcome, thinking, mustCapture, playSound, settleGameResult, text]);

  const restart = () => {
    setBoard(createBoard());
    setTurn("w");
    setSelected(null);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const destinations = new Set(
    selected === null
      ? []
      : moves.filter((move) => move.path[0] === selected).map((move) => move.path[move.path.length - 1]),
  );
  const sources = new Set(moves.map((move) => move.path[0]));

  return (
    <Layout>
      <section className="section-container max-w-2xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <>
              <Badge variant="secondary">{text.yourPieces} {countPieces(board, "w")}</Badge>
              <Badge variant="outline">{text.rivalPieces} {countPieces(board, "b")}</Badge>
            </>
          }
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
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 flex min-h-5 items-center gap-2 text-sm font-medium text-primary">
          {thinking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {status}
        </p>

        <Card>
          <CardContent className="p-3 sm:p-5">
            <div
              dir="ltr"
              role="grid"
              aria-label={text.title}
              className="mx-auto grid w-full max-w-md grid-cols-8 overflow-hidden rounded-lg border"
            >
              {board.map((piece, index) => {
                const dark = isDark(index);
                const isTarget = destinations.has(index);
                const label = piece
                  ? `${piece.side === "w" ? text.yours : text.rivals}${piece.king ? ` ${text.king}` : ""}`
                  : text.empty;
                return (
                  <button
                    key={index}
                    type="button"
                    role="gridcell"
                    disabled={!dark || turn !== "w" || outcome !== "playing" || thinking}
                    onClick={() => onSquareClick(index)}
                    aria-label={`${text.square} ${rowOf(index) + 1}-${colOf(index) + 1}: ${label}`}
                    aria-selected={index === selected}
                    className={[
                      "relative flex aspect-square items-center justify-center",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      dark ? "bg-amber-800" : "bg-amber-100",
                      index === selected ? "!bg-primary/50" : "",
                      isTarget ? "!bg-emerald-500/60" : "",
                      !isTarget && index !== selected && sources.has(index) ? "ring-2 ring-primary/40 ring-inset" : "",
                    ].join(" ")}
                  >
                    {piece && (
                      <span
                        className={[
                          "flex h-[72%] w-[72%] items-center justify-center rounded-full border-2 shadow-md",
                          piece.side === "w"
                            ? "border-slate-300 bg-slate-50 text-amber-600"
                            : "border-slate-900 bg-slate-800 text-amber-400",
                        ].join(" ")}
                      >
                        {piece.king && <Crown className="h-1/2 w-1/2" aria-hidden="true" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
