import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";

const FIREWALL_NODES = ["🔒", "🛡️", "⚡", "🔑", "💾", "🌐", "📡", "🔓"];

export default function NeonBreach() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSeq, setPlayerSeq] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"showing" | "input" | "gameover">("showing");
  const [showIdx, setShowIdx] = useState(-1);

  const startLevel = useCallback((lvl: number) => {
    const seq = Array.from({ length: lvl + 2 }, () => Math.floor(Math.random() * FIREWALL_NODES.length));
    setSequence(seq);
    setPlayerSeq([]);
    setPhase("showing");
    setShowIdx(0);
  }, []);

  useEffect(() => { startLevel(1); }, [startLevel]);

  useEffect(() => {
    if (phase !== "showing" || showIdx < 0) return;
    if (showIdx >= sequence.length) { setPhase("input"); setShowIdx(-1); return; }
    const t = setTimeout(() => setShowIdx((i) => i + 1), 600);
    return () => clearTimeout(t);
  }, [phase, showIdx, sequence.length]);

  const tap = (idx: number) => {
    if (phase !== "input") return;
    const next = [...playerSeq, idx];
    setPlayerSeq(next);
    if (idx !== sequence[next.length - 1]) {
      setPhase("gameover");
      playSound("navigate");
      return;
    }
    playSound("success");
    if (next.length === sequence.length) {
      setScore((s) => s + level * 50);
      setLevel((l) => l + 1);
      setTimeout(() => startLevel(level + 1), 500);
    }
  };

  const restart = () => { setLevel(1); setScore(0); startLevel(1); playSound("start"); };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">💻 {t("neonbreach.title")}</h1>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>⭐ {score}</Badge>
            <Badge variant="secondary">{t("neonbreach.level")}: {level}</Badge>
          </div>
        </div>
        {phase === "gameover" ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">🔥</p>
            <p className="text-2xl font-bold">{t("neonbreach.breached")}</p>
            <p>{t("neonbreach.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("neonbreach.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <p className="text-center text-muted-foreground">
                {phase === "showing" ? t("neonbreach.memorize") : t("neonbreach.repeat")}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {FIREWALL_NODES.map((node, i) => (
                  <Button key={i} variant="outline"
                    className={`text-3xl h-16 transition-all ${phase === "showing" && showIdx >= 0 && sequence[showIdx] === i ? "bg-primary text-primary-foreground scale-110" : ""}`}
                    disabled={phase !== "input"} onClick={() => tap(i)}>
                    {node}
                  </Button>
                ))}
              </div>
              <Progress value={(playerSeq.length / sequence.length) * 100} />
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
