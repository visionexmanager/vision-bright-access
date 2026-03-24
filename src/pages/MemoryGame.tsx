import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { usePoints } from "@/hooks/usePoints";
import { useGameAudio, useGameTTS } from "@/hooks/useGameAudio";
import {
  Trophy, RotateCcw, Play, Coins, Volume2, VolumeX,
  Mic, MicOff,
  Apple, Star, Music, Cat, Rainbow, Bell, Target, Diamond,
  Heart, Flower2, Sun, Moon, Zap, Fish, Bird, Flame
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// Card data with icons
const CARD_DATA = [
  { emoji: "🍎", label: "Apple", labelAr: "تفاحة", labelEs: "Manzana", Icon: Apple, color: "text-red-500" },
  { emoji: "⭐", label: "Star", labelAr: "نجمة", labelEs: "Estrella", Icon: Star, color: "text-yellow-500" },
  { emoji: "🎵", label: "Music", labelAr: "موسيقى", labelEs: "Música", Icon: Music, color: "text-blue-500" },
  { emoji: "🐱", label: "Cat", labelAr: "قطة", labelEs: "Gato", Icon: Cat, color: "text-orange-500" },
  { emoji: "🌈", label: "Rainbow", labelAr: "قوس قزح", labelEs: "Arcoíris", Icon: Rainbow, color: "text-purple-500" },
  { emoji: "🔔", label: "Bell", labelAr: "جرس", labelEs: "Campana", Icon: Bell, color: "text-amber-500" },
  { emoji: "🎯", label: "Target", labelAr: "هدف", labelEs: "Diana", Icon: Target, color: "text-red-600" },
  { emoji: "💎", label: "Diamond", labelAr: "ألماس", labelEs: "Diamante", Icon: Diamond, color: "text-cyan-500" },
];

interface MemCard {
  id: number;
  dataIndex: number;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(): MemCard[] {
  const pairs = CARD_DATA.flatMap((_, i) => [
    { id: i * 2, dataIndex: i, flipped: false, matched: false },
    { id: i * 2 + 1, dataIndex: i, flipped: false, matched: false },
  ]);
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
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { totalPoints } = usePoints();
  const { playSound, setEnabled: setSoundEnabled, enabledRef: soundEnabledRef } = useGameAudio();
  const { speak, setEnabled: setTTSEnabled, stop: stopTTS, enabledRef: ttsEnabledRef } = useGameTTS();

  const [cards, setCards] = useState<MemCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [gameState, setGameState] = useState<GameState>("start");
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTTSOn] = useState(true);
  const liveRef = useRef<HTMLDivElement>(null);

  const getCardLabel = useCallback((dataIndex: number) => {
    const data = CARD_DATA[dataIndex];
    return lang === "ar" ? data.labelAr : lang === "es" ? data.labelEs : data.label;
  }, [lang]);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const startGame = () => {
    setCards(buildDeck());
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
    setPointsAwarded(false);
    setGameState("playing");
    playSound("tick");
  };

  // Check for match
  useEffect(() => {
    if (flippedIds.length !== 2) return;
    const [a, b] = flippedIds;
    const cardA = cards.find((c) => c.id === a)!;
    const cardB = cards.find((c) => c.id === b)!;

    if (cardA.dataIndex === cardB.dataIndex) {
      const label = getCardLabel(cardA.dataIndex);
      const msg = `${t("games.memory.match")}: ${label}`;
      announce(msg);
      playSound("match");
      if (ttsOn) speak(msg, lang);
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c))
        );
        setMatchedCount((p) => p + 1);
        setFlippedIds([]);
      }, 600);
    } else {
      announce(t("games.memory.noMatch"));
      playSound("noMatch");
      if (ttsOn) speak(t("games.memory.noMatch"), lang);
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c))
        );
        setFlippedIds([]);
      }, 1000);
    }
  }, [flippedIds, cards, announce, t, playSound, speak, ttsOn, lang, getCardLabel]);

  // Check win
  useEffect(() => {
    if (gameState === "playing" && matchedCount === CARD_DATA.length) {
      setGameState("end");
      playSound("complete");
      if (ttsOn) speak(t("games.memory.complete"), lang);
    }
  }, [matchedCount, gameState, playSound, speak, ttsOn, t, lang]);

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

    playSound("flip");
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlippedIds((prev) => [...prev, id]);

    const label = getCardLabel(card.dataIndex);
    announce(`${t("games.memory.revealed")}: ${label}`);
    if (ttsOn) speak(label, lang);

    if (flippedIds.length === 1) {
      setMoves((p) => p + 1);
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const toggleTTS = () => {
    const next = !ttsOn;
    setTTSOn(next);
    setTTSEnabled(next);
    if (!next) stopTTS();
  };

  const reward = getPointsReward(moves);

  return (
    <Layout>
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />

      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full border-2 border-primary/30 p-6 sm:p-8 text-center">
          {/* Audio controls - always visible */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={toggleSound}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={soundOn ? t("games.memory.soundOff") : t("games.memory.soundOn")}
            >
              {soundOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="hidden sm:inline">{soundOn ? t("games.memory.soundOn") : t("games.memory.soundOff")}</span>
            </button>
            <button
              onClick={toggleTTS}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={ttsOn ? t("games.memory.ttsOff") : t("games.memory.ttsOn")}
            >
              {ttsOn ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
              <span className="hidden sm:inline">{ttsOn ? t("games.memory.ttsOn") : t("games.memory.ttsOff")}</span>
            </button>
          </div>

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
                    {matchedCount}/{CARD_DATA.length}
                  </p>
                </div>
              </div>

              <div
                className="grid grid-cols-4 gap-2 sm:gap-3"
                role="grid"
                aria-label={t("games.memory.title")}
              >
                {cards.map((card) => {
                  const data = CARD_DATA[card.dataIndex];
                  const Icon = data.Icon;
                  const isRevealed = card.flipped || card.matched;

                  return (
                    <button
                      key={card.id}
                      onClick={() => handleFlip(card.id)}
                      disabled={card.matched || card.flipped || flippedIds.length >= 2}
                      className={`
                        group relative aspect-square rounded-xl border-2 
                        transition-all duration-300 transform
                        focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                        min-h-[64px] min-w-[64px]
                        ${card.matched
                          ? "border-primary bg-primary/15 scale-95 opacity-70 cursor-default"
                          : card.flipped
                          ? "border-primary bg-primary/10 scale-105 shadow-lg"
                          : "border-border bg-muted hover:border-primary hover:bg-accent hover:scale-105 cursor-pointer active:scale-95"
                        }
                      `}
                      aria-label={
                        card.matched
                          ? `${getCardLabel(card.dataIndex)}, ${t("games.memory.matchedCard")}`
                          : card.flipped
                          ? getCardLabel(card.dataIndex)
                          : t("games.memory.hiddenCard")
                      }
                    >
                      <div className="flex flex-col items-center justify-center h-full gap-0.5 p-1">
                        {isRevealed ? (
                          <>
                            <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${data.color} transition-all duration-200`} strokeWidth={2.5} />
                            <span className="text-[10px] sm:text-xs font-bold text-foreground leading-tight">
                              {getCardLabel(card.dataIndex)}
                            </span>
                          </>
                        ) : (
                          <span className="text-2xl sm:text-3xl font-bold text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true">
                            ?
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
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
