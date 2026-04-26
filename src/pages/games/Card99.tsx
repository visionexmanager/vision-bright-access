import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-card99.jpg";

function cardValue(v: number) { return Math.min(v, 10); }

export default function Card99() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [total, setTotal] = useState(0);
  const [hand, setHand] = useState<number[]>(() => Array.from({ length: 3 }, () => Math.floor(Math.random() * 13) + 1));
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const play = useCallback((idx: number) => {
    const card = hand[idx];
    const val = cardValue(card);
    const newTotal = total + val;
    if (newTotal > 99) { setGameOver(true); playSound("navigate"); return; }
    setTotal(newTotal);
    setScore((s) => s + val);
    const newHand = [...hand];
    newHand[idx] = Math.floor(Math.random() * 13) + 1;
    setHand(newHand);
    playSound("success");
  }, [hand, total, playSound]);

  const restart = () => { setTotal(0); setScore(0); setGameOver(false); setHand(Array.from({ length: 3 }, () => Math.floor(Math.random() * 13) + 1)); playSound("start"); };

  const CARD_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🃏 {t("card99.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge variant={total > 85 ? "destructive" : "secondary"}>{t("card99.total")}: {total}/99</Badge>
              <Badge>⭐ {score}</Badge>
            </div>
          </div>
        </div>
        {gameOver ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">💥</p>
            <p className="text-2xl font-bold">{t("card99.busted")}</p>
            <p>{t("card99.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("card99.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center space-y-6">
              <p className="text-6xl font-bold text-primary">{total}</p>
              <div className="flex justify-center gap-4">
                {hand.map((card, i) => (
                  <Button key={i} variant="outline" className="h-24 w-16 text-xl flex-col font-bold" onClick={() => play(i)}>
                    <span>{CARD_NAMES[card]}</span>
                    <span className="text-xs text-muted-foreground">+{cardValue(card)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
