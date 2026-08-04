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
import { ArrowLeft, ArrowRight, ArrowUp, Gem, RotateCcw, Skull } from "lucide-react";
import {
  Action, LEVELS, State,
  applyAction, atLockedExit, colCount, createGame, remainingGems, rowCount, visibleTile,
} from "@/lib/games/skyboundEngine";

/** Static appearance per tile. Colours only ever repeat information the label carries. */
const TILE_CLASS: Record<string, string> = {
  empty: "bg-sky-100/60 dark:bg-sky-950/40",
  solid: "bg-gradient-to-b from-lime-600 to-amber-900",
  hazard: "bg-sky-100/60 dark:bg-sky-950/40",
  gem: "bg-sky-100/60 dark:bg-sky-950/40",
  exit: "bg-sky-100/60 dark:bg-sky-950/40",
};

export default function SkyboundQuest() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [game, setGame] = useState<State>(() => createGame(0));
  const [status, setStatus] = useState("");
  const settled = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const text = useMemo(() => (ar ? {
    title: "مغامرة بوابة السماء",
    subtitle: "اجمع كل الجواهر ثم ادخل البوابة. كل ضغطة حركة كاملة، فلا سباق مع الوقت.",
    level: "المرحلة",
    gems: "الجواهر",
    moves: "الحركات",
    newGame: "من البداية",
    retry: "أعد المرحلة",
    next: "المرحلة التالية",
    left: "خطوة لليسار",
    right: "خطوة لليمين",
    jumpUp: "قفزة للأعلى",
    jumpLeft: "قفزة لليسار",
    jumpRight: "قفزة لليمين",
    blocked: "جدار يمنع الحركة.",
    gotGem: "أخذت جوهرة!",
    lockedExit: "البوابة مقفلة — ما زالت هناك جواهر.",
    won: "أنهيت المرحلة!",
    finished: "أنهيت كل المراحل! أحسنت.",
    lost: "سقطت. أعد المرحلة وحاول مساراً آخر.",
    tiles: { empty: "فراغ", solid: "أرض صلبة", hazard: "أشواك", gem: "جوهرة", exit: "البوابة" } as Record<string, string>,
    you: "أنت هنا",
    row: "صف",
    col: "عمود",
    howTo: "كيف تلعب",
    steps: [
      "استخدم السهمين يمين ويسار للمشي خطوة واحدة، والسهم للأعلى للقفز في مكانك.",
      "اضغط Shift مع السهم يمين أو يسار للقفز في ذلك الاتجاه، أو استعمل الأزرار الظاهرة.",
      "القفزة ترتفع صفين ثم تنتقل عمودين، ولا يمكن القفز إلا من على أرض صلبة.",
      "اجمع كل الجواهر قبل البوابة، فهي تبقى مقفلة ما دامت جوهرة واحدة ناقصة.",
      "لمس الأشواك أو السقوط خارج الخريطة يعيد المرحلة، ولا يوجد مؤقت يضغط عليك.",
    ],
  } : {
    title: "Skybound Quest",
    subtitle: "Collect every gem, then reach the gate. Each key press is one whole move, so nothing is timed.",
    level: "Level",
    gems: "Gems",
    moves: "Moves",
    newGame: "Start over",
    retry: "Retry level",
    next: "Next level",
    left: "Step left",
    right: "Step right",
    jumpUp: "Jump up",
    jumpLeft: "Jump left",
    jumpRight: "Jump right",
    blocked: "A wall blocks that move.",
    gotGem: "Gem collected!",
    lockedExit: "The gate is locked — gems are still missing.",
    won: "Level complete!",
    finished: "Every level cleared. Well done.",
    lost: "You fell. Retry the level and try another route.",
    tiles: { empty: "empty", solid: "solid ground", hazard: "spikes", gem: "gem", exit: "gate" } as Record<string, string>,
    you: "you are here",
    row: "row",
    col: "column",
    howTo: "How to play",
    steps: [
      "Use Left and Right arrows to walk one step, and Up arrow to jump straight up.",
      "Hold Shift with Left or Right to jump that way, or use the on-screen buttons.",
      "A jump rises two rows then travels two columns, and only works from solid ground.",
      "Collect every gem before the gate — it stays locked while even one is missing.",
      "Touching spikes or falling off the map restarts the level, and nothing is on a timer.",
    ],
  }), [ar]);

  const isLastLevel = game.level === LEVELS.length - 1;

  const act = useCallback((action: Action) => {
    setGame((current) => {
      if (current.status !== "playing") return current;
      const next = applyAction(current, action);
      if (next === current) {
        setStatus(text.blocked);
        playSound("error");
        return current;
      }
      if (next.status === "lost") {
        playSound("error");
        setStatus(text.lost);
      } else if (next.status === "won") {
        playSound("complete");
        setStatus(current.level === LEVELS.length - 1 ? text.finished : text.won);
      } else if (next.collected.size > current.collected.size) {
        playSound("achievement");
        setStatus(text.gotGem);
      } else if (atLockedExit(next)) {
        playSound("click");
        setStatus(text.lockedExit);
      } else {
        playSound("click");
        setStatus("");
      }
      return next;
    });
  }, [playSound, text.blocked, text.finished, text.gotGem, text.lockedExit, text.lost, text.won]);

  // The board is the keyboard surface, so arrows never fight page scrolling.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const jump = event.shiftKey;
    const map: Record<string, Action | undefined> = {
      ArrowLeft: jump ? { kind: "jump", dx: -1 } : { kind: "step", dx: -1 },
      ArrowRight: jump ? { kind: "jump", dx: 1 } : { kind: "step", dx: 1 },
      ArrowUp: { kind: "jump", dx: 0 },
    };
    const action = map[event.key];
    if (!action) return;
    event.preventDefault();
    act(action);
  };

  useEffect(() => {
    if (game.status !== "won" || settled.current) return;
    settled.current = true;
    void settleGameResult("win", "Skybound Quest");
  }, [game.status, settleGameResult]);

  const restart = (level: number) => {
    setGame(createGame(level));
    setStatus("");
    settled.current = false;
    playSound("start");
    boardRef.current?.focus();
  };

  const rows = rowCount(game);
  const cols = colCount(game);

  const describe = (row: number, col: number) => {
    const tile = visibleTile(game, row, col);
    const here = game.player.row === row && game.player.col === col;
    const name = text.tiles[tile === "outside" ? "empty" : tile];
    const where = `${text.row} ${row + 1}${ar ? "، " : ", "}${text.col} ${col + 1}`;
    return here ? `${text.you}. ${name}. ${where}` : `${name}. ${where}`;
  };

  return (
    <Layout>
      <section className="section-container max-w-2xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <Badge variant="secondary" className="gap-1">
              <Gem className="h-3 w-3" aria-hidden="true" />
              {game.gemTotal - remainingGems(game)}/{game.gemTotal}
            </Badge>
          }
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{text.level} {game.level + 1}/{LEVELS.length}</Badge>
          <Badge variant="outline">{text.moves} {game.moves}</Badge>
          {game.status === "won" && !isLastLevel && (
            <Button size="sm" onClick={() => restart(game.level + 1)}>{text.next}</Button>
          )}
          {game.status === "lost" && (
            <Button size="sm" onClick={() => restart(game.level)} className="gap-1.5">
              <Skull className="h-4 w-4" aria-hidden="true" />{text.retry}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => restart(0)} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="p-3 sm:p-5">
            <div
              ref={boardRef}
              dir="ltr"
              role="grid"
              tabIndex={0}
              aria-label={`${text.title} — ${text.level} ${game.level + 1}`}
              onKeyDown={onKeyDown}
              className="mx-auto grid w-full gap-px rounded-lg bg-muted/30 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, aspectRatio: `${cols} / ${rows}` }}
            >
              {Array.from({ length: rows * cols }, (_, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                const tile = visibleTile(game, row, col);
                const here = game.player.row === row && game.player.col === col;

                return (
                  <div
                    key={index}
                    role="gridcell"
                    aria-label={describe(row, col)}
                    className={[
                      "relative flex items-center justify-center rounded-[2px] text-[10px] sm:text-sm",
                      TILE_CLASS[tile] ?? TILE_CLASS.empty,
                    ].join(" ")}
                  >
                    {tile === "gem" && <Gem className="h-3/5 w-3/5 text-amber-500" aria-hidden="true" />}
                    {tile === "hazard" && (
                      <span className="h-0 w-0 border-x-[0.35em] border-b-[0.6em] border-x-transparent border-b-red-500" aria-hidden="true" />
                    )}
                    {tile === "exit" && (
                      <span className="h-4/5 w-3/5 rounded-sm border-2 border-yellow-400 bg-slate-800" aria-hidden="true" />
                    )}
                    {here && (
                      <span className="absolute h-3/5 w-3/5 rounded-full border-2 border-white bg-blue-600 shadow" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => act({ kind: "step", dx: -1 })} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />{text.left}
              </Button>
              <Button size="sm" variant="outline" onClick={() => act({ kind: "jump", dx: -1 })} className="gap-1.5">
                <ArrowUp className="h-4 w-4 -rotate-45" aria-hidden="true" />{text.jumpLeft}
              </Button>
              <Button size="sm" variant="outline" onClick={() => act({ kind: "jump", dx: 0 })} className="gap-1.5">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />{text.jumpUp}
              </Button>
              <Button size="sm" variant="outline" onClick={() => act({ kind: "jump", dx: 1 })} className="gap-1.5">
                <ArrowUp className="h-4 w-4 rotate-45" aria-hidden="true" />{text.jumpRight}
              </Button>
              <Button size="sm" variant="outline" onClick={() => act({ kind: "step", dx: 1 })} className="gap-1.5">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />{text.right}
              </Button>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
