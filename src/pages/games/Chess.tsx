import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { Loader2, RotateCcw } from "lucide-react";
import {
  Level, Move, PIECE_GLYPH, PieceType, Position, bestMove, describeMove, fileOf,
  gameResult, initialPosition, isInCheck, legalMoves, makeMove, pieceName, rankOf, squareName,
} from "@/lib/games/chessEngine";

const LEVELS: Level[] = ["easy", "medium", "hard"];
const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

export default function Chess() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [level, setLevel] = useState<Level>("medium");
  const [position, setPosition] = useState<Position>(() => initialPosition());
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "شطرنج",
    subtitle: "تلعب بالأبيض ضد محرك يحسب حركاته. مات الملك ينهي المباراة.",
    levels: { easy: "سهل", medium: "متوسط", hard: "صعب" },
    newGame: "مباراة جديدة",
    thinking: "الخصم يفكر…",
    yourTurn: "دورك.",
    check: "كش ملك!",
    youWin: "كش مات — فزت!",
    youLose: "كش مات — خسرت.",
    stalemate: "تعادل بالجمود.",
    draw: "تعادل.",
    promote: "اختر الترقية",
    moves: "الحركات",
    pieces: { q: "وزير", r: "رخ", b: "فيل", n: "حصان" } as Record<string, string>,
    emptySquare: "خانة فارغة",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على قطعة بيضاء لعرض حركاتها القانونية المميزة على الرقعة.",
      "اضغط على الخانة الهدف لتنفيذ الحركة.",
      "التبييت والأخذ بالمرور وترقية البيدق كلها مدعومة.",
      "غيّر مستوى الصعوبة لتعديل عمق حساب المحرك.",
      "كل خانة لها اسمها بصيغة الشطرنج المعتادة لقارئ الشاشة.",
    ],
  } : {
    title: "Chess",
    subtitle: "You play white against a calculating engine. Checkmate ends the match.",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    newGame: "New match",
    thinking: "Opponent is thinking…",
    yourTurn: "Your turn.",
    check: "Check!",
    youWin: "Checkmate — you win!",
    youLose: "Checkmate — you lose.",
    stalemate: "Stalemate — a draw.",
    draw: "Draw.",
    promote: "Choose promotion",
    moves: "Moves",
    pieces: { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" } as Record<string, string>,
    emptySquare: "empty square",
    howTo: "How to play",
    steps: [
      "Select a white piece to highlight every legal move on the board.",
      "Select the highlighted square to play the move.",
      "Castling, en passant, and pawn promotion are all supported.",
      "Change the difficulty to adjust how deep the engine calculates.",
      "Every square is announced with its standard chess name for screen readers.",
    ],
  }), [ar]);

  const result = useMemo(() => gameResult(position), [position]);
  const targets = useMemo(
    () => (selected === null ? [] : legalMoves(position, selected)),
    [position, selected],
  );

  const applyMove = useCallback((move: Move) => {
    setHistory((past) => [...past, describeMove(position, move, ar)]);
    setPosition(makeMove(position, move));
    setSelected(null);
    playSound(move.captured ? "points" : "click");
  }, [position, ar, playSound]);

  const onSquareClick = (index: number) => {
    if (result !== "playing" || thinking || position.turn !== "w") return;

    const candidates = targets.filter((move) => move.to === index);
    if (candidates.length > 0) {
      // A pawn reaching the last rank yields four moves that differ only by promotion.
      if (candidates.length > 1 && candidates[0].promotion) {
        setPending({ from: candidates[0].from, to: index });
        return;
      }
      applyMove(candidates[0]);
      return;
    }

    const piece = position.board[index];
    if (piece?.color === "w") {
      setSelected(index === selected ? null : index);
      playSound("select");
    } else {
      setSelected(null);
    }
  };

  const choosePromotion = (promotion: PieceType) => {
    if (!pending) return;
    const move = legalMoves(position, pending.from)
      .find((option) => option.to === pending.to && option.promotion === promotion);
    setPending(null);
    if (move) applyMove(move);
  };

  // The engine moves for black once the player's move has rendered.
  useEffect(() => {
    if (position.turn !== "b" || gameResult(position) !== "playing") return;
    setThinking(true);
    const timer = setTimeout(() => {
      const move = bestMove(position, level);
      if (move) {
        setHistory((past) => [...past, describeMove(position, move, ar)]);
        setPosition(makeMove(position, move));
        playSound(move.captured ? "points" : "click");
      }
      setThinking(false);
    }, 260);
    return () => { clearTimeout(timer); setThinking(false); };
  }, [position, level, ar, playSound]);

  useEffect(() => {
    if (settled.current) return;
    if (result === "checkmate") {
      settled.current = true;
      // The side to move is the one that has been mated.
      const playerWon = position.turn === "b";
      playSound(playerWon ? "complete" : "error");
      setStatus(playerWon ? text.youWin : text.youLose);
      void settleGameResult(playerWon ? "win" : "loss", "Chess");
    } else if (result === "stalemate" || result === "draw") {
      settled.current = true;
      playSound("notification");
      setStatus(result === "stalemate" ? text.stalemate : text.draw);
    } else {
      setStatus(isInCheck(position) ? text.check : thinking ? text.thinking : text.yourTurn);
    }
  }, [result, position, thinking, playSound, settleGameResult, text]);

  const restart = () => {
    setPosition(initialPosition());
    setSelected(null);
    setPending(null);
    setHistory([]);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const targetSquares = new Set(targets.map((move) => move.to));

  return (
    <Layout>
      <section className="section-container max-w-3xl py-8">
        <GameHeader
          title={text.title}
          extra={<Badge variant="outline">{text.moves} {history.length}</Badge>}
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
              className="mx-auto grid w-full max-w-lg grid-cols-8 overflow-hidden rounded-lg border"
            >
              {position.board.map((piece, index) => {
                const dark = (fileOf(index) + rankOf(index)) % 2 === 1;
                const isTarget = targetSquares.has(index);
                return (
                  <button
                    key={index}
                    type="button"
                    role="gridcell"
                    disabled={result !== "playing" || thinking}
                    onClick={() => onSquareClick(index)}
                    aria-label={`${squareName(index)}: ${piece ? pieceName(piece, ar) : text.emptySquare}`}
                    aria-selected={index === selected}
                    className={[
                      "relative flex aspect-square items-center justify-center text-3xl leading-none sm:text-4xl",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      dark ? "bg-emerald-800/70" : "bg-emerald-50",
                      index === selected ? "!bg-amber-400/80" : "",
                      piece?.color === "w" ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]" : "text-slate-950",
                    ].join(" ")}
                  >
                    {piece ? PIECE_GLYPH[piece.color][piece.type] : ""}
                    {isTarget && (
                      <span
                        aria-hidden="true"
                        className={`absolute rounded-full bg-primary/70 ${piece ? "inset-1 border-4 border-primary/70 bg-transparent" : "h-3 w-3"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {history.length > 0 && (
              <ol dir="ltr" className="mt-4 flex max-h-24 flex-wrap gap-x-3 gap-y-1 overflow-y-auto text-xs text-muted-foreground">
                {history.map((entry, index) => (
                  <li key={`${entry}-${index}`}>
                    <span className="font-semibold text-foreground">{Math.floor(index / 2) + 1}.</span> {entry}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />

        <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle>{text.promote}</DialogTitle></DialogHeader>
            <div className="flex justify-center gap-2">
              {PROMOTIONS.map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-14 w-14 text-3xl"
                  aria-label={text.pieces[type]}
                  onClick={() => choosePromotion(type)}
                >
                  {PIECE_GLYPH.w[type]}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
