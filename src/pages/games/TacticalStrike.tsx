import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";

const TARGETS = ["🎯", "💣", "⭐", "🎯", "💣", "⭐", "🎯", "💣"];

export default function TacticalStrike() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [active, setActive] = useState(false);

  const shuffle = useCallback(() => {
    const g = Array(16).fill("").map(() => TARGETS[Math.floor(Math.random() * TARGETS.length)]);
    setGrid(g);
  }, []);

  const start = () => { setScore(0); setTimeLeft(20); setActive(true); shuffle(); playSound("start"); };

  useEffect(() => {
    if (!active || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [active, timeLeft]);

  useEffect(() => { if (timeLeft <= 0 && active) setActive(false); }, [timeLeft, active]);

  useEffect(() => { if (active) { const i = setInterval(shuffle, 2000); return () => clearInterval(i); } }, [active, shuffle]);

  const hit = (idx: number) => {
    if (!active) return;
    const t = grid[idx];
    if (t === "🎯") { setScore((s) => s + 10); playSound("success"); }
    else if (t === "⭐") { setScore((s) => s + 25); playSound("success"); }
    else { setScore((s) => s - 15); playSound("navigate"); }
    setGrid((g) => g.map((v, i) => (i === idx ? "💥" : v)));
  };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">🎯 {t("tactical.title")}</h1>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>⭐ {score}</Badge>
            <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
          </div>
        </div>
        {!active && timeLeft === 20 ? (
          <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={start}>{t("tactical.start")}</Button></CardContent></Card>
        ) : !active ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🏆</p>
            <p className="text-2xl font-bold">{t("tactical.finalScore")}: {score}</p>
            <Button size="lg" onClick={start}>{t("tactical.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-2">
                {grid.map((cell, i) => (
                  <Button key={i} variant="outline" className="h-16 text-3xl" onClick={() => hit(i)}>{cell}</Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
