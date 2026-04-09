import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-jungle.jpg";

const SCENARIOS = [
  { text: "jungle.scene1", choices: [{ key: "jungle.s1c1", hp: -10, score: 20 }, { key: "jungle.s1c2", hp: 5, score: 10 }] },
  { text: "jungle.scene2", choices: [{ key: "jungle.s2c1", hp: -20, score: 30 }, { key: "jungle.s2c2", hp: -5, score: 15 }] },
  { text: "jungle.scene3", choices: [{ key: "jungle.s3c1", hp: 10, score: 25 }, { key: "jungle.s3c2", hp: -15, score: 35 }] },
  { text: "jungle.scene4", choices: [{ key: "jungle.s4c1", hp: -25, score: 40 }, { key: "jungle.s4c2", hp: 0, score: 20 }] },
  { text: "jungle.scene5", choices: [{ key: "jungle.s5c1", hp: -10, score: 50 }, { key: "jungle.s5c2", hp: 5, score: 30 }] },
];

export default function JungleSurvival() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [step, setStep] = useState(0);
  const [hp, setHp] = useState(100);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const choose = useCallback((choice: { hp: number; score: number }) => {
    const newHp = Math.min(100, hp + choice.hp);
    setHp(newHp);
    setScore((s) => s + choice.score);
    if (newHp <= 0) { setGameOver(true); playSound("navigate"); return; }
    if (step + 1 >= SCENARIOS.length) { setGameOver(true); playSound("success"); return; }
    setStep((s) => s + 1);
    playSound(choice.hp >= 0 ? "success" : "navigate");
  }, [hp, step, playSound]);

  const restart = () => { setStep(0); setHp(100); setScore(0); setGameOver(false); playSound("start"); };

  const scene = SCENARIOS[step];

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🌴 {t("jungle.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge variant={hp < 30 ? "destructive" : "secondary"}>❤️ {hp}/100</Badge>
              <Badge>⭐ {score}</Badge>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {!gameOver ? (
              <>
                <p className="text-lg text-center leading-relaxed">{t(scene.text)}</p>
                <div className="grid gap-3">
                  {scene.choices.map((c, i) => (
                    <Button key={i} size="lg" variant={i === 0 ? "default" : "outline"} className="text-base h-auto py-4 whitespace-normal" onClick={() => choose(c)}>
                      {t(c.key)}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-5xl">{hp > 0 ? "🏆" : "💀"}</p>
                <p className="text-2xl font-bold">{hp > 0 ? t("jungle.survived") : t("jungle.died")}</p>
                <p className="text-lg">{t("jungle.finalScore")}: {score}</p>
                <Button size="lg" onClick={restart}>{t("jungle.restart")}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
