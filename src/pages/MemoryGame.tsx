import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { usePoints } from "@/hooks/usePoints";
import { Trophy, RotateCcw, Play, Coins, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const EMOJIS = ["🍎", "🌟", "🎵", "🐱", "🌈", "🔔", "🎯", "💎"];
const LABELS = ["Apple", "Star", "Music", "Cat", "Rainbow", "Bell", "Target", "Diamond"];

interface MemCard {
  id: number;
  emoji: string;
  label: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(): MemCard[] {
  const pairs = EMOJIS.flatMap((emoji, i) => [
    { id: i * 2, emoji, label: LABELS[i], flipped: false, matched: false },
    { id: i * 2 + 1, emoji, label: LABELS[i], flipped: false, matched: false },
  ]);
  // Fisher-Yates shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

function getPointsReward(moves: number): number {
  if (moves <= 16) return 40;
  if (moves <= 24) return 25;
  if (moves <= 32) return 15;
  if (moves <= 48) return 5;
  return 0;
}

type GameState = "start" | "playing" | "end";

export default function MemoryGame() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { totalPoints } = usePoints();

  const [cards, setCards] = useState<MemCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [gameState, setGameState] = useState<GameState>("start");
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = msg;
    }
  }, []);

  const startGame = () => {
    setCards(buildDeck());
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
    setPointsAwarded(false);
    setGameState("playing");
  };

  // Check for match
  useEffect(() => {
    if (flippedIds.length !== 2) return;
    const [a, b] = flippedIds;
    const cardA = cards.find((c) => c.id === a)!;
    const cardB = cards.find((c) => c.id === b)!;

    if (cardA.emoji === cardB.emoji) {
      announce(`${t("games.memory.match")}: ${cardA.label}`);
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c))
        );
        setMatchedCount((p) => p + 1);
        setFlippedIds([]);
      }, 500);
    } else {
      announce(t("games.memory.noMatch"));
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c))
        );
        setFlippedIds([]);
      }, 1000);
    }
  }, [flippedIds, cards, announce, t]);

  // Check win
  useEffect(() => {
    if (gameState === "playing" && matchedCount === EMOJIS.length) {
      setGameState("end");
    }
  }, [matchedCount, gameState]);

  // Award points
  useEffect(() => {
    if (gameState === "end" && !pointsAwarded && user) {
      const reward = getPointsReward(moves);
      if (reward > 0) {
        earnPoints(reward, `Memory Game — ${moves} moves`).then((ok) => {
          if (ok) {
            toast.success(t("games.memory.pointsEarned").replace("{pts}", String(reward)));
          }
        });
      }
      setPointsAwarded(true);
    }
  }, [gameState, pointsAwarded, moves, user, earnPoints, t]);

  const handleFlip = (id: number) => {
    if (flippedIds.length >= 2) return;
    const card = cards.find((c) => c.id === id)!;
    if (card.flipped || card.matched) return;

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlippedIds((prev) => [...prev, id]);
    if (flippedIds.length === 0) {
      announce(`${t("games.memory.revealed")}: ${card.label}`);
    } else {
      setMoves((p) => p + 1);
      announce(`${t("games.memory.revealed")}: ${card.label}`);
    }
  };

  const reward = getPointsReward(moves);

  return (
    <Layout>
      {/* Screen reader live region */}
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />

      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full border-2 border-primary/30 p-6 sm:p-8 text-center">
          {gameState === "start" && (
            <div className="space-y-6">
              <Trophy className="mx-auto h-16 w-16 text-primary" aria-hidden="true" />
              <h1 className="text-3xl font-black sm:text-4xl">{t("games.memory.title")}</h1>
              <p className="text-lg text-muted-foreground">{t("games.memory.desc")}</p>

              {user && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4 text-primary" />
                  <span>{t("games.quiz.yourPoints").replace("{pts}", String(totalPoints))}</span>
                </div>
              )}

              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">{t("games.quiz.rewards")}</p>
                <p>🥇 ≤16 {t("games.memory.movesLabel")} → 40 {t("games.quiz.pts")}</p>
                <p>🥈 ≤24 {t("games.memory.movesLabel")} → 25 {t("games.quiz.pts")}</p>
                <p>🥉 ≤32 {t("games.memory.movesLabel")} → 15 {t("games.quiz.pts")}</p>
                <p>⭐ ≤48 {t("games.memory.movesLabel")} → 5 {t("games.quiz.pts")}</p>
              </div>

              {!user && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline">{t("nav.login")}</Link>
                  {" "}{t("games.quiz.loginToEarn")}
                </p>
              )}

              <Button size="lg" className="text-lg font-bold" onClick={startGame}>
                <Play className="me-2 h-5 w-5" /> {t("games.quiz.start")}
              </Button>
            </div>
          )}

          {gameState === "playing" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("games.memory.movesLabel")}
                  </p>
                  <p className="text-2xl font-bold text-primary">{moves}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("games.memory.matched")}
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {matchedCount}/{EMOJIS.length}
                  </p>
                </div>
              </div>

              <div
                className="grid grid-cols-4 gap-3"
                role="grid"
                aria-label={t("games.memory.title")}
              >
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleFlip(card.id)}
                    disabled={card.matched || card.flipped || flippedIds.length >= 2}
                    className={`
                      aspect-square rounded-xl border-2 text-3xl sm:text-4xl font-bold
                      transition-all duration-200
                      focus:outline-none focus:ring-4 focus:ring-primary
                      ${card.matched
                        ? "border-primary bg-primary/20 opacity-60 cursor-default"
                        : card.flipped
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted hover:border-primary hover:bg-accent cursor-pointer"
                      }
                    `}
                    aria-label={
                      card.matched
                        ? `${card.label}, ${t("games.memory.matchedCard")}`
                        : card.flipped
                        ? card.label
                        : t("games.memory.hiddenCard")
                    }
                  >
                    <span aria-hidden="true">
                      {card.flipped || card.matched ? card.emoji : "?"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState === "end" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{t("games.memory.complete")}</h2>
              <div className="text-5xl font-black text-primary">
                {moves} {t("games.memory.movesLabel")}
              </div>

              {user && reward > 0 && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-3 text-primary font-semibold">
                  <Coins className="h-5 w-5" />
                  <span>+{reward} {t("games.quiz.pts")} {t("games.quiz.earned")}</span>
                </div>
              )}
              {!user && reward > 0 && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/signup" className="text-primary underline">{t("nav.signup")}</Link>
                  {" "}{t("games.quiz.signupToEarn").replace("{pts}", String(reward))}
                </p>
              )}

              <Button size="lg" onClick={startGame} className="text-lg font-bold">
                <RotateCcw className="me-2 h-5 w-5" /> {t("games.memory.playAgain")}
              </Button>
            </div>
          )}
        </Card>
      </section>
    </Layout>
  );
}
