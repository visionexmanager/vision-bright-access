import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScanLine, Lock, RotateCcw, Trophy, Star, Sparkles } from "lucide-react";

interface Props {
  simulationId?: string;
}

type TreatmentId = "scan" | "hydration" | "vitamin-c" | "carbon-laser" | "mesotherapy" | "chemical-peel";

interface Treatment {
  id: TreatmentId;
  emoji: string;
  category: "free" | "premium";
  points: number;
  duration: number;
}

const TREATMENTS: Treatment[] = [
  { id: "scan", emoji: "🔍", category: "free", points: 10, duration: 3 },
  { id: "hydration", emoji: "💧", category: "free", points: 10, duration: 3 },
  { id: "vitamin-c", emoji: "🍊", category: "free", points: 10, duration: 2 },
  { id: "carbon-laser", emoji: "⚡", category: "premium", points: 25, duration: 5 },
  { id: "mesotherapy", emoji: "💉", category: "premium", points: 25, duration: 5 },
  { id: "chemical-peel", emoji: "🧪", category: "premium", points: 20, duration: 4 },
];

export function SkinCareLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<TreatmentId[]>([]);
  const [active, setActive] = useState<TreatmentId | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [justCompleted, setJustCompleted] = useState<TreatmentId | null>(null);

  // Restore saved progress
  useEffect(() => {
    if (!savedProgress) return;
    const d = savedProgress.decisions as any;
    if (d?.completed) setCompleted(d.completed);
    if (d?.proUnlocked) setProUnlocked(true);
    setScore(savedProgress.score ?? 0);
    setDone(savedProgress.completed ?? false);
  }, [savedProgress]);

  useEffect(() => {
    if (!active) return;
    const treat = TREATMENTS.find((t) => t.id === active)!;
    const interval = 100;
    const steps = (treat.duration * 1000) / interval;
    let step = 0;
    setScanning(true);
    // Play scan sound at start
    playSound("scan");
    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, (step / steps) * 100));
      // Tick sound every 25%
      if (step % Math.floor(steps / 4) === 0 && step < steps) {
        playSound("tick");
      }
      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, active]);
        setScore((prev) => prev + treat.points);
        setJustCompleted(active);
        setActive(null);
        setProgress(0);
        setScanning(false);
        playSound("heal");
        toast.success(t("sim.skin.treatmentDone"));
        setTimeout(() => setJustCompleted(null), 600);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [active, t, playSound]);

  const startTreatment = (treat: Treatment) => {
    if (active || completed.includes(treat.id)) return;
    if (treat.category === "premium" && !proUnlocked) {
      playSound("wrong");
      setShowUnlock(true);
      return;
    }
    playSound("select");
    setActive(treat.id);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    playSound("unlock");
    toast.success(t("sim.skin.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === TREATMENTS.length;
    const finalScore = score + (allDone ? 30 : 0);
    setScore(finalScore);
    playSound(allDone ? "levelUp" : "complete");

    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: completed.length,
        decisions: JSON.parse(JSON.stringify({ completed, proUnlocked })),
        score: finalScore,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert({ user_id: user.id, simulation_id: simulationId, ...payload });
      }
    }
  };

  const restart = () => {
    playSound("whoosh");
    setProUnlocked(false);
    setCompleted([]);
    setActive(null);
    setProgress(0);
    setScanning(false);
    setShowUnlock(false);
    setDone(false);
    setScore(0);
  };

  if (done) {
    const allDone = completed.length === TREATMENTS.length;
    return (
      <Card className="max-w-lg mx-auto animate-fade-in-scale">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary animate-pop" />
          <CardTitle className="animate-score-pop">{t("sim.skin.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold animate-score-pop">{score} {t("sim.skin.points")}</p>
          <p className="text-muted-foreground">
            {allDone ? t("sim.skin.allTreatments") : t("sim.skin.partialTreatments")}
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.skin.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Scanner area */}
      <Card className="overflow-hidden animate-fade-in-up">
        <div className="relative h-52 bg-gradient-to-b from-muted to-background flex items-center justify-center">
          {scanning && (
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute w-full h-0.5 bg-primary shadow-lg shadow-primary/50"
                style={{ top: `${progress}%`, transition: "top 0.1s linear" }}
              />
              {/* Subtle scan glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 animate-pulse" />
            </div>
          )}
          <div className="text-center space-y-2 z-10">
            {active ? (
              <div className="animate-fade-in-scale">
                <span className="text-5xl animate-pulse inline-block">{TREATMENTS.find((t) => t.id === active)?.emoji}</span>
                <p className="font-semibold">{t(`sim.skin.treat.${active}`)}</p>
                <div className="w-48 mx-auto bg-muted rounded-full h-3 overflow-hidden mt-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-100"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
                      backgroundSize: "200% 100%",
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <ScanLine className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">{t("sim.skin.selectTreatment")}</p>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Treatments grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {TREATMENTS.map((treat, index) => {
          const isDone = completed.includes(treat.id);
          const locked = treat.category === "premium" && !proUnlocked;
          const isJustDone = justCompleted === treat.id;
          return (
            <Card
              key={treat.id}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:shadow-lg ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""} ${isJustDone ? "animate-pop" : "animate-fade-in-up"}`}
              style={{ animationDelay: `${index * 80}ms` }}
              onClick={() => startTreatment(treat)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className={`text-3xl inline-block ${isDone ? "animate-wiggle" : ""}`}>{treat.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.skin.treat.${treat.id}`)}</p>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary animate-pop" />}
                {locked && <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">PREMIUM</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock card */}
      {showUnlock && (
        <Card className="border-accent animate-slide-in-bottom">
          <CardContent className="py-6 text-center space-y-4">
            <Sparkles className="mx-auto h-8 w-8 text-primary animate-wiggle" />
            <h3 className="text-lg font-bold">{t("sim.skin.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.skin.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro} className="animate-glow-pulse">{t("sim.skin.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.skin.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !active && (
        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Button size="lg" onClick={finish} className="animate-glow-pulse">{t("sim.skin.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.skin.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.skin.score")}: <span className="font-bold text-foreground">{score}</span></p>
    </div>
  );
}
