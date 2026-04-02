import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Task {
  id: string;
  labelKey: string;
  icon: string;
  premium: boolean;
  done: boolean;
}

const INITIAL_TASKS: Task[] = [
  { id: "track", labelKey: "sim.solar.task.track", icon: "☀️", premium: false, done: false },
  { id: "clean", labelKey: "sim.solar.task.clean", icon: "🧼", premium: false, done: false },
  { id: "monitor", labelKey: "sim.solar.task.monitor", icon: "📊", premium: false, done: false },
  { id: "battery", labelKey: "sim.solar.task.battery", icon: "🔋", premium: true, done: false },
  { id: "load", labelKey: "sim.solar.task.load", icon: "🌐", premium: true, done: false },
  { id: "grid", labelKey: "sim.solar.task.grid", icon: "⚡", premium: true, done: false },
];

export function SolarEnergySimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS.map((t) => ({ ...t })));
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [score, setScore] = useState(0);
  const [powerOutput, setPowerOutput] = useState(4500);
  const [batteryCharge, setBatteryCharge] = useState(88);
  const [efficiency, setEfficiency] = useState(94);
  const [sunPulsing, setSunPulsing] = useState(false);

  const completed = tasks.filter((t) => t.done);
  const progress = Math.round((completed.length / tasks.length) * 100);

  const saveProgress = useCallback(
    async (done: boolean, completedTasks: Task[], sc: number, pro: boolean) => {
      if (!user || !simulationId) return;
      await supabase.from("simulation_progress").upsert(
        {
          user_id: user.id,
          simulation_id: simulationId,
          current_step: completedTasks.filter((t) => t.done).length,
          decisions: { completed: completedTasks.filter((t) => t.done).map((t) => t.id), proUnlocked: pro } as any,
          score: sc,
          completed: done,
        },
        { onConflict: "user_id,simulation_id" as any },
      );
    },
    [user, simulationId],
  );

  const handleTask = (task: Task) => {
    if (task.done || activeTask) return;
    if (task.premium && !proUnlocked) {
      setShowPro(true);
      return;
    }
    setActiveTask(task.id);
    playSound("scan");

    if (task.id === "track") setSunPulsing(true);

    const interval = setInterval(() => {
      if (task.id === "track") setPowerOutput((p) => Math.min(6000, p + 50));
      if (task.id === "clean") setEfficiency((e) => Math.min(99, e + 0.5));
      if (task.id === "battery") setBatteryCharge((b) => Math.min(100, b + 1));
      if (task.id === "load") setPowerOutput((p) => Math.min(7000, p + 80));
    }, 400);

    setTimeout(() => {
      clearInterval(interval);
      setSunPulsing(false);
      setActiveTask(null);
      const newScore = score + (task.premium ? 20 : 10);
      setScore(newScore);
      const updated = tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t));
      setTasks(updated);
      playSound("ding");
      toast.success(t("sim.solar.taskDone"));
      saveProgress(updated.every((t) => t.done), updated, newScore, proUnlocked);
    }, 2500);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowPro(false);
    playSound("unlock");
    toast.success(t("sim.solar.proUnlocked"));
  };

  const handleFinish = () => {
    const bonus = completed.length === tasks.length ? 20 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    saveProgress(true, tasks, finalScore, proUnlocked);
    toast.success(completed.length === tasks.length ? t("sim.solar.allTasks") : t("sim.solar.partialTasks"));
  };

  const handleRestart = () => {
    setTasks(INITIAL_TASKS.map((t) => ({ ...t })));
    setScore(0);
    setPowerOutput(4500);
    setBatteryCharge(88);
    setEfficiency(94);
    setProUnlocked(false);
  };

  return (
    <div className="space-y-6">
      {/* Solar Field */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-muted/60 to-muted">
        <img
          src="https://images.unsplash.com/photo-1509391366360-fe5bb584850a?w=800"
          alt={t("sim.solar.field")}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* Sun glow */}
        <div
          className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-yellow-400/30 blur-2xl transition-opacity duration-1000 ${sunPulsing ? "opacity-100 animate-pulse" : "opacity-40"}`}
        />
        <div className="absolute bottom-4 left-4 right-4 flex justify-between">
          <Badge variant="secondary" className="text-sm">{t("sim.solar.score")}: {score}</Badge>
          <Badge variant="outline" className="text-sm">{completed.length}/{tasks.length} {t("sim.solar.tasksDone")}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.solar.power")}</p>
          <p className="text-lg font-bold font-mono text-green-500">{powerOutput} W</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.solar.battery")}</p>
          <p className="text-lg font-bold font-mono text-green-500">{batteryCharge}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.solar.efficiency")}</p>
          <p className="text-lg font-bold font-mono text-green-500">{Math.round(efficiency)}%</p>
        </CardContent></Card>
      </div>

      <Progress value={progress} className="h-2" />

      {/* Task Grid */}
      <div className="grid grid-cols-2 gap-3">
        {tasks.map((task) => {
          const locked = task.premium && !proUnlocked;
          return (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all hover:border-primary ${task.done ? "opacity-60 border-green-500" : ""} ${locked ? "opacity-50 grayscale" : ""} ${activeTask === task.id ? "ring-2 ring-primary animate-pulse" : ""}`}
              onClick={() => handleTask(task)}
            >
              <CardContent className="p-4 text-center relative">
                <span className="text-2xl">{task.icon}</span>
                <p className="text-sm mt-1 font-medium text-foreground">{t(task.labelKey)}</p>
                {task.done && <Badge className="absolute top-1 right-1 text-[10px]" variant="secondary">✓</Badge>}
                {locked && (
                  <Badge className="absolute top-1 ltr:right-1 rtl:left-1 text-[10px] bg-cyan-600 text-black">🔒 PRO</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleFinish} className="flex-1">{t("sim.solar.finish")}</Button>
        <Button variant="outline" onClick={handleRestart}>{t("sim.solar.restart")}</Button>
      </div>

      {/* Pro Dialog */}
      <Dialog open={showPro} onOpenChange={setShowPro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.solar.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.solar.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button onClick={unlockPro} className="flex-1">{t("sim.solar.unlockBtn")}</Button>
            <Button variant="ghost" onClick={() => setShowPro(false)}>{t("sim.solar.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
