import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Lock, RotateCcw, Trophy, Star, Thermometer, Heart, Calendar } from "lucide-react";

interface Props {
  simulationId?: string;
}

type TaskId = "heat" | "feed" | "water" | "vaccine" | "growth" | "market";

interface FarmTask {
  id: TaskId;
  emoji: string;
  category: "free" | "premium";
  points: number;
  duration: number; // ms
}

const TASKS: FarmTask[] = [
  { id: "heat", emoji: "🔥", category: "free", points: 10, duration: 3000 },
  { id: "feed", emoji: "🌾", category: "free", points: 10, duration: 3000 },
  { id: "water", emoji: "💧", category: "free", points: 10, duration: 2500 },
  { id: "vaccine", emoji: "💉", category: "premium", points: 25, duration: 4000 },
  { id: "growth", emoji: "📈", category: "premium", points: 25, duration: 4500 },
  { id: "market", emoji: "🏪", category: "premium", points: 20, duration: 4000 },
];

export function PoultryFarmSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<TaskId[]>([]);
  const [activeTask, setActiveTask] = useState<TaskId | null>(null);
  const [progress, setProgress] = useState(0);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [justCompleted, setJustCompleted] = useState<TaskId | null>(null);

  // Stats
  const [temp, setTemp] = useState(25);
  const [age, setAge] = useState(1);
  const [health, setHealth] = useState(100);

  // Progress timer
  useEffect(() => {
    if (!activeTask) return;
    const task = TASKS.find((t) => t.id === activeTask)!;
    const steps = 20;
    const interval = task.duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, (step / steps) * 100));
      if (step % 5 === 0) playSound("tick");

      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, activeTask]);
        setScore((prev) => prev + task.points);
        setJustCompleted(activeTask);

        // Update stats based on task
        if (activeTask === "heat") setTemp(34);
        if (activeTask === "feed") setAge((a) => Math.min(a + 7, 42));
        if (activeTask === "water") setHealth((h) => Math.min(h, 100));
        if (activeTask === "vaccine") setHealth(100);
        if (activeTask === "growth") setAge((a) => Math.min(a + 14, 42));
        if (activeTask === "market") setAge(42);

        setActiveTask(null);
        setProgress(0);
        playSound("ding");
        toast.success(t("sim.poultry.taskDone"));
        setTimeout(() => setJustCompleted(null), 600);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [activeTask, t, playSound]);

  const startTask = useCallback((task: FarmTask) => {
    if (activeTask || completed.includes(task.id)) return;
    if (task.category === "premium" && !proUnlocked) {
      playSound("wrong");
      setShowUnlock(true);
      return;
    }
    playSound("sizzle");
    setActiveTask(task.id);
    setProgress(0);
  }, [activeTask, completed, proUnlocked, playSound]);

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    playSound("unlock");
    toast.success(t("sim.poultry.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === TASKS.length;
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
    setActiveTask(null);
    setProgress(0);
    setShowUnlock(false);
    setDone(false);
    setScore(0);
    setTemp(25);
    setAge(1);
    setHealth(100);
  };

  if (done) {
    const allDone = completed.length === TASKS.length;
    return (
      <Card className="max-w-lg mx-auto animate-fade-in-scale">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary animate-pop" />
          <CardTitle className="animate-score-pop">{t("sim.poultry.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold animate-score-pop">{score} {t("sim.poultry.points")}</p>
          <p className="text-muted-foreground">
            {allDone ? t("sim.poultry.allTasks") : t("sim.poultry.partialTasks")}
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.poultry.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  const activeT = activeTask ? TASKS.find((t) => t.id === activeTask) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Brooder Environment */}
      <Card className="overflow-hidden animate-fade-in-up">
        <div className="relative h-52 bg-gradient-to-b from-amber-900/30 to-muted/50 flex items-center justify-center">
          {/* Heat effect overlay */}
          {(temp >= 33 || activeTask === "heat") && (
            <div className="absolute inset-0 bg-gradient-radial from-destructive/20 to-transparent animate-glow-pulse pointer-events-none" />
          )}

          {activeTask && activeT ? (
            <div className="text-center space-y-3 animate-fade-in-scale">
              <span className="text-5xl animate-bounce inline-block">{activeT.emoji}</span>
              <p className="font-semibold">{t(`sim.poultry.task.${activeT.id}`)}</p>
              <Progress value={progress} className="w-48 mx-auto h-3" />
              <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <span className="text-5xl">🐣</span>
              <p className="text-muted-foreground">{t("sim.poultry.selectTask")}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Vital Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="py-4 text-center space-y-1">
            <Thermometer className="mx-auto h-5 w-5 text-destructive" />
            <p className="text-lg font-bold">{temp}°C</p>
            <p className="text-xs text-muted-foreground">{t("sim.poultry.temp")}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="py-4 text-center space-y-1">
            <Calendar className="mx-auto h-5 w-5 text-primary" />
            <p className="text-lg font-bold">{age} {t("sim.poultry.days")}</p>
            <p className="text-xs text-muted-foreground">{t("sim.poultry.age")}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <CardContent className="py-4 text-center space-y-1">
            <Heart className="mx-auto h-5 w-5 text-green-500" />
            <p className="text-lg font-bold">{health}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.poultry.health")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {TASKS.map((task, index) => {
          const isDone = completed.includes(task.id);
          const locked = task.category === "premium" && !proUnlocked;
          const isJustDone = justCompleted === task.id;
          return (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:shadow-lg ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""} ${isJustDone ? "animate-pop" : ""}`}
              style={{ animationDelay: `${index * 80}ms` }}
              onClick={() => startTask(task)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className={`text-3xl inline-block transition-transform ${isDone ? "animate-wiggle" : ""}`}>{task.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.poultry.task.${task.id}`)}</p>
                <Badge variant={task.category === "premium" ? "destructive" : "outline"} className="text-xs">
                  {task.category === "premium" ? "PREMIUM" : t("sim.poultry.free")}
                </Badge>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary animate-pop" />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock card */}
      {showUnlock && (
        <Card className="border-accent animate-slide-in-bottom">
          <CardContent className="py-6 text-center space-y-4">
            <span className="text-4xl animate-wiggle inline-block">🐔</span>
            <h3 className="text-lg font-bold">{t("sim.poultry.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.poultry.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro} className="animate-glow-pulse">{t("sim.poultry.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.poultry.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !activeTask && (
        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Button size="lg" onClick={finish} className="animate-glow-pulse">{t("sim.poultry.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.poultry.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.poultry.score")}: <span className="font-bold text-foreground">{score}</span></p>
    </div>
  );
}
