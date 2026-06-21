import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useAuth } from "@/contexts/AuthContext";
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
import { WatchAdButton } from "@/components/WatchAdButton";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

// Card data with icons
const CARD_DATA = [
  { emoji: "🍎", labelKey: "memory.card.apple", Icon: Apple, color: "text-red-500" },
  { emoji: "⭐", labelKey: "memory.card.star", Icon: Star, color: "text-yellow-500" },
  { emoji: "🎵", labelKey: "memory.card.music", Icon: Music, color: "text-blue-500" },
  { emoji: "🐱", labelKey: "memory.card.cat", Icon: Cat, color: "text-orange-500" },
  { emoji: "🌈", labelKey: "memory.card.rainbow", Icon: Rainbow, color: "text-purple-500" },
  { emoji: "🔔", labelKey: "memory.card.bell", Icon: Bell, color: "text-amber-500" },
  { emoji: "🎯", labelKey: "memory.card.target", Icon: Target, color: "text-red-600" },
  { emoji: "💎", labelKey: "memory.card.diamond", Icon: Diamond, color: "text-cyan-500" },
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


type GameState = "start" | "playing" | "end";

export default function MemoryGame() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { playSound, setEnabled: setSoundEnabled, enabledRef: soundEnabledRef } = useGameAudio();
  const { speak, setEnabled: setTTSEnabled, stop: stopTTS, enabledRef: ttsEnabledRef } = useGameTTS();
  const { settleGameResult } = useGameEconomy();

  const [cards, setCards] = useState<MemCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [gameState, setGameState] = useState<GameState>("start");
  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTTSOn] = useState(true);
  const liveRef = useRef<HTMLDivElement>(null);

  const getCardLabel = useCallback((dataIndex: number) => {
    const data = CARD_DATA[dataIndex];
    return t(data.labelKey);
  }, [t]);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const startGame = () => {
    setCards(buildDeck());
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
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
      void settleGameResult("win", "Memory Game");
      playSound("complete");
      if (ttsOn) speak(t("games.memory.complete"), lang);
    }
  }, [matchedCount, gameState, playSound, speak, ttsOn, t, lang, settleGameResult]);


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

  return (
    <Layout>
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />
      <WatchAdButton variant="float" />

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
