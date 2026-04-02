import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { useGameAudio } from "@/hooks/useGameAudio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Droplets, Scissors, Syringe, TreePine, Lock, RotateCcw, Trophy, CloudSun } from "lucide-react";

type TaskId = "graze" | "water" | "feed" | "shear" | "vaccine" | "breed";

const TASKS: { id: TaskId; icon: React.ReactNode; tKey: string; premium: boolean; points: number; steps: number }[] = [
  { id: "graze", icon: <TreePine className="h-7 w-7" />, tKey: "sim.sheep.task.graze", premium: false, points: 10, steps: 12 },
  { id: "water", icon: <Droplets className="h-7 w-7" />, tKey: "sim.sheep.task.water", premium: false, points: 10, steps: 10 },
  { id: "feed", icon: <span className="text-2xl">🌾</span>, tKey: "sim.sheep.task.feed", premium: false, points: 10, steps: 10 },
  { id: "shear", icon: <Scissors className="h-7 w-7" />, tKey: "sim.sheep.task.shear", premium: true, points: 15, steps: 15 },
  { id: "vaccine", icon: <Syringe className="h-7 w-7" />, tKey: "sim.sheep.task.vaccine", premium: true, points: 15, steps: 14 },
  { id: "breed", icon: <span className="text-2xl">🧬</span>, tKey: "sim.sheep.task.breed", premium: true, points: 20, steps: 18 },
];

