import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { RotateCcw, Sparkles, Undo2 } from "lucide-react";
import {
  Card, GameState, SUITS, SUIT_SYMBOL, RANK_LABEL, Source, Target,
  autoCollect, cardLabel, createGame, drawFromStock, isRed, isWon, moveTo, score,
} from "@/lib/games/solitaireEngine";

function CardFace({ card, ar }: { card: Card; ar: boolean }) {
  const red = isRed(card.suit);
  return (
    <span className={`flex h-full w-full flex-col items-center justify-center leading-none ${red ? "text-rose-600" : "text-slate-900 dark:text-slate-100"}`}>
      <span className="text-sm font-black">{RANK_LABEL[card.rank]}</span>
      <span className="text-base" aria-hidden="true">{SUIT_SYMBOL[card.suit]}</span>
      <span className="sr-only">{cardLabel(card, ar)}</span>
    </span>
  );
}

const CARD_BASE = "h-16 w-11 rounded-md border shadow-sm transition-all sm:h-20 sm:w-14";

export default function Solitaire() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [state, setState] = useState<GameState>(() => createGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [selection, setSelection] = useState<Source | null>(null);
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "سوليتير كلوندايك",
    subtitle: "رتّب الأوراق الأربع من الآس حتى الملك في الأكوام العلوية.",
    newGame: "لعبة جديدة",
    undo: "تراجع",
    auto: "جمع تلقائي",
    moves: "الحركات",
    score: "النقاط",
    stock: "مجموعة السحب",
    waste: "الورقة المسحوبة",
    empty: "فارغ",
    faceDown: "ورقة مقلوبة",
    column: "العمود",
    foundation: "كومة الأساس",
    won: "مبروك! أكملت السوليتير.",
    illegal: "حركة غير مسموحة.",
    howTo: "كيف تلعب",
    steps: [
      "اضغط على ورقة مكشوفة لاختيارها، ثم اضغط على المكان الذي تريد نقلها إليه.",
      "في الأعمدة تُرتَّب الأوراق تنازلياً مع تبديل اللون بين الأحمر والأسود.",
      "الملك فقط يمكن وضعه في عمود فارغ.",
      "اضغط على مجموعة السحب لقلب ورقة جديدة، وعند نفادها تُعاد الأوراق تلقائياً.",
      "استخدم الجمع التلقائي لإرسال كل ورقة جاهزة إلى كومة الأساس.",
    ],
  } : {
    title: "Klondike Solitaire",
    subtitle: "Build all four suits from Ace to King on the foundation piles.",
    newGame: "New game",
    undo: "Undo",
    auto: "Auto collect",
    moves: "Moves",
    score: "Score",
    stock: "Stock pile",
    waste: "Drawn card",
    empty: "empty",
    faceDown: "face-down card",
    column: "Column",
    foundation: "Foundation",
    won: "Congratulations — solitaire complete!",
    illegal: "That move is not allowed.",
    howTo: "How to play",
    steps: [
      "Select a face-up card, then select where you want to move it.",
      "Columns build downward, alternating red and black cards.",
      "Only a King may be placed into an empty column.",
      "Select the stock pile to turn a new card; it recycles when it runs out.",
      "Use auto collect to send every ready card to its foundation.",
    ],
  }), [ar]);

  const won = isWon(state);

  useEffect(() => {
    if (!won || settled.current) return;
    settled.current = true;
    playSound("complete");
    setStatus(text.won);
    void settleGameResult("win", "Klondike Solitaire");
  }, [won, playSound, settleGameResult, text.won]);

  const commit = (next: GameState, sound: "click" | "points" = "click") => {
    if (next === state) { setStatus(text.illegal); playSound("error"); return false; }
    setHistory((past) => [...past.slice(-40), state]);
    setState(next);
    setStatus("");
    playSound(sound);
    return true;
  };

  const attempt = (target: Target) => {
    if (!selection) return false;
    const next = moveTo(state, selection, target);
    if (next === state) return false;
    commit(next, target.pile === "foundation" ? "points" : "click");
    setSelection(null);
    return true;
  };

  const onTableauClick = (column: number, index: number) => {
    if (selection && attempt({ pile: "tableau", column })) return;
    const card = state.tableau[column][index];
    if (!card?.faceUp) return;
    setSelection({ pile: "tableau", column, index });
    playSound("select");
  };

  const onEmptyColumnClick = (column: number) => {
    if (selection && attempt({ pile: "tableau", column })) return;
    setSelection(null);
  };

  const onFoundationClick = (suitIndex: number) => {
    const suit = SUITS[suitIndex];
    if (selection && attempt({ pile: "foundation", suit })) return;
    setSelection(null);
  };

  const onWasteClick = () => {
    const card = state.waste[state.waste.length - 1];
    if (!card) return;
    setSelection({ pile: "waste" });
    playSound("select");
  };

  const restart = () => {
    setState(createGame());
    setHistory([]);
    setSelection(null);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const undo = () => {
    if (history.length === 0) return;
    setState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSelection(null);
    playSound("refresh");
  };

  const isSelected = (source: Source) =>
    selection !== null && JSON.stringify(selection) === JSON.stringify(source);

  const topWaste = state.waste[state.waste.length - 1];

  return (
    <Layout>
      <section className="section-container max-w-4xl py-8">
        <GameHeader
          title={text.title}
          score={score(state)}
          extra={<Badge variant="outline">{text.moves} {state.moves}</Badge>}
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { const next = autoCollect(state); if (next !== state) commit(next, "points"); }} className="gap-1.5">
            <Sparkles className="h-4 w-4" aria-hidden="true" />{text.auto}
          </Button>
          <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0} className="gap-1.5">
            <Undo2 className="h-4 w-4" aria-hidden="true" />{text.undo}
          </Button>
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <UICard>
          <CardContent dir="ltr" className="overflow-x-auto p-3 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { commit(drawFromStock(state)); setSelection(null); }}
                  aria-label={`${text.stock}: ${state.stock.length}`}
                  className={`${CARD_BASE} flex items-center justify-center border-dashed bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  {state.stock.length > 0 ? state.stock.length : "↻"}
                </button>

                <button
                  type="button"
                  onClick={onWasteClick}
                  disabled={!topWaste}
                  aria-label={topWaste ? `${text.waste}: ${cardLabel(topWaste, ar)}` : `${text.waste}: ${text.empty}`}
                  className={`${CARD_BASE} bg-card ${isSelected({ pile: "waste" }) ? "ring-2 ring-primary" : ""} ${topWaste ? "" : "border-dashed opacity-50"} focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  {topWaste ? <CardFace card={topWaste} ar={ar} /> : null}
                </button>
              </div>

              <div className="flex gap-2">
                {SUITS.map((suit, suitIndex) => {
                  const pile = state.foundations[suit];
                  const top = pile[pile.length - 1];
                  return (
                    <button
                      key={suit}
                      type="button"
                      onClick={() => onFoundationClick(suitIndex)}
                      aria-label={`${text.foundation} ${SUIT_SYMBOL[suit]}: ${top ? cardLabel(top, ar) : text.empty}`}
                      className={`${CARD_BASE} border-dashed bg-card focus-visible:ring-2 focus-visible:ring-ring`}
                    >
                      {top ? <CardFace card={top} ar={ar} /> : (
                        <span className={`text-xl ${isRed(suit) ? "text-rose-400/50" : "text-muted-foreground/50"}`} aria-hidden="true">
                          {SUIT_SYMBOL[suit]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-w-fit justify-between gap-1.5 sm:gap-2">
              {state.tableau.map((pile, column) => (
                <div key={column} className="flex flex-col items-center">
                  {pile.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onEmptyColumnClick(column)}
                      aria-label={`${text.column} ${column + 1}: ${text.empty}`}
                      className={`${CARD_BASE} border-dashed bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring`}
                    />
                  ) : (
                    pile.map((card, index) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onTableauClick(column, index)}
                        disabled={!card.faceUp && index !== pile.length - 1}
                        aria-label={
                          card.faceUp
                            ? `${text.column} ${column + 1}: ${cardLabel(card, ar)}`
                            : `${text.column} ${column + 1}: ${text.faceDown}`
                        }
                        // Overlap all but the first card so long columns stay on screen.
                        className={[
                          CARD_BASE,
                          index > 0 ? "-mt-11 sm:-mt-14" : "",
                          card.faceUp ? "bg-card" : "bg-gradient-to-br from-indigo-600 to-violet-800",
                          isSelected({ pile: "tableau", column, index }) ? "ring-2 ring-primary" : "",
                          "focus-visible:ring-2 focus-visible:ring-ring",
                        ].join(" ")}
                      >
                        {card.faceUp ? <CardFace card={card} ar={ar} /> : null}
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </UICard>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
