import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";

const SUITS = ["🟡", "🔴", "🟢", "🔵"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type BCard = { suit: string; value: number };

function createDeck(): BCard[] {
  return SUITS.flatMap((s) => VALUES.map((v) => ({ suit: s, value: v }))).sort(() => Math.random() - 0.5);
}

export default function Briscola() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [deck, setDeck] = useState(() => createDeck());
  const [hand, setHand] = useState<BCard[]>(() => deck.slice(0, 3));
  const [cpuHand] = useState<BCard[]>(() => deck.slice(3, 6));
  const [trump] = useState(() => deck[deck.length - 1]);
  const [played, setPlayed] = useState<BCard | null>(null);
  const [cpuPlayed, setCpuPlayed] = useState<BCard | null>(null);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);

  const play = useCallback((idx: number) => {
    const card = hand[idx];
    setPlayed(card);
    const cpu = cpuHand[Math.floor(Math.random() * cpuHand.length)];
    setCpuPlayed(cpu);

    const playerWins = card.value >= cpu.value || card.suit === trump.suit;
    if (playerWins) { setScore((s) => s + card.value + cpu.value); playSound("success"); }
    else playSound("navigate");

    setHand(hand.filter((_, i) => i !== idx));
    setRounds((r) => r + 1);

    setTimeout(() => { setPlayed(null); setCpuPlayed(null); }, 1500);
  }, [hand, cpuHand, trump, playSound]);

  const restart = () => {
    const d = createDeck();
    setDeck(d); setHand(d.slice(0, 3)); setScore(0); setRounds(0); playSound("start");
  };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">🃏 {t("briscola.title")}</h1>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>⭐ {score}</Badge>
            <Badge variant="secondary">{t("briscola.trump")}: {trump.suit} {trump.value}</Badge>
          </div>
        </div>
        {played && cpuPlayed && (
          <div className="flex justify-center gap-8 mb-6">
            <Card className="w-24 h-32 flex items-center justify-center text-2xl">{played.suit}{played.value}</Card>
            <span className="self-center text-2xl">⚔️</span>
            <Card className="w-24 h-32 flex items-center justify-center text-2xl">{cpuPlayed.suit}{cpuPlayed.value}</Card>
          </div>
        )}
        {hand.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center gap-3">
                {hand.map((card, i) => (
                  <Button key={i} variant="outline" className="h-24 w-20 text-xl flex-col" onClick={() => play(i)}>
                    <span className="text-2xl">{card.suit}</span>
                    <span className="font-bold">{card.value}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🏆</p>
            <p className="text-2xl font-bold">{t("briscola.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("briscola.restart")}</Button>
          </CardContent></Card>
        )}
      </section>
    </Layout>
  );
}
