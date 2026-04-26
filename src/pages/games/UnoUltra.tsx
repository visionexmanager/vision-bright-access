import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-uno.jpg";

const COLORS = ["🔴", "🟡", "🟢", "🔵"];
const UNO_CARDS = COLORS.flatMap((c) => Array.from({ length: 5 }, (_, i) => ({ color: c, value: i + 1 })));

export default function UnoUltra() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [deck, setDeck] = useState(() => [...UNO_CARDS].sort(() => Math.random() - 0.5));
  const [hand, setHand] = useState<typeof UNO_CARDS>(() => deck.slice(0, 7));
  const [pile, setPile] = useState(() => deck[7]);
  const [score, setScore] = useState(0);

  const canPlay = (card: typeof pile) => card.color === pile.color || card.value === pile.value;

  const playCard = useCallback((idx: number) => {
    const card = hand[idx];
    if (!canPlay(card)) { playSound("navigate"); return; }
    setPile(card);
    const newHand = hand.filter((_, i) => i !== idx);
    setHand(newHand);
    setScore((s) => s + card.value * 10);
    playSound("success");
    if (newHand.length === 0) playSound("success");
  }, [hand, pile, playSound]);

  const draw = () => {
    const newCard = UNO_CARDS[Math.floor(Math.random() * UNO_CARDS.length)];
    setHand([...hand, newCard]);
    playSound("navigate");
  };

  const restart = () => {
    const d = [...UNO_CARDS].sort(() => Math.random() - 0.5);
    setDeck(d); setHand(d.slice(0, 7)); setPile(d[7]); setScore(0); playSound("start");
  };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🃏 {t("uno.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>⭐ {score}</Badge>
              <Badge variant="secondary">{t("uno.cards")}: {hand.length}</Badge>
            </div>
          </div>
        </div>
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">{t("uno.currentCard")}:</p>
            <div className="text-5xl font-bold">{pile.color} {pile.value}</div>
          </CardContent>
        </Card>
        {hand.length === 0 ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🏆</p>
            <p className="text-2xl font-bold">{t("uno.won")}</p>
            <Button size="lg" onClick={restart}>{t("uno.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap justify-center gap-2">
                {hand.map((card, i) => (
                  <Button key={i} variant={canPlay(card) ? "default" : "outline"} className="text-lg h-16 w-16 flex-col" onClick={() => playCard(i)}>
                    <span>{card.color}</span>
                    <span className="text-sm font-bold">{card.value}</span>
                  </Button>
                ))}
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={draw}>{t("uno.draw")}</Button>
                <Button variant="outline" onClick={restart}>{t("uno.restart")}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
