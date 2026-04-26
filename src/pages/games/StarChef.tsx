import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-starchef.jpg";

const ORDERS = [
  { name: "🍔 Burger", items: ["🥩", "🧅", "🍅", "🥬", "🧀"] },
  { name: "🍕 Pizza", items: ["🫓", "🧀", "🍅", "🫒", "🌿"] },
  { name: "🌮 Taco", items: ["🫓", "🥩", "🧅", "🍅", "🌶️"] },
  { name: "🥗 Salad", items: ["🥬", "🍅", "🧅", "🫒", "🧀"] },
  { name: "🍣 Sushi", items: ["🍚", "🐟", "🥑", "🥒", "🫚"] },
];

export default function StarChef() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [order, setOrder] = useState(() => ORDERS[0]);
  const [plate, setPlate] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameActive, setGameActive] = useState(false);

  const start = () => { setScore(0); setTimeLeft(30); setPlate([]); setOrder(ORDERS[Math.floor(Math.random() * ORDERS.length)]); setGameActive(true); playSound("start"); };

  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [gameActive, timeLeft]);

  useEffect(() => { if (timeLeft <= 0 && gameActive) { setGameActive(false); playSound("navigate"); } }, [timeLeft, gameActive, playSound]);

  const addItem = useCallback((item: string) => {
    if (!gameActive) return;
    const next = [...plate, item];
    setPlate(next);
    if (next.length === order.items.length) {
      const correct = next.every((it, i) => it === order.items[i]);
      if (correct) {
        setScore((s) => s + 100);
        playSound("success");
        setPlate([]);
        setOrder(ORDERS[Math.floor(Math.random() * ORDERS.length)]);
      } else {
        playSound("navigate");
        setPlate([]);
      }
    }
  }, [gameActive, plate, order, playSound]);

  const ALL_INGREDIENTS = ["🥩", "🧅", "🍅", "🥬", "🧀", "🫓", "🫒", "🌿", "🌶️", "🍚", "🐟", "🥑", "🥒", "🫚"];

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">👨‍🍳 {t("starchef.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>⭐ {score}</Badge>
              <Badge variant={timeLeft < 10 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
            </div>
          </div>
        </div>
        {!gameActive && timeLeft === 30 ? (
          <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={start}>{t("starchef.start")}</Button></CardContent></Card>
        ) : !gameActive ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🏆</p>
            <p className="text-2xl font-bold">{t("starchef.finalScore")}: {score}</p>
            <Button size="lg" onClick={start}>{t("starchef.restart")}</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-lg font-bold mb-2">{t("starchef.order")}: {order.name}</p>
                <div className="flex justify-center gap-2 text-3xl">{order.items.map((it, i) => <span key={i}>{it}</span>)}</div>
                <Progress value={(timeLeft / 30) * 100} className="mt-4" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-center mb-3 text-sm text-muted-foreground">{t("starchef.yourPlate")}:</p>
                <div className="flex justify-center gap-2 text-3xl min-h-[48px]">
                  {plate.map((it, i) => <span key={i}>{it}</span>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap justify-center gap-2">
                  {ALL_INGREDIENTS.map((item) => (
                    <Button key={item} variant="outline" className="text-2xl h-14 w-14" onClick={() => addItem(item)}>{item}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </Layout>
  );
}
