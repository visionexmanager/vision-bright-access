import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<TreatmentId[]>([]);
  const [active, setActive] = useState<TreatmentId | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!active) return;
    const treat = TREATMENTS.find((t) => t.id === active)!;
    const interval = 100;
    const steps = (treat.duration * 1000) / interval;
    let step = 0;
    setScanning(true);
    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, (step / steps) * 100));
      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, active]);
        setScore((prev) => prev + treat.points);
        setActive(null);
        setProgress(0);
        setScanning(false);
        toast.success(t("sim.skin.treatmentDone"));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [active, t]);

  const startTreatment = (treat: Treatment) => {
    if (active || completed.includes(treat.id)) return;
    if (treat.category === "premium" && !proUnlocked) {
      setShowUnlock(true);
      return;
    }
    setActive(treat.id);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    toast.success(t("sim.skin.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === TREATMENTS.length;
    const finalScore = score + (allDone ? 30 : 0);
    setScore(finalScore);

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
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary" />
          <CardTitle>{t("sim.skin.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold">{score} {t("sim.skin.points")}</p>
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
      <Card className="overflow-hidden">
        <div className="relative h-52 bg-gradient-to-b from-muted to-background flex items-center justify-center">
          {scanning && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute w-full h-0.5 bg-primary shadow-lg shadow-primary/50 animate-pulse" style={{ top: `${progress}%`, transition: "top 0.1s linear" }} />
            </div>
          )}
          <div className="text-center space-y-2 z-10">
            {active ? (
              <>
                <span className="text-5xl animate-pulse">{TREATMENTS.find((t) => t.id === active)?.emoji}</span>
                <p className="font-semibold">{t(`sim.skin.treat.${active}`)}</p>
                <div className="w-48 mx-auto bg-muted rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-100 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </>
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
        {TREATMENTS.map((treat) => {
          const isDone = completed.includes(treat.id);
          const locked = treat.category === "premium" && !proUnlocked;
          return (
            <Card
              key={treat.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""}`}
              onClick={() => startTreatment(treat)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className="text-3xl">{treat.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.skin.treat.${treat.id}`)}</p>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary" />}
                {locked && <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">PREMIUM</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock card */}
      {showUnlock && (
        <Card className="border-accent">
          <CardContent className="py-6 text-center space-y-4">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h3 className="text-lg font-bold">{t("sim.skin.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.skin.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro}>{t("sim.skin.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.skin.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !active && (
        <div className="flex gap-3 justify-center">
          <Button size="lg" onClick={finish}>{t("sim.skin.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.skin.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.skin.score")}: {score}</p>
    </div>
  );
}
