import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-earmaster.jpg";

const NOTES_FREQ: Record<string, number> = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88 };
const NOTE_NAMES = Object.keys(NOTES_FREQ);

function playTone(freq: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch {}
}

export default function MusicEarMaster() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [target, setTarget] = useState(() => NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const playTarget = useCallback(() => {
    playTone(NOTES_FREQ[target]);
  }, [target]);

  const guess = (note: string) => {
    if (note === target) {
      setScore((s) => s + 100);
      playSound("success");
      setFeedback("✅");
    } else {
      setFeedback(`❌ ${target}`);
      playSound("navigate");
    }
    setTimeout(() => {
      setTarget(NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)]);
      setRound((r) => r + 1);
      setFeedback(null);
    }, 1500);
  };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🎵 {t("earmaster.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>⭐ {score}</Badge>
              <Badge variant="secondary">{t("earmaster.round")}: {round}</Badge>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-6">
            <Button size="lg" className="text-xl px-8 py-6" onClick={playTarget}>
              🔊 {t("earmaster.playNote")}
            </Button>
            {feedback && <p className="text-2xl font-bold">{feedback}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {NOTE_NAMES.map((note) => (
                <Button key={note} variant="outline" className="text-lg w-16 h-16 font-bold" onClick={() => guess(note)} disabled={!!feedback}>
                  {note}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
