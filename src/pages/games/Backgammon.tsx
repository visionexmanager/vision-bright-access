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
import { Dices, RotateCcw } from "lucide-react";
import {
  BAR, OFF, Move, State, applyMove, createGame, diceFromRoll, legalMoves,
  pipCount, planTurn, rollPair, winner,
} from "@/lib/games/backgammonEngine";

const TOP_ROW = Array.from({ length: 12 }, (_, i) => 12 + i);
const BOTTOM_ROW = Array.from({ length: 12 }, (_, i) => 11 - i);

function Checkers({ count, color }: { count: number; color: "w" | "b" }) {
  const shown = Math.min(count, 5);
  return (
    <>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-5 w-5 rounded-full border shadow-sm sm:h-6 sm:w-6 ${
            color === "w" ? "border-slate-300 bg-slate-50" : "border-slate-900 bg-slate-800"
          }`}
        />
      ))}
      {count > 5 && (
        <span className="text-[10px] font-bold text-foreground" aria-hidden="true">+{count - 5}</span>
      )}
    </>
  );
}

export default function Backgammon() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [game, setGame] = useState<State>(() => createGame("w"));
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "طاولة الزهر",
    subtitle: "أخرج كل أحجارك الخمسة عشر قبل الخصم. تلعب بالأبيض من اليمين إلى اليسار.",
    roll: "ارمِ الزهر",
    endTurn: "إنهاء الدور",
    newGame: "لعبة جديدة",
    yourTurn: "دورك — اختر حجراً ثم وجهته.",
    botTurn: "دور الخصم…",
    noMoves: "لا توجد حركات متاحة، ينتقل الدور.",
    hit: "ضربت حجر الخصم!",
    won: "فزت! أخرجت كل أحجارك.",
    lost: "خسرت — الخصم أخرج كل أحجاره.",
    bar: "البار",
    off: "الأحجار المخرَجة",
    pip: "النقاط المتبقية",
    you: "أنت",
    rival: "الخصم",
    point: "النقطة",
    empty: "فارغة",
    dice: "الزهر",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على «ارمِ الزهر» لبدء دورك.",
      "اضغط على نقطة تحمل أحجارك، ثم على إحدى الوجهات المميزة.",
      "لا يمكنك النزول على نقطة يحتلها حجران للخصم أو أكثر.",
      "إذا نزلت على حجر مفرد للخصم فإنه يعود إلى البار ويجب أن يدخل قبل أي حركة أخرى.",
      "بعد جمع كل أحجارك في بيتك يمكنك البدء بإخراجها من الرقعة.",
    ],
  } : {
    title: "Backgammon",
    subtitle: "Bear off all fifteen checkers before your rival. You play white, moving right to left.",
    roll: "Roll dice",
    endTurn: "End turn",
    newGame: "New game",
    yourTurn: "Your turn — pick a checker, then its destination.",
    botTurn: "Rival is playing…",
    noMoves: "No legal moves — turn passes.",
    hit: "You hit your rival's blot!",
    won: "You win — every checker is off!",
    lost: "You lose — your rival bore off first.",
    bar: "Bar",
    off: "Borne off",
    pip: "Pips left",
    you: "You",
    rival: "Rival",
    point: "Point",
    empty: "empty",
    dice: "Dice",
    howTo: "How to play",
    steps: [
      "Select “Roll dice” to start your turn.",
      "Select a point holding your checkers, then one of the highlighted destinations.",
      "You may not land on a point held by two or more rival checkers.",
      "Landing on a lone rival checker sends it to the bar, and it must re-enter first.",
      "Once all your checkers are home you may start bearing them off.",
    ],
  }), [ar]);

  const champion = winner(game);
  const playerMoves = useMemo(
    () => (game.turn === "w" && game.dice.length > 0 && !champion ? legalMoves(game, "w") : []),
    [game, champion],
  );

  useEffect(() => {
    if (!champion || settled.current) return;
    settled.current = true;
    playSound(champion === "w" ? "complete" : "error");
    setStatus(champion === "w" ? text.won : text.lost);
    void settleGameResult(champion === "w" ? "win" : "loss", "Backgammon");
  }, [champion, playSound, settleGameResult, text.won, text.lost]);

  const endTurn = useCallback((from: State): State => ({
    ...from,
    turn: from.turn === "w" ? "b" : "w",
    dice: [],
    rolled: null,
  }), []);

  const roll = () => {
    const pair = rollPair();
    setGame((current) => ({ ...current, rolled: pair, dice: diceFromRoll(pair) }));
    setSelected(null);
    setStatus(text.yourTurn);
    playSound("start");
  };

  // A player with dice but no legal move forfeits the rest of the turn.
  useEffect(() => {
    if (game.turn !== "w" || champion || game.dice.length === 0) return;
    if (legalMoves(game, "w").length > 0) return;
    setStatus(text.noMoves);
    const timer = setTimeout(() => setGame(endTurn), 900);
    return () => clearTimeout(timer);
  }, [game, champion, endTurn, text.noMoves]);

  // The rival rolls, plays its whole sequence, then hands the turn back.
  useEffect(() => {
    if (game.turn !== "b" || champion) return;
    setStatus(text.botTurn);
    const timer = setTimeout(() => {
      const pair = rollPair();
      let current: State = { ...game, rolled: pair, dice: diceFromRoll(pair) };
      for (const move of planTurn(current, "b")) {
        current = applyMove(current, move);
      }
      playSound("navigate");
      setGame(endTurn(current));
      setStatus(text.yourTurn);
    }, 700);
    return () => clearTimeout(timer);
  }, [game, champion, endTurn, playSound, text.botTurn, text.yourTurn]);

  const play = (move: Move) => {
    setGame((current) => applyMove(current, move));
    setSelected(null);
    playSound(move.hit ? "achievement" : "click");
    if (move.hit) setStatus(text.hit);
  };

  const onPointClick = (index: number) => {
    if (game.turn !== "w" || champion) return;

    if (selected !== null) {
      const move = playerMoves.find((option) => option.from === selected && option.to === index);
      if (move) { play(move); return; }
    }

    if (playerMoves.some((option) => option.from === index)) {
      setSelected(index === selected ? null : index);
      playSound("select");
    } else {
      setSelected(null);
    }
  };

  const restart = () => {
    setGame(createGame("w"));
    setSelected(null);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const destinations = new Set(
    selected === null ? [] : playerMoves.filter((move) => move.from === selected).map((move) => move.to),
  );
  const sources = new Set(playerMoves.map((move) => move.from));
  const canBearOff = selected !== null && destinations.has(OFF);

  const renderPoint = (index: number, top: boolean) => {
    const value = game.points[index];
    const count = Math.abs(value);
    const color: "w" | "b" = value > 0 ? "w" : "b";
    const isSource = sources.has(index);
    const isTarget = destinations.has(index);
    return (
      <button
        key={index}
        type="button"
        onClick={() => onPointClick(index)}
        disabled={game.turn !== "w" || !!champion}
        aria-label={`${text.point} ${index + 1}: ${
          count === 0 ? text.empty : `${count} ${color === "w" ? text.you : text.rival}`
        }`}
        aria-selected={index === selected}
        className={[
          "flex min-h-[110px] flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1 sm:min-h-[140px]",
          top ? "justify-start" : "justify-end",
          index % 2 === 0 ? "bg-amber-100/60 dark:bg-amber-950/30" : "bg-amber-200/50 dark:bg-amber-900/30",
          index === selected ? "ring-2 ring-primary" : "",
          isTarget ? "ring-2 ring-emerald-500" : "",
          isSource && index !== selected ? "ring-1 ring-primary/40" : "",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" ")}
      >
        {count > 0 && <Checkers count={count} color={color} />}
      </button>
    );
  };

  return (
    <Layout>
      <section className="section-container max-w-4xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <>
              <Badge variant="outline">{text.pip} {pipCount(game, "w")}</Badge>
              <Badge variant="secondary">{text.off} {game.off.w}/15</Badge>
            </>
          }
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={roll}
            disabled={game.turn !== "w" || game.dice.length > 0 || !!champion}
            className="gap-1.5"
          >
            <Dices className="h-4 w-4" aria-hidden="true" />{text.roll}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGame(endTurn)}
            disabled={game.turn !== "w" || game.dice.length === 0 || !!champion}
          >
            {text.endTurn}
          </Button>
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
          {game.dice.length > 0 && (
            <Badge className="gap-1" aria-label={`${text.dice}: ${game.dice.join(", ")}`}>
              <Dices className="h-3 w-3" aria-hidden="true" />{game.dice.join(" · ")}
            </Badge>
          )}
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent dir="ltr" className="overflow-x-auto p-2 sm:p-4">
            <div className="min-w-[640px] rounded-lg border bg-amber-50/50 p-2 dark:bg-amber-950/20">
              <div className="flex gap-0.5">{TOP_ROW.map((index) => renderPoint(index, true))}</div>

              <div className="my-2 flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onPointClick(BAR)}
                  disabled={game.turn !== "w" || game.bar.w === 0 || !!champion}
                  aria-label={`${text.bar} ${text.you}: ${game.bar.w}`}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 font-semibold ${
                    selected === BAR ? "ring-2 ring-primary" : ""
                  } ${game.bar.w > 0 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                >
                  {text.bar} {text.you}: {game.bar.w}
                </button>
                <span className="text-muted-foreground">
                  {text.bar} {text.rival}: {game.bar.b}
                </span>
                <button
                  type="button"
                  onClick={() => canBearOff && play(playerMoves.find((move) => move.from === selected && move.to === OFF) as Move)}
                  disabled={!canBearOff}
                  aria-label={`${text.off} ${text.you}: ${game.off.w}`}
                  className={`rounded px-2 py-1 font-semibold ${
                    canBearOff ? "bg-emerald-500/20 text-emerald-700 ring-2 ring-emerald-500 dark:text-emerald-300" : "text-muted-foreground"
                  }`}
                >
                  {text.off}: {game.off.w} / {game.off.b}
                </button>
              </div>

              <div className="flex gap-0.5">{BOTTOM_ROW.map((index) => renderPoint(index, false))}</div>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
