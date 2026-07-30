import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import type { Game } from "@/features/visionkids/types/games.types";

const EMOJI_SET = ["🐶", "🐱", "🦁", "🐸", "🐵", "🦋", "🐢", "🐳", "🦄", "🐝", "🦉", "🐧"];

interface Card {
  key: string;
  emoji: string;
  matched: boolean;
}

function buildDeck(pairCount: number): Card[] {
  const chosen = EMOJI_SET.slice(0, pairCount);
  const deck: Card[] = [...chosen, ...chosen].map((emoji, i) => ({ key: `${emoji}-${i}`, emoji, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryCardsGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const pairCount = game.age_range === "3-5" ? 4 : game.age_range === "6-8" ? 6 : 8;

  const { state, start, pause, resume, restart, addScore, consumeHint, finish } = useGameSession({
    game,
    hasHints: true,
    startingHints: 3,
  });

  const [deck, setDeck] = useState<Card[]>(() => buildDeck(pairCount));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [revealHint, setRevealHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matchedCount = useMemo(() => deck.filter((c) => c.matched).length, [deck]);

  const handleStart = () => {
    setDeck(buildDeck(pairCount));
    setFlipped([]);
    start();
  };

  const flip = (key: string) => {
    if (busy || flipped.includes(key) || deck.find((c) => c.key === key)?.matched) return;
    const next = [...flipped, key];
    setFlipped(next);
    if (next.length === 2) {
      setBusy(true);
      const [a, b] = next.map((k) => deck.find((c) => c.key === k)!);
      if (a.emoji === b.emoji) {
        window.setTimeout(() => {
          setDeck((prev) => prev.map((c) => (c.key === a.key || c.key === b.key ? { ...c, matched: true } : c)));
          addScore(10);
          setFlipped([]);
          setBusy(false);
          if (matchedCount + 2 === deck.length) finish({ won: true, isPerfectScore: state.hints === 3 });
        }, 500);
      } else {
        window.setTimeout(() => { setFlipped([]); setBusy(false); }, 900);
      }
    }
  };

  const handleHint = () => {
    const unmatched = deck.filter((c) => !c.matched);
    if (unmatched.length === 0) return;
    if (!consumeHint()) return;
    const target = unmatched[Math.floor(Math.random() * unmatched.length)];
    setRevealHint(target.emoji);
    window.setTimeout(() => setRevealHint(null), 1200);
  };

  return (
    <GameShell
      game={game}
      state={state}
      hasHints
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      onHint={handleHint}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.pairsMatched")}: {pairCount}</p>}
    >
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card) => {
          const isFlipped = flipped.includes(card.key) || card.matched;
          const isHinted = revealHint === card.emoji && !card.matched;
          return (
            <motion.button
              key={card.key}
              type="button"
              onClick={() => flip(card.key)}
              disabled={card.matched || busy}
              aria-label={isFlipped || isHinted ? card.emoji : t("kids.games.hiddenCard")}
              whileTap={reduced ? {} : { scale: 0.95 }}
              className={`flex aspect-square items-center justify-center rounded-xl border-2 text-3xl transition-colors ${
                card.matched ? "border-kids-green bg-kids-green/10" : isFlipped || isHinted ? "border-kids-primary bg-kids-primary/10" : "border-border bg-muted hover:bg-muted/70"
              }`}
            >
              {isFlipped || isHinted ? card.emoji : ""}
            </motion.button>
          );
        })}
      </div>
    </GameShell>
  );
}

export default MemoryCardsGame;
