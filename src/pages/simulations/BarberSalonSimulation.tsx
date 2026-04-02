import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  duration: number; // seconds
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

  const [credits, setCredits] = useState(3);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<ServiceId[]>([]);
  const [active, setActive] = useState<ServiceId | null>(null);
  const [progress, setProgress] = useState(0);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

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
      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, active]);
        setScore((prev) => prev + svc.points);
        setActive(null);
        setProgress(0);
        toast.success(t("sim.barber.serviceDone"));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [active, t]);

  const startService = (svc: Service) => {
    if (active || completed.includes(svc.id)) return;
    if (svc.category === "pro" && !proUnlocked) {
      setShowUnlock(true);
      return;
    }
    if (credits <= 0 && !proUnlocked) {
      setShowUnlock(true);
      return;
    }
    if (!proUnlocked) setCredits((c) => c - 1);
    setActive(svc.id);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    setCredits(99);
    toast.success(t("sim.barber.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === SERVICES.length;
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
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
          <CardTitle>{t("sim.barber.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold">{score} {t("sim.barber.points")}</p>
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
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <span className="font-semibold">🎁 {t("sim.barber.credits")}: {proUnlocked ? "∞" : credits}</span>
          <Badge variant={proUnlocked ? "default" : "secondary"}>
            {proUnlocked ? t("sim.barber.proLabel") : t("sim.barber.freeLabel")}
          </Badge>
        </CardContent>
      </Card>

      {/* Active progress */}
      {active && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <p className="text-center font-semibold">{t("sim.barber.inProgress")}...</p>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {SERVICES.map((svc) => {
          const isDone = completed.includes(svc.id);
          const locked = svc.category === "pro" && !proUnlocked;
          return (
            <Card
              key={svc.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${isDone ? "border-green-500 bg-green-500/10" : ""} ${locked ? "opacity-60" : ""}`}
              onClick={() => startService(svc)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-yellow-500" />}
                <span className="text-3xl">{svc.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.barber.svc.${svc.id}`)}</p>
                {isDone && <Star className="mx-auto h-4 w-4 text-green-500" />}
                {locked && <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">PRO</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock modal */}
      {showUnlock && (
        <Card className="border-yellow-500">
          <CardContent className="py-6 text-center space-y-4">
            <Sparkles className="mx-auto h-8 w-8 text-yellow-500" />
            <h3 className="text-lg font-bold">{t("sim.barber.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.barber.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro}>{t("sim.barber.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.barber.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !active && (
        <div className="flex gap-3 justify-center">
          <Button size="lg" onClick={finish}>{t("sim.barber.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.barber.restart")}</Button>
        </div>
      )}

      {/* Score */}
      <p className="text-center text-muted-foreground">{t("sim.barber.score")}: {score}</p>
    </div>
  );
}
