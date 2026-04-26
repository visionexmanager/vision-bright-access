import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState } from "react";
import heroImg from "@/assets/game-laptoptech.jpg";

const ISSUES = [
  { symptom: "Screen flickering", fix: "Replace LCD cable", wrong: "Change RAM", points: 100 },
  { symptom: "Not charging", fix: "Replace charging port", wrong: "Update BIOS", points: 120 },
  { symptom: "Overheating & shutting down", fix: "Clean fan & replace thermal paste", wrong: "Replace hard drive", points: 150 },
  { symptom: "Keyboard keys not working", fix: "Replace keyboard ribbon cable", wrong: "Reinstall OS", points: 80 },
  { symptom: "Blue screen on startup", fix: "Run memory diagnostics & replace faulty RAM", wrong: "Replace screen", points: 130 },
];

export default function LaptopTechMaster() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const issue = ISSUES[current];
  const done = current >= ISSUES.length;

  const answer = (correct: boolean) => {
    if (correct) { setScore((s) => s + issue.points); playSound("success"); setFeedback("✅ Correct!"); }
    else { playSound("navigate"); setFeedback(`❌ Wrong! Answer: ${issue.fix}`); }
    setTimeout(() => { setCurrent((c) => c + 1); setFeedback(null); }, 2000);
  };

  const restart = () => { setCurrent(0); setScore(0); setFeedback(null); playSound("start"); };

  const choices = issue ? [issue.fix, issue.wrong].sort(() => Math.random() - 0.5) : [];

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">💻 {t("laptoptech.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>⭐ {score}</Badge>
              <Badge variant="secondary">{current + 1}/{ISSUES.length}</Badge>
            </div>
          </div>
        </div>
        {done ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🔧</p>
            <p className="text-2xl font-bold">{t("laptoptech.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("laptoptech.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <p className="text-5xl mb-4">🖥️</p>
                <p className="text-lg font-bold">{t("laptoptech.symptom")}:</p>
                <p className="text-xl text-primary mt-2">{issue.symptom}</p>
              </div>
              {feedback ? (
                <p className="text-center text-lg font-bold">{feedback}</p>
              ) : (
                <div className="grid gap-3">
                  {choices.map((c) => (
                    <Button key={c} size="lg" variant="outline" className="h-auto py-4 text-base whitespace-normal" onClick={() => answer(c === issue.fix)}>
                      🔧 {c}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
