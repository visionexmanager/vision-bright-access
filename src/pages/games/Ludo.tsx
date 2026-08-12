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
import { playProductionSound } from "@/features/arcade/audio/playProductionSound";
import { BoardPieceMotion } from "@/features/arcade/motion/BoardPieceMotion";
import { Dices, Loader2, RotateCcw } from "lucide-react";
import {
  BASE_CELLS, CENTER, COLORS, Cell, FINISH, HOME_CELLS, PLAYERS, PlayerId, State, TRACK_CELLS,
  applyMove, cellOf, chooseToken, createGame, homeCount, legalTokens, nextPlayer, rollDie, winner,
} from "@/lib/games/ludoEngine";

const SIZE = 15;
const key = ([row, col]: Cell) => row * SIZE + col;

/** Static board colouring: track, home columns, bases, and the centre. */
function buildBoardTints(): Map<number, string> {
  const tints = new Map<number, string>();
  TRACK_CELLS.forEach((cell) => tints.set(key(cell), "track"));
  PLAYERS.forEach((player) => {
    HOME_CELLS[player].forEach((cell) => tints.set(key(cell), `home-${player}`));
    BASE_CELLS[player].forEach((cell) => tints.set(key(cell), `base-${player}`));
  });
  tints.set(key(CENTER), "center");
  return tints;
}

const TINTS = buildBoardTints();

