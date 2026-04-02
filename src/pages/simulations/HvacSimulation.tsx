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
import { Snowflake, Flame, Building2, Stethoscope, Wind, Lock, RotateCcw, Trophy, Thermometer } from "lucide-react";

type TaskId = "cool" | "heat" | "vent" | "vrf" | "hospital" | "duct";

const TASKS: { id: TaskId; icon: React.ReactNode; tKey: string; premium: boolean; points: number; steps: number }[] = [
  { id: "cool", icon: <Snowflake className="h-7 w-7" />, tKey: "sim.hvac.task.cool", premium: false, points: 10, steps: 12 },
  { id: "heat", icon: <Flame className="h-7 w-7" />, tKey: "sim.hvac.task.heat", premium: false, points: 10, steps: 12 },
  { id: "vent", icon: <Wind className="h-7 w-7" />, tKey: "sim.hvac.task.vent", premium: false, points: 10, steps: 10 },
  { id: "vrf", icon: <Building2 className="h-7 w-7" />, tKey: "sim.hvac.task.vrf", premium: true, points: 15, steps: 16 },
  { id: "hospital", icon: <Stethoscope className="h-7 w-7" />, tKey: "sim.hvac.task.hospital", premium: true, points: 15, steps: 14 },
  { id: "duct", icon: <span className="text-2xl">🔧</span>, tKey: "sim.hvac.task.duct", premium: true, points: 20, steps: 18 },
];

export function HvacSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [completed, setCompleted] = useState<TaskId[]>([]);
  const [activeTask, setActiveTask] = useState<TaskId | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [finished, setFinished] = useState(false);

  // live stats
  const [outdoorTemp, setOutdoorTemp] = useState(32);
  const [indoorTemp, setIndoorTemp] = useState(24);
  const [humidity, setHumidity] = useState(45);
  const [airflowActive, setAirflowActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Outdoor temp drift
  useEffect(() => {
    const drift = setInterval(() => {
      setOutdoorTemp((t) => t + (Math.random() > 0.5 ? 1 : -1));
    }, 12000);
    return () => clearInterval(drift);
  }, []);

  // Restore saved progress
  useEffect(() => {
    if (!savedProgress) return;
    const d = savedProgress.decisions as any;
    if (d?.completed) setCompleted(d.completed);
    if (d?.proUnlocked) setProUnlocked(true);
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

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
    setAirflowActive(true);
    playSound("select");

    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setTaskProgress(Math.round((step / task.steps) * 100));

      if (task.id === "cool") setIndoorTemp((t) => Math.max(18, t - 0.5));
      if (task.id === "heat") setIndoorTemp((t) => Math.min(28, t + 0.5));
      if (task.id === "vent") setHumidity((h) => Math.max(30, h - 1));
      if (task.id === "vrf") { setIndoorTemp(22); setHumidity(40); }
      if (task.id === "hospital") setHumidity((h) => Math.max(35, h - 1));
      if (task.id === "duct") setIndoorTemp((t) => Math.round((t + 22) / 2 * 10) / 10);

      if (step >= task.steps) {
        clearInterval(intervalRef.current!);
        setAirflowActive(false);
        const newCompleted = [...completed, task.id] as TaskId[];
        const newScore = score + task.points;
        setCompleted(newCompleted);
        setScore(newScore);
        setActiveTask(null);
        setTaskProgress(0);
        playSound("ding");
        toast.success(t("sim.hvac.taskDone"));
        saveProgress(newCompleted, newScore, false, proUnlocked);
      }
    }, 350);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const unlockPro = () => {
    setProUnlocked(true);
    setShowProDialog(false);
    playSound("unlock");
    toast.success(t("sim.hvac.proUnlocked"));
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
      await earnPoints(finalScore, "HVAC Simulation completed");
    }
    toast.success(allDone ? t("sim.hvac.allTasks") : t("sim.hvac.partialTasks"));
  };

  const restart = () => {
    setCompleted([]);
    setScore(0);
    setFinished(false);
    setActiveTask(null);
    setTaskProgress(0);
    setProUnlocked(false);
    setOutdoorTemp(32);
    setIndoorTemp(24);
    setHumidity(45);
    setAirflowActive(false);
  };

  const tempColor = indoorTemp <= 20 ? "text-blue-400" : indoorTemp >= 27 ? "text-red-400" : "text-green-400";

  if (finished) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 text-primary mx-auto animate-bounce" />
          <h2 className="text-2xl font-bold">{t("sim.hvac.complete")}</h2>
          <p className="text-lg text-muted-foreground">{score} {t("sim.hvac.points")}</p>
          <Button onClick={restart} variant="outline"><RotateCcw className="mr-2 h-4 w-4" />{t("sim.hvac.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Climate room view */}
      <div className="relative w-full h-[280px] rounded-2xl overflow-hidden border-4 border-border shadow-xl">
        <img
          src="https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?w=800"
          alt="HVAC Control Room"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Airflow animation */}
        {airflowActive && (
          <div className="absolute top-[20%] w-full h-[50px] bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-[flow_1.5s_linear_infinite]" />
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          <Thermometer className="h-4 w-4" /> {t("sim.hvac.outdoor")}: {outdoorTemp}°C
        </div>
        {activeTask && (
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-primary/30">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${taskProgress}%` }} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🌡️ {t("sim.hvac.indoor")}</p><p className={`text-xl font-bold ${tempColor}`}>{Math.round(indoorTemp)}°C</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">💧 {t("sim.hvac.humidity")}</p><p className="text-xl font-bold">{humidity}%</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🌬️ {t("sim.hvac.airflow")}</p><p className="text-xl font-bold">{airflowActive ? "🟢" : "⚪"}</p></CardContent></Card>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-base px-3 py-1">{t("sim.hvac.score")}: {score}</Badge>
        <Badge variant="outline">{completed.length}/{TASKS.length} {t("sim.hvac.tasksDone")}</Badge>
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

      {/* Finish */}
      <div className="flex gap-3">
        <Button onClick={finishSession} disabled={completed.length === 0} className="flex-1">{t("sim.hvac.finish")}</Button>
      </div>

      {/* Premium dialog */}
      <Dialog open={showProDialog} onOpenChange={setShowProDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.hvac.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.hvac.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button onClick={unlockPro} className="flex-1">{t("sim.hvac.unlockBtn")}</Button>
            <Button variant="outline" onClick={() => setShowProDialog(false)}>{t("sim.hvac.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
