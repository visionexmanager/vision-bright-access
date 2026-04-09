import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const WORDS = ["VISIONEX","PLATFORM","KEYBOARD","SCIENCE","MONITOR","BROWSER","NETWORK","DIGITAL","PRIVACY","STORAGE"];

export default function Hangman() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [word, setWord] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(0);
  const maxWrong = 6;

  const guess = useCallback((letter: string) => {
    if (guessed.has(letter)) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);
    if (!word.includes(letter)) {
      setWrong((w) => w + 1);
      playSound("navigate");
    } else {
      playSound("success");
    }
  }, [guessed, word, playSound]);

  const display = word.split("").map((l) => (guessed.has(l) ? l : "_")).join(" ");
  const won = word.split("").every((l) => guessed.has(l));
  const lost = wrong >= maxWrong;
  const gameOver = won || lost;

  if (won && !lost) toast.success(t("hangman.won"), { id: "hw" });
  if (lost) toast.error(t("hangman.lost"), { id: "hl" });

  const restart = () => { setWord(WORDS[Math.floor(Math.random() * WORDS.length)]); setGuessed(new Set()); setWrong(0); playSound("start"); };

  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{t("hangman.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("hangman.subtitle")}</p>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="text-6xl font-mono tracking-[0.3em]">{display}</div>
            <Badge variant={wrong > 4 ? "destructive" : "secondary"} className="mx-auto mt-3">
              {t("hangman.attempts")}: {wrong}/{maxWrong}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {ALPHA.map((l) => (
                <Button key={l} size="sm" variant={guessed.has(l) ? (word.includes(l) ? "default" : "destructive") : "outline"} disabled={guessed.has(l) || gameOver} onClick={() => guess(l)} className="w-10 h-10 text-lg font-bold">
                  {l}
                </Button>
              ))}
            </div>
            {gameOver && (
              <div className="text-center space-y-3">
                {lost && <p className="text-lg">{t("hangman.answer")}: <strong>{word}</strong></p>}
                <Button size="lg" onClick={restart}>{t("hangman.restart")}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