export function SheepFarmSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { playSound } = useGameAudio();

  const [completed, setCompleted] = useState<TaskId[]>([]);
  const [activeTask, setActiveTask] = useState<TaskId | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [finished, setFinished] = useState(false);

  // live stats
  const [sheepCount, setSheepCount] = useState(50);
  const [woolQuality, setWoolQuality] = useState(85);
  const [healthScore, setHealthScore] = useState(78);
  const [weather, setWeather] = useState<"sunny" | "cloudy" | "rainy">("sunny");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Weather cycle
  useEffect(() => {
    const w = setInterval(() => {
      setWeather((prev) => {
        const options: typeof prev[] = ["sunny", "cloudy", "rainy"];
        return options[Math.floor(Math.random() * options.length)];
      });
    }, 15000);
    return () => clearInterval(w);
  }, []);

  // Load saved progress
  useEffect(() => {
    if (!user || !simulationId) return;
    (async () => {
      const { data } = await supabase
        .from("simulation_progress")
        .select("*")
        .eq("simulation_id", simulationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data.decisions as any;
        if (d?.completed) setCompleted(d.completed);
        if (d?.proUnlocked) setProUnlocked(true);
        setScore(data.score ?? 0);
        setFinished(data.completed ?? false);
      }
    })();
  }, [user, simulationId]);

  const saveProgress = useCallback(
    async (c: TaskId[], s: number, done: boolean, pro: boolean) => {
      if (!user || !simulationId) return;
      const payload = {
        user_id: user.id,
        simulation_id: simulationId,
        current_step: c.length,
        decisions: { completed: c, proUnlocked: pro } as any,
        score: s,
        completed: done,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("simulation_id", simulationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert(payload);
      }
    },
    [user, simulationId]
  );

  const startTask = (task: (typeof TASKS)[number]) => {
    if (completed.includes(task.id)) return;
    if (task.premium && !proUnlocked) {
      setShowProDialog(true);
      return;
    }
    setActiveTask(task.id);
    setTaskProgress(0);
    playSound("select");

    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setTaskProgress(Math.round((step / task.steps) * 100));

      // Task-specific stat updates
      if (task.id === "graze") setHealthScore((h) => Math.min(100, h + 1));
      if (task.id === "water") setWoolQuality((w) => Math.min(100, w + 1));
      if (task.id === "feed") { setHealthScore((h) => Math.min(100, h + 1)); setWoolQuality((w) => Math.min(100, w + 1)); }
      if (task.id === "shear") setWoolQuality(95);
      if (task.id === "vaccine") setHealthScore(98);
      if (task.id === "breed") setSheepCount((c) => c + 1);

      if (step >= task.steps) {
        clearInterval(intervalRef.current!);
        const newCompleted = [...completed, task.id] as TaskId[];
        const newScore = score + task.points;
        setCompleted(newCompleted);
        setScore(newScore);
        setActiveTask(null);
        setTaskProgress(0);
        playSound("ding");
        toast.success(t("sim.sheep.taskDone"));
        saveProgress(newCompleted, newScore, false, proUnlocked);
      }
    }, 300);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const unlockPro = () => {
    setProUnlocked(true);
    setShowProDialog(false);
    playSound("unlock");
    toast.success(t("sim.sheep.proUnlocked"));
    saveProgress(completed, score, false, true);
  };

  const finishSession = async () => {
    setFinished(true);
    const allDone = completed.length === TASKS.length;
    const bonus = allDone ? 30 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    playSound("complete");
    await saveProgress(completed, finalScore, true, proUnlocked);
    if (user) {
      await earnPoints(finalScore, "Sheep Farm Simulation completed");
    }
    toast.success(allDone ? t("sim.sheep.allTasks") : t("sim.sheep.partialTasks"));
  };

  const restart = () => {
    setCompleted([]);
    setScore(0);
    setFinished(false);
    setActiveTask(null);
    setTaskProgress(0);
    setProUnlocked(false);
    setSheepCount(50);
    setWoolQuality(85);
    setHealthScore(78);
  };

  const weatherIcon = weather === "sunny" ? "☀️" : weather === "cloudy" ? "⛅" : "🌧️";
  const weatherLabel = t(`sim.sheep.weather.${weather}`);

  if (finished) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 text-primary mx-auto animate-bounce" />
          <h2 className="text-2xl font-bold">{t("sim.sheep.complete")}</h2>
          <p className="text-lg text-muted-foreground">{score} {t("sim.sheep.points")}</p>
          <Button onClick={restart} variant="outline"><RotateCcw className="mr-2 h-4 w-4" />{t("sim.sheep.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Pasture view */}
      <div className="relative w-full h-[280px] rounded-2xl overflow-hidden border-4 border-border shadow-xl">
        <img
          src="https://images.unsplash.com/photo-1484557985045-edf25e08da73?w=800"
          alt="Sheep pasture"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          <CloudSun className="h-4 w-4" /> {weatherIcon} {weatherLabel}
        </div>
        {activeTask && (
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-primary/30">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${taskProgress}%` }} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🐑 {t("sim.sheep.count")}</p><p className="text-xl font-bold">{sheepCount}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🧶 {t("sim.sheep.wool")}</p><p className="text-xl font-bold">{woolQuality}%</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🏥 {t("sim.sheep.health")}</p><p className="text-xl font-bold">{healthScore}%</p></CardContent></Card>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-base px-3 py-1">{t("sim.sheep.score")}: {score}</Badge>
        <Badge variant="outline">{completed.length}/{TASKS.length} {t("sim.sheep.tasksDone")}</Badge>
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-2 gap-4">
        {TASKS.map((task) => {
          const done = completed.includes(task.id);
          const locked = task.premium && !proUnlocked;
          const active = activeTask === task.id;
          return (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${done ? "opacity-60 border-primary" : ""} ${locked ? "opacity-50 grayscale" : ""} ${active ? "ring-2 ring-primary animate-pulse" : ""}`}
              onClick={() => !done && !active && startTask(task)}
            >
              <CardContent className="p-4 text-center space-y-2 relative">
                {locked && (
                  <div className="absolute top-2 right-2"><Lock className="h-4 w-4 text-yellow-500" /></div>
                )}
                <div className="flex justify-center">{task.icon}</div>
                <p className="font-semibold text-sm">{t(task.tKey)}</p>
                {done && <Badge variant="default" className="text-xs">✓</Badge>}
                {active && <Progress value={taskProgress} className="h-1.5 mt-1" />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Finish / Premium */}
      <div className="flex gap-3">
        <Button onClick={finishSession} disabled={completed.length === 0} className="flex-1">{t("sim.sheep.finish")}</Button>
      </div>

      {/* Premium dialog */}
      <Dialog open={showProDialog} onOpenChange={setShowProDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.sheep.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.sheep.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button onClick={unlockPro} className="flex-1">{t("sim.sheep.unlockBtn")}</Button>
            <Button variant="outline" onClick={() => setShowProDialog(false)}>{t("sim.sheep.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
