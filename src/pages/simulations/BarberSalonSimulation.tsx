import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Scissors, Sparkles, Lock, Star, RotateCcw, Trophy } from "lucide-react";

interface Props {
  simulationId?: string;
}

type ServiceId = "classic-cut" | "fade" | "beard-trim" | "platinum-color" | "crystal-treatment" | "keratin";

interface Service {
  id: ServiceId;
  emoji: string;
  icon: "scissors" | "sparkles";
  category: "free" | "pro";
  points: number;
  duration: number;
}

const SERVICES: Service[] = [
  { id: "classic-cut", emoji: "✂️", icon: "scissors", category: "free", points: 10, duration: 3 },
  { id: "fade", emoji: "💈", icon: "scissors", category: "free", points: 10, duration: 3 },
  { id: "beard-trim", emoji: "🧔", icon: "scissors", category: "free", points: 10, duration: 2 },
  { id: "platinum-color", emoji: "🎨", icon: "sparkles", category: "pro", points: 20, duration: 5 },
  { id: "crystal-treatment", emoji: "💎", icon: "sparkles", category: "pro", points: 20, duration: 5 },
  { id: "keratin", emoji: "🧴", icon: "sparkles", category: "pro", points: 25, duration: 4 },
];

export function BarberSalonSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [credits, setCredits] = useState(3);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<ServiceId[]>([]);
  const [active, setActive] = useState<ServiceId | null>(null);
  const [progress, setProgress] = useState(0);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [justCompleted, setJustCompleted] = useState<ServiceId | null>(null);

  // Timer for active service
  useEffect(() => {
    if (!active) return;
    const svc = SERVICES.find((s) => s.id === active)!;
    const interval = 100;
    const steps = (svc.duration * 1000) / interval;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, (step / steps) * 100));
      // Snip sound every 25%
      if (step % Math.floor(steps / 4) === 0 && step < steps) {
        playSound("snip");
      }
      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, active]);
        setScore((prev) => prev + svc.points);
        setJustCompleted(active);
        setActive(null);
        setProgress(0);
        playSound("ding");
        toast.success(t("sim.barber.serviceDone"));
        setTimeout(() => setJustCompleted(null), 600);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [active, t, playSound]);

  const startService = (svc: Service) => {
    if (active || completed.includes(svc.id)) return;
    if (svc.category === "pro" && !proUnlocked) {
      playSound("wrong");
      setShowUnlock(true);
      return;
    }
    if (credits <= 0 && !proUnlocked) {
      playSound("wrong");
      setShowUnlock(true);
      return;
    }
    if (!proUnlocked) setCredits((c) => c - 1);
    playSound(svc.icon === "scissors" ? "snip" : "spray");
    setActive(svc.id);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    setCredits(99);
    playSound("unlock");
    toast.success(t("sim.barber.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === SERVICES.length;
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
    setCredits(3);
    setProUnlocked(false);
    setCompleted([]);
    setActive(null);
    setProgress(0);
    setShowUnlock(false);
    setDone(false);
    setScore(0);
  };

  if (done) {
    const allDone = completed.length === SERVICES.length;
    return (
      <Card className="max-w-lg mx-auto animate-fade-in-scale">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary animate-pop" />
          <CardTitle className="animate-score-pop">{t("sim.barber.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold animate-score-pop">{score} {t("sim.barber.points")}</p>
          <p className="text-muted-foreground">
            {allDone ? t("sim.barber.allServices") : t("sim.barber.partialServices")}
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.barber.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Credits */}
      <Card className="animate-fade-in-up">
        <CardContent className="py-4 flex items-center justify-between">
          <span className="font-semibold">🎁 {t("sim.barber.credits")}: {proUnlocked ? "∞" : credits}</span>
          <Badge variant={proUnlocked ? "default" : "secondary"} className={proUnlocked ? "animate-glow-pulse" : ""}>
            {proUnlocked ? t("sim.barber.proLabel") : t("sim.barber.freeLabel")}
          </Badge>
        </CardContent>
      </Card>

      {/* Active progress */}
      {active && (
        <Card className="animate-fade-in-scale">
          <CardContent className="py-4 space-y-2">
            <p className="text-center font-semibold">{t("sim.barber.inProgress")}...</p>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-center">
              <Scissors className="h-5 w-5 text-primary animate-wiggle" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {SERVICES.map((svc, index) => {
          const isDone = completed.includes(svc.id);
          const locked = svc.category === "pro" && !proUnlocked;
          const isJustDone = justCompleted === svc.id;
          return (
            <Card
              key={svc.id}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:shadow-lg ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""} ${isJustDone ? "animate-pop" : "animate-fade-in-up"}`}
              style={{ animationDelay: `${index * 80}ms` }}
              onClick={() => startService(svc)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className={`text-3xl inline-block ${isDone ? "animate-wiggle" : ""}`}>{svc.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.barber.svc.${svc.id}`)}</p>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary animate-pop" />}
                {locked && <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">PRO</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock modal */}
      {showUnlock && (
        <Card className="border-accent animate-slide-in-bottom">
          <CardContent className="py-6 text-center space-y-4">
            <Sparkles className="mx-auto h-8 w-8 text-primary animate-wiggle" />
            <h3 className="text-lg font-bold">{t("sim.barber.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.barber.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro} className="animate-glow-pulse">{t("sim.barber.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.barber.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !active && (
        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Button size="lg" onClick={finish} className="animate-glow-pulse">{t("sim.barber.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.barber.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.barber.score")}: <span className="font-bold text-foreground">{score}</span></p>
    </div>
  );
}
