import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect } from "react";

const PUZZLES = [
  { q: "If all cats are animals, and some animals are pets, which is true?", choices: ["All cats are pets", "Some cats may be pets", "No cats are pets", "All pets are cats"], answer: 1 },
  { q: "What comes next: 2, 6, 18, 54, ?", choices: ["108", "162", "72", "216"], answer: 1 },
  { q: "Complete: 🔺🔵🔺🔵🔺?", choices: ["🔺", "🔵", "⬛", "🟢"], answer: 1 },
  { q: "A is taller than B, B is taller than C. Who is shortest?", choices: ["A", "B", "C", "Cannot tell"], answer: 2 },
  { q: "If MOUSE = 13+15+21+19+5 = 73, what is CAT?", choices: ["24", "22", "26", "28"], answer: 0 },
];

export default function LogiQuest() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (current >= PUZZLES.length || answered !== null) return;
    if (timeLeft <= 0) { setAnswered(-1); playSound("navigate"); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, current, answered, playSound]);

  const answer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    if (idx === PUZZLES[current].answer) { setScore((s) => s + 100 + timeLeft * 5); playSound("success"); }
    else playSound("navigate");
  };

  const next = () => { setCurrent((c) => c + 1); setAnswered(null); setTimeLeft(15); };
  const restart = () => { setCurrent(0); setScore(0); setAnswered(null); setTimeLeft(15); playSound("start"); };

  const puzzle = PUZZLES[current];
  const done = current >= PUZZLES.length;

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">🧩 {t("logiquest.title")}</h1>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>⭐ {score}</Badge>
            <Badge variant="secondary">{current + 1}/{PUZZLES.length}</Badge>
          </div>
        </div>
        {done ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🧠</p>
            <p className="text-2xl font-bold">{t("logiquest.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("logiquest.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <Progress value={(timeLeft / 15) * 100} />
              <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
              <p className="text-lg font-medium text-center">{puzzle.q}</p>
              <div className="grid gap-3">
                {puzzle.choices.map((c, i) => (
                  <Button key={i} size="lg" className="text-base h-auto py-3 whitespace-normal"
                    variant={answered === null ? "outline" : i === puzzle.answer ? "default" : answered === i ? "destructive" : "outline"}
                    disabled={answered !== null} onClick={() => answer(i)}>
                    {c}
                  </Button>
                ))}
              </div>
              {answered !== null && <Button className="w-full" onClick={next}>{t("logiquest.next")}</Button>}
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
