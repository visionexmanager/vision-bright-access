import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  { id: "cut", labelKey: "sim.alu.task.cut", icon: "📐", premium: false, done: false },
  { id: "glass", labelKey: "sim.alu.task.glass", icon: "🪟", premium: false, done: false },
  { id: "seal", labelKey: "sim.alu.task.seal", icon: "🔧", premium: false, done: false },
  { id: "curtain", labelKey: "sim.alu.task.curtain", icon: "🏗️", premium: true, done: false },
  { id: "thermal", labelKey: "sim.alu.task.thermal", icon: "🌡️", premium: true, done: false },
  { id: "smart", labelKey: "sim.alu.task.smart", icon: "🤖", premium: true, done: false },
];

export function AluminumGlazingSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS.map((t) => ({ ...t })));
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [score, setScore] = useState(0);
  const [angle, setAngle] = useState(45);
  const [thickness, setThickness] = useState(1.8);
  const [insulation, setInsulation] = useState("Double");
  const [laserOn, setLaserOn] = useState(false);

  const completed = tasks.filter((t) => t.done);
  const progress = Math.round((completed.length / tasks.length) * 100);

  const saveProgress = useCallback(
    async (done: boolean, completedTasks: Task[], sc: number, pro: boolean) => {
      if (!user || !simulationId) return;
      const payload = {
        user_id: user.id,
        simulation_id: simulationId,
        current_step: completedTasks.filter((t) => t.done).length,
        decisions: { completed: completedTasks.filter((t) => t.done).map((t) => t.id), proUnlocked: pro } as any,
        score: sc,
        completed: done,
      };
      await supabase.from("simulation_progress").upsert(payload, { onConflict: "user_id,simulation_id" as any });
    },
    [user, simulationId],
  );

  const handleTask = (task: Task) => {
    if (task.done) return;
    if (task.premium && !proUnlocked) {
      setShowPro(true);
      return;
    }
    setActiveTask(task.id);
    playSound("scan");

    if (task.id === "cut") setLaserOn(true);

    const interval = setInterval(() => {
      if (task.id === "cut") setAngle((a) => (a >= 90 ? 45 : a + 5));
      if (task.id === "glass") setThickness((th) => Math.round((th + 0.1) * 10) / 10);
      if (task.id === "thermal") setInsulation("Triple");
    }, 400);

    setTimeout(() => {
      clearInterval(interval);
      setLaserOn(false);
      setActiveTask(null);
      const newScore = score + (task.premium ? 20 : 10);
      setScore(newScore);
      const updated = tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t));
      setTasks(updated);
      playSound("ding");
      toast.success(t("sim.alu.taskDone"));

      const allDone = updated.every((t) => t.done);
      saveProgress(allDone, updated, newScore, proUnlocked);
    }, 2500);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowPro(false);
    playSound("unlock");
    toast.success(t("sim.alu.proUnlocked"));
  };

  const handleFinish = () => {
    const bonus = completed.length === tasks.length ? 20 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    saveProgress(true, tasks, finalScore, proUnlocked);
    toast.success(completed.length === tasks.length ? t("sim.alu.allTasks") : t("sim.alu.partialTasks"));
  };

  const handleRestart = () => {
    setTasks(INITIAL_TASKS.map((t) => ({ ...t })));
    setScore(0);
    setAngle(45);
    setThickness(1.8);
    setInsulation("Double");
    setProUnlocked(false);
  };

  return (
    <div className="space-y-6">
      {/* Workshop Screen */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border-2 border-border bg-gradient-to-br from-muted/60 to-muted">
        <img
          src="https://images.unsplash.com/photo-1503594384566-461fe158e797?w=800"
          alt={t("sim.alu.airflow")}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {laserOn && (
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-red-500 shadow-[0_0_12px_rgba(255,0,0,0.7)] animate-pulse" />
        )}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between">
          <Badge variant="secondary" className="text-sm">{t("sim.alu.score")}: {score}</Badge>
          <Badge variant="outline" className="text-sm">{completed.length}/{tasks.length} {t("sim.alu.tasksDone")}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.alu.angle")}</p>
          <p className="text-lg font-bold text-foreground">{angle}°</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.alu.thickness")}</p>
          <p className="text-lg font-bold text-foreground">{thickness}mm</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.alu.insulation")}</p>
          <p className="text-lg font-bold text-foreground">{insulation}</p>
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
                  <Badge className="absolute top-1 ltr:right-1 rtl:left-1 text-[10px] bg-yellow-600 text-black">🔒 PRO</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleFinish} className="flex-1">{t("sim.alu.finish")}</Button>
        <Button variant="outline" onClick={handleRestart}>{t("sim.alu.restart")}</Button>
      </div>

      {/* Pro Dialog */}
      <Dialog open={showPro} onOpenChange={setShowPro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.alu.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.alu.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button onClick={unlockPro} className="flex-1">{t("sim.alu.unlockBtn")}</Button>
            <Button variant="ghost" onClick={() => setShowPro(false)}>{t("sim.alu.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
