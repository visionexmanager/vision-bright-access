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
import { Package, Ship, Plane, FileText, Truck, Lock, RotateCcw, Trophy, ShieldCheck } from "lucide-react";

type TaskId = "pack" | "sea" | "truck" | "air" | "customs" | "insure";

const TASKS: { id: TaskId; icon: React.ReactNode; tKey: string; premium: boolean; points: number; steps: number }[] = [
  { id: "pack", icon: <Package className="h-7 w-7" />, tKey: "sim.logistics.task.pack", premium: false, points: 10, steps: 12 },
  { id: "sea", icon: <Ship className="h-7 w-7" />, tKey: "sim.logistics.task.sea", premium: false, points: 10, steps: 14 },
  { id: "truck", icon: <Truck className="h-7 w-7" />, tKey: "sim.logistics.task.truck", premium: false, points: 10, steps: 10 },
  { id: "air", icon: <Plane className="h-7 w-7" />, tKey: "sim.logistics.task.air", premium: true, points: 15, steps: 15 },
  { id: "customs", icon: <FileText className="h-7 w-7" />, tKey: "sim.logistics.task.customs", premium: true, points: 15, steps: 14 },
  { id: "insure", icon: <ShieldCheck className="h-7 w-7" />, tKey: "sim.logistics.task.insure", premium: true, points: 20, steps: 16 },
];

export function LogisticsSimulation({ simulationId }: { simulationId?: string }) {
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
  const [cargoWeight, setCargoWeight] = useState(12.5);
  const [deliveryEta, setDeliveryEta] = useState(14);
  const [insuranceCover, setInsuranceCover] = useState(false);
  const [shipAnimating, setShipAnimating] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    playSound("select");

    if (task.id === "sea") setShipAnimating(true);

    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setTaskProgress(Math.round((step / task.steps) * 100));

      if (task.id === "pack") setCargoWeight((w) => Math.round((w + 0.5) * 10) / 10);
      if (task.id === "sea") setDeliveryEta((e) => Math.max(1, e - 1));
      if (task.id === "truck") setDeliveryEta((e) => Math.max(1, e - 1));
      if (task.id === "air") setDeliveryEta((e) => Math.max(1, Math.round(e * 0.8)));
      if (task.id === "insure") setInsuranceCover(true);

      if (step >= task.steps) {
        clearInterval(intervalRef.current!);
        setShipAnimating(false);
        const newCompleted = [...completed, task.id] as TaskId[];
        const newScore = score + task.points;
        setCompleted(newCompleted);
        setScore(newScore);
        setActiveTask(null);
        setTaskProgress(0);
        playSound("ding");
        toast.success(t("sim.logistics.taskDone"));
        saveProgress(newCompleted, newScore, false, proUnlocked);
      }
    }, 350);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const unlockPro = () => {
    setProUnlocked(true);
    setShowProDialog(false);
    playSound("unlock");
    toast.success(t("sim.logistics.proUnlocked"));
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
      await earnPoints(finalScore, "Logistics Simulation completed");
    }
    toast.success(allDone ? t("sim.logistics.allTasks") : t("sim.logistics.partialTasks"));
  };

  const restart = () => {
    setCompleted([]);
    setScore(0);
    setFinished(false);
    setActiveTask(null);
    setTaskProgress(0);
    setProUnlocked(false);
    setCargoWeight(12.5);
    setDeliveryEta(14);
    setInsuranceCover(false);
    setShipAnimating(false);
  };

  if (finished) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 text-primary mx-auto animate-bounce" />
          <h2 className="text-2xl font-bold">{t("sim.logistics.complete")}</h2>
          <p className="text-lg text-muted-foreground">{score} {t("sim.logistics.points")}</p>
          <Button onClick={restart} variant="outline"><RotateCcw className="mr-2 h-4 w-4" />{t("sim.logistics.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Operations view */}
      <div className="relative w-full h-[280px] rounded-2xl overflow-hidden border-4 border-border shadow-xl">
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800"
          alt="Logistics port"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Animated ship */}
        {shipAnimating && (
          <div className="absolute bottom-6 text-4xl animate-[sail_5s_linear_infinite]" style={{ left: "-60px" }}>
            🚢
          </div>
        )}
        {activeTask && (
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-primary/30">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${taskProgress}%` }} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">📦 {t("sim.logistics.weight")}</p><p className="text-xl font-bold">{cargoWeight} T</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🕐 {t("sim.logistics.eta")}</p><p className="text-xl font-bold">{deliveryEta}d</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">🛡️ {t("sim.logistics.insurance")}</p><p className="text-xl font-bold">{insuranceCover ? "✅" : "❌"}</p></CardContent></Card>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-base px-3 py-1">{t("sim.logistics.score")}: {score}</Badge>
        <Badge variant="outline">{completed.length}/{TASKS.length} {t("sim.logistics.tasksDone")}</Badge>
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
        <Button onClick={finishSession} disabled={completed.length === 0} className="flex-1">{t("sim.logistics.finish")}</Button>
      </div>

      {/* Premium dialog */}
      <Dialog open={showProDialog} onOpenChange={setShowProDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.logistics.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.logistics.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button onClick={unlockPro} className="flex-1">{t("sim.logistics.unlockBtn")}</Button>
            <Button variant="outline" onClick={() => setShowProDialog(false)}>{t("sim.logistics.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes sail {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(100vw + 120px)); }
        }
      `}</style>
    </div>
  );
}
