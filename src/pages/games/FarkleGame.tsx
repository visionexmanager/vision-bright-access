import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";

function rollDice(n: number) { return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1); }

function scoreDice(dice: number[]): number {
  let s = 0;
  const counts = Array(7).fill(0);
  dice.forEach((d) => counts[d]++);
  if (counts[1]) s += counts[1] * 100;
  if (counts[5]) s += counts[5] * 50;
  if (counts.some((c) => c >= 3)) {
    counts.forEach((c, i) => { if (c >= 3 && i !== 1 && i !== 5) s += i * 100; });
  }
  return s;
}

export default function FarkleGame() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [dice, setDice] = useState<number[]>([]);
  const [kept, setKept] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [rolling, setRolling] = useState(false);

  const roll = useCallback(() => {
    setRolling(true);
    playSound("start");
    setTimeout(() => {
      const n = 6 - kept.length;
      const newDice = rollDice(n);
      setDice(newDice);
      const s = scoreDice(newDice);
      if (s === 0) {
        playSound("navigate");
        setRoundScore(0);
        setDice([]);
        setKept([]);
      }
      setRolling(false);
    }, 500);
  }, [kept, playSound]);

  const keepDie = (idx: number) => {
    const die = dice[idx];
    if (die !== 1 && die !== 5) return;
    setKept([...kept, die]);
    setDice(dice.filter((_, i) => i !== idx));
    setRoundScore((s) => s + (die === 1 ? 100 : 50));
    playSound("success");
  };

  const bank = () => {
    setScore((s) => s + roundScore);
    setRoundScore(0);
    setDice([]);
    setKept([]);
    playSound("success");
  };

  const DICE_EMOJI = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">{t("farkle.title")}</h1>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>{t("farkle.total")}: {score}</Badge>
            <Badge variant="secondary">{t("farkle.round")}: {roundScore}</Badge>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-6">
            <div className="flex justify-center gap-3 min-h-[80px]">
              {dice.map((d, i) => (
                <button key={i} onClick={() => keepDie(i)} className={`text-5xl transition-transform hover:scale-110 ${d === 1 || d === 5 ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`} aria-label={`Die ${d}`}>
                  {DICE_EMOJI[d]}
                </button>
              ))}
              {rolling && <span className="text-5xl animate-spin">🎲</span>}
            </div>
            {kept.length > 0 && (
              <div className="flex justify-center gap-2">
                <span className="text-sm text-muted-foreground">{t("farkle.kept")}:</span>
                {kept.map((d, i) => <span key={i} className="text-3xl">{DICE_EMOJI[d]}</span>)}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={roll} disabled={rolling}>{t("farkle.roll")}</Button>
              <Button size="lg" variant="secondary" onClick={bank} disabled={roundScore === 0}>{t("farkle.bank")}</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