export default function Ludo() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [game, setGame] = useState<State>(() => createGame());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "لودو",
    subtitle: "أنت اللون الأحمر ضد ثلاثة منافسين. أوصل أحجارك الأربعة إلى المركز أولاً.",
    roll: "ارمِ الزهر",
    newGame: "لعبة جديدة",
    yourTurn: "دورك — ارمِ الزهر.",
    pick: "اختر حجراً لتحريكه.",
    noMoves: "لا توجد حركة ممكنة، ينتقل الدور.",
    rivalTurn: "دور المنافسين…",
    captured: "أكلت حجر المنافس!",
    extra: "رمية إضافية!",
    won: "فزت! أوصلت كل أحجارك.",
    lost: "خسرت — سبقك أحد المنافسين.",
    home: "في المركز",
    die: "الزهر",
    token: "الحجر",
    base: "في البيت",
    players: { 0: "أنت", 1: "الأخضر", 2: "الأصفر", 3: "الأزرق" } as Record<PlayerId, string>,
    howTo: "كيف تلعب",
    steps: [
      "اضغط «ارمِ الزهر» في دورك.",
      "تحتاج رقم 6 لإخراج حجر من البيت إلى المسار.",
      "اضغط على أي حجر مضيء لتحريكه بعدد النقاط.",
      "إذا نزلت على حجر منافس أعدته إلى بيته، إلا على الخانات الآمنة.",
      "الرقم 6 أو الأكل أو إيصال حجر للمركز يمنحك رمية إضافية، والوصول للمركز يحتاج رمية مضبوطة.",
    ],
  } : {
    title: "Ludo",
    subtitle: "You are red against three rivals. Get all four tokens to the centre first.",
    roll: "Roll die",
    newGame: "New game",
    yourTurn: "Your turn — roll the die.",
    pick: "Pick a token to move.",
    noMoves: "No move available — the turn passes.",
    rivalTurn: "Rivals are playing…",
    captured: "You sent a rival token home!",
    extra: "Extra roll!",
    won: "You win — every token is home!",
    lost: "You lose — a rival finished first.",
    home: "Home",
    die: "Die",
    token: "Token",
    base: "in base",
    players: { 0: "You", 1: "Green", 2: "Yellow", 3: "Blue" } as Record<PlayerId, string>,
    howTo: "How to play",
    steps: [
      "Select “Roll die” on your turn.",
      "You need a 6 to release a token from base onto the track.",
      "Select any highlighted token to move it by the rolled amount.",
      "Landing on a rival token sends it home, except on the safe squares.",
      "A 6, a capture, or bringing a token home earns another roll; finishing needs an exact roll.",
    ],
  }), [ar]);

  const champion = winner(game);
  // You are player 0, so `champion` is falsy exactly when you have won. Every
  // check below compares against null instead of testing truthiness.
  const over = champion !== null;
  const myMoves = useMemo(
    () => (game.turn === 0 && game.die !== null && !over ? legalTokens(game, 0, game.die) : []),
    [game, over],
  );

  useEffect(() => {
    if (champion === null || settled.current) return;
    settled.current = true;
    playSound(champion === 0 ? "complete" : "error");
    setStatus(champion === 0 ? text.won : text.lost);
    void settleGameResult(champion === 0 ? "win" : "loss", "Ludo");
  }, [champion, playSound, settleGameResult, text.won, text.lost]);

  const roll = () => {
    const die = rollDie();
    setGame((current) => ({ ...current, die }));
    playSound("start");
    setStatus(`${text.die}: ${die}`);
  };

  // A roll with no legal token forfeits the turn.
  useEffect(() => {
    if (game.turn !== 0 || game.die === null || over) return;
    if (legalTokens(game, 0, game.die).length > 0) { setStatus(text.pick); return; }
    setStatus(text.noMoves);
    const timer = setTimeout(
      () => setGame((current) => ({ ...current, turn: nextPlayer(0), die: null })),
      900,
    );
    return () => clearTimeout(timer);
  }, [game, over, text.pick, text.noMoves]);

  const moveToken = (tokenIndex: number) => {
    if (game.turn !== 0 || game.die === null) return;
    const outcome = applyMove(game, 0, tokenIndex, game.die);
    playSound(outcome.captured ? "achievement" : "click");
    void playProductionSound("wood-piece-place", { playbackRate:outcome.captured ? 0.84 : 1.08, volume:0.88 });
    if (outcome.captured) setStatus(text.captured);
    else if (outcome.extraTurn) setStatus(text.extra);
    setGame({
      ...outcome.state,
      turn: outcome.extraTurn ? 0 : nextPlayer(0),
      die: null,
    });
  };

  const playRivals = useCallback((from: State): State => {
    let current = from;
    // Each rival rolls, moves if it can, and keeps rolling while it earns extra turns.
    while (current.turn !== 0 && !winner(current)) {
      const player = current.turn;
      let rolls = 0;
      let again = true;
      while (again && rolls < 4 && !winner(current)) {
        again = false;
        rolls += 1;
        const die = rollDie();
        const token = chooseToken(current, player, die);
        if (token === null) break;
        const outcome = applyMove(current, player, token, die);
        current = outcome.state;
        again = outcome.extraTurn;
      }
      current = { ...current, turn: nextPlayer(player), die: null };
    }
    return current;
  }, []);

  useEffect(() => {
    if (game.turn === 0 || over) return;
    setBusy(true);
    setStatus(text.rivalTurn);
    const timer = setTimeout(() => {
      setGame(playRivals(game));
      void playProductionSound("wood-piece-place", { playbackRate:0.96, volume:0.72 });
      setBusy(false);
      setStatus(text.yourTurn);
    }, 650);
    return () => { clearTimeout(timer); setBusy(false); };
  }, [game, over, playRivals, text.rivalTurn, text.yourTurn]);

  const restart = () => {
    setGame(createGame());
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  // Map every occupied cell to the tokens standing on it.
  const occupants = new Map<number, { player: PlayerId; token: number }[]>();
  PLAYERS.forEach((player) => {
    game.tokens[player].forEach((pos, token) => {
      const cell = key(cellOf(player, pos, token));
      const list = occupants.get(cell) ?? [];
      list.push({ player, token });
      occupants.set(cell, list);
    });
  });

  const movableCells = new Set(
    myMoves.map((token) => key(cellOf(0, game.tokens[0][token], token))),
  );

  // Player tints are per-colour, so they go through inline styles rather than
  // Tailwind classes, which cannot be generated from runtime values.
  const cellClass = (tint: string | undefined) => {
    if (!tint) return "bg-transparent";
    if (tint === "track") return "border border-border bg-card";
    if (tint === "center") return "bg-gradient-to-br from-rose-400 via-amber-300 to-blue-400";
    return "border border-border/40";
  };

  const cellStyle = (tint: string | undefined): React.CSSProperties | undefined => {
    if (!tint || tint === "track" || tint === "center") return undefined;
    const player = Number(tint.slice(-1)) as PlayerId;
    // Eight-digit hex adds the alpha channel: solid-ish home lanes, faint bases.
    return { backgroundColor: `${COLORS[player]}${tint.startsWith("home") ? "cc" : "33"}` };
  };

  return (
    <Layout>
      <section className="section-container max-w-2xl py-8">
        <GameHeader
          title={text.title}
          extra={<Badge variant="secondary">{text.home} {homeCount(game, 0)}/4</Badge>}
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={roll}
            disabled={game.turn !== 0 || game.die !== null || busy || over}
            className="gap-1.5"
          >
            <Dices className="h-4 w-4" aria-hidden="true" />{text.roll}
          </Button>
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
          {game.die !== null && (
            <Badge className="gap-1" aria-label={`${text.die}: ${game.die}`}>
              <Dices className="h-3 w-3" aria-hidden="true" />{game.die}
            </Badge>
          )}
          {PLAYERS.slice(1).map((player) => (
            <Badge key={player} variant="outline" className="gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[player] }} aria-hidden="true" />
              {text.players[player]} {homeCount(game, player)}/4
            </Badge>
          ))}
        </div>

        <p role="status" aria-live="polite" className="mb-3 flex min-h-5 items-center gap-2 text-sm font-medium text-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {status}
        </p>

        <Card>
          <CardContent className="p-3 sm:p-5">
            <div
              dir="ltr"
              role="grid"
              aria-label={text.title}
              className="mx-auto grid aspect-square w-full max-w-md gap-px rounded-lg bg-muted/30 p-1"
              style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: SIZE * SIZE }, (_, cell) => {
                const here = occupants.get(cell) ?? [];
                const mine = here.find((entry) => entry.player === 0);
                const movable = mine !== undefined && movableCells.has(cell);
                const top = here[0];

                return (
                  <button
                    key={cell}
                    type="button"
                    role="gridcell"
                    disabled={!movable}
                    onClick={() => movable && mine && moveToken(mine.token)}
                    aria-label={
                      here.length === 0
                        ? undefined
                        : here.map((entry) => {
                            const pos = game.tokens[entry.player][entry.token];
                            const where = pos === -1 ? text.base : pos === FINISH ? text.home : `${pos + 1}`;
                            return `${text.players[entry.player]} ${text.token} ${entry.token + 1}: ${where}`;
                          }).join("، ")
                    }
                    style={cellStyle(TINTS.get(cell))}
                    className={[
                      "relative flex items-center justify-center rounded-[2px]",
                      cellClass(TINTS.get(cell)),
                      movable ? "ring-2 ring-primary" : "",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ].join(" ")}
                  >
                    {top && (
                      <BoardPieceMotion
                        className="h-[74%] w-[74%] rounded-full border-2 border-white/80 shadow"
                        landed={movable}
                      >
                        <span className="block h-full w-full rounded-full" style={{ background: COLORS[top.player] }} aria-hidden="true" />
                      </BoardPieceMotion>
                    )}
                    {here.length > 1 && (
                      <span className="absolute bottom-0 end-0 text-[8px] font-black text-white" aria-hidden="true">
                        {here.length}
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
