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
  { id: "cut", labelKey: "sim.wood.task.cut", icon: "🪚", premium: false, done: false },
  { id: "sand", labelKey: "sim.wood.task.sand", icon: "✨", premium: false, done: false },
  { id: "join", labelKey: "sim.wood.task.join", icon: "🔩", premium: false, done: false },
  { id: "cnc", labelKey: "sim.wood.task.cnc", icon: "🤖", premium: true, done: false },
  { id: "epoxy", labelKey: "sim.wood.task.epoxy", icon: "🎨", premium: true, done: false },
  { id: "lathe", labelKey: "sim.wood.task.lathe", icon: "🔄", premium: true, done: false },
];

export function WoodworkingSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS.map((t) => ({ ...t })));
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [score, setScore] = useState(0);
  const [woodType, setWoodType] = useState("Swedish Pine");
  const [moisture, setMoisture] = useState(12);
  const [hardness, setHardness] = useState("Medium");
  const [sawAnimating, setSawAnimating] = useState(false);

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
    playSound("snip");

    if (task.id === "cut") setSawAnimating(true);

    const interval = setInterval(() => {
      if (task.id === "sand") setMoisture((m) => Math.max(8, m - 0.3));
      if (task.id === "cnc") setHardness("Precision");
      if (task.id === "epoxy") setWoodType("Epoxy Hybrid");
    }, 400);

    setTimeout(() => {
      clearInterval(interval);
      setSawAnimating(false);
      setActiveTask(null);
      const newScore = score + (task.premium ? 20 : 10);
      setScore(newScore);
      const updated = tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t));
      setTasks(updated);
      playSound("ding");
      toast.success(t("sim.wood.taskDone"));
      saveProgress(updated.every((t) => t.done), updated, newScore, proUnlocked);
    }, 2500);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowPro(false);
    playSound("unlock");
    toast.success(t("sim.wood.proUnlocked"));
  };

  const handleFinish = () => {
    const bonus = completed.length === tasks.length ? 20 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    saveProgress(true, tasks, finalScore, proUnlocked);
    toast.success(completed.length === tasks.length ? t("sim.wood.allTasks") : t("sim.wood.partialTasks"));
  };

  const handleRestart = () => {
    setTasks(INITIAL_TASKS.map((t) => ({ ...t })));
    setScore(0);
    setWoodType("Swedish Pine");
    setMoisture(12);
    setHardness("Medium");
    setProUnlocked(false);
  };

  return (
    <div className="space-y-6">
      {/* Workshop Screen */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border-2 border-amber-800/50 bg-gradient-to-br from-muted/60 to-muted">
        <img
          src="https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800"
          alt={t("sim.wood.workshop")}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {sawAnimating && (
          <div className="absolute top-1/2 w-full h-1 bg-muted-foreground/60 shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse" />
        )}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between">
          <Badge variant="secondary" className="text-sm">{t("sim.wood.score")}: {score}</Badge>
          <Badge variant="outline" className="text-sm">{completed.length}/{tasks.length} {t("sim.wood.tasksDone")}</Badge>
        </div>
      </div>

      {/* Wood Specs */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.wood.type")}</p>
          <p className="text-sm font-bold text-foreground">{woodType}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.wood.moisture")}</p>
          <p className="text-lg font-bold text-foreground">{Math.round(moisture)}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{t("sim.wood.hardness")}</p>
          <p className="text-sm font-bold text-foreground">{hardness}</p>
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
        <Button onClick={handleFinish} className="flex-1">{t("sim.wood.finish")}</Button>
        <Button variant="outline" onClick={handleRestart}>{t("sim.wood.restart")}</Button>
      </div>

      {/* Pro Dialog */}
      <Dialog open={showPro} onOpenChange={setShowPro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sim.wood.unlockTitle")}</DialogTitle>
            <DialogDescription>{t("sim.wood.unlockDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button onClick={unlockPro} className="flex-1">{t("sim.wood.unlockBtn")}</Button>
            <Button variant="ghost" onClick={() => setShowPro(false)}>{t("sim.wood.close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
