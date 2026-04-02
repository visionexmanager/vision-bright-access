import { useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, Flame, Snowflake, Milk, Package, RotateCcw, Thermometer, Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Phase = "raw" | "heated" | "cooled" | "fermented" | "cheese" | "packaged";

type Props = { simulationId?: string };

export function DairyFarmSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [temp, setTemp] = useState(20);
  const [phase, setPhase] = useState<Phase>("raw");
  const [proUnlocked, setProUnlocked] = useState(false);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<string[]>([t("sim.dairy.log.start")]);
  const [completed, setCompleted] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-4), msg]);
  }, []);

  const heat = useCallback(() => {
    if (phase !== "raw") {
      addLog(t("sim.dairy.already"));
      return;
    }
    const newTemp = Math.min(temp + 20, 85);
    setTemp(newTemp);

    if (newTemp >= 72) {
      setPhase("heated");
      setScore((s) => s + 15);
      addLog(t("sim.dairy.heated"));
      playSound("sizzle");
      toast.success(t("sim.dairy.heated"));
    } else {
      playSound("cooking");
      addLog(`${t("sim.dairy.heating")} ${newTemp}°C`);
    }
  }, [phase, temp, addLog, t, playSound]);

  const cool = useCallback(() => {
    if (phase !== "heated") {
      addLog(t("sim.dairy.coolFirst"));
      return;
    }
    setTemp(38);
    setPhase("cooled");
    setScore((s) => s + 15);
    addLog(t("sim.dairy.cooled"));
    toast.success(t("sim.dairy.cooled"));
  }, [phase, addLog, t]);

  const addStarter = useCallback(() => {
    if (phase !== "cooled") {
      addLog(t("sim.dairy.starterFirst"));
      return;
    }
    setPhase("fermented");
    setScore((s) => s + 20);
    addLog(t("sim.dairy.fermented"));
    toast.success(t("sim.dairy.fermented"));
  }, [phase, addLog, t]);

  const makeCheese = useCallback(() => {
    if (!proUnlocked) {
      toast.info(t("sim.dairy.unlockHint"));
      return;
    }
    if (phase !== "fermented") {
      addLog(t("sim.dairy.fermentFirst"));
      return;
    }
    setPhase("cheese");
    setScore((s) => s + 25);
    addLog(t("sim.dairy.cheeseMade"));
    toast.success(t("sim.dairy.cheeseMade"));
  }, [proUnlocked, phase, addLog, t]);

  const packageProduct = useCallback(async () => {
    if (!proUnlocked) {
      toast.info(t("sim.dairy.unlockHint"));
      return;
    }
    if (phase !== "cheese" && phase !== "fermented") {
      addLog(t("sim.dairy.packageFirst"));
      return;
    }
    setPhase("packaged");
    const bonus = 20;
    setScore((s) => s + bonus);
    setCompleted(true);
    addLog(t("sim.dairy.packaged"));
    toast.success(t("sim.dairy.complete"));

    if (user && simulationId) {
      const finalScore = score + bonus;
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: 6,
        decisions: JSON.parse(JSON.stringify({ phase: "packaged", temp })),
        score: finalScore,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert([{ user_id: user.id, simulation_id: simulationId, ...payload }]);
      }
    }
  }, [proUnlocked, phase, score, temp, user, simulationId, addLog, t]);

  const unlockPro = useCallback(() => {
    setProUnlocked(true);
    setScore((s) => s + 20);
    toast.success(t("sim.dairy.proUnlocked"));
    addLog(t("sim.dairy.proUnlocked"));
  }, [addLog, t]);

  const reset = () => {
    setTemp(20);
    setPhase("raw");
    setProUnlocked(false);
    setScore(0);
    setLog([t("sim.dairy.log.start")]);
    setCompleted(false);
  };

  const phaseIndex = ["raw", "heated", "cooled", "fermented", "cheese", "packaged"].indexOf(phase);
  const progressPct = Math.round((phaseIndex / 5) * 100);
  const isSteaming = temp >= 60;

  // Pot fill color based on phase
  const fillClass =
    phase === "fermented" || phase === "cheese"
      ? "bg-amber-200"
      : phase === "packaged"
      ? "bg-green-200"
      : "bg-white";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Milk className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">{t("sim.dairy.title")}</h2>
        </div>
        <Badge variant="secondary">{t("sim.dairy.score")}: {score}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">{t("sim.dairy.desc")}</p>

      {/* Pot visualization */}
      <Card className="border-muted">
        <CardContent className="pt-6 flex flex-col items-center gap-3">
          <div className="relative w-40 h-32 bg-muted rounded-b-[2rem] border-4 border-muted-foreground/30 overflow-hidden">
            {isSteaming && (
              <div className="absolute -top-6 w-full text-center text-2xl animate-bounce opacity-60">
                💨
              </div>
            )}
            <div
              className={`absolute bottom-0 w-full transition-all duration-700 ${fillClass}`}
              style={{ height: "80%" }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold font-mono">{temp}°C</span>
          </div>

          <Progress value={progressPct} className="w-full max-w-xs" />
          <p className="text-xs text-muted-foreground">
            {t(`sim.dairy.phase.${phase}`)}
          </p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={heat}
          disabled={phase !== "raw" || completed}
          className="gap-2"
        >
          <Flame className="h-4 w-4" />
          {t("sim.dairy.btn.heat")}
        </Button>
        <Button
          variant="outline"
          onClick={cool}
          disabled={phase !== "heated" || completed}
          className="gap-2"
        >
          <Snowflake className="h-4 w-4" />
          {t("sim.dairy.btn.cool")}
        </Button>
        <Button
          variant="outline"
          onClick={addStarter}
          disabled={phase !== "cooled" || completed}
          className="gap-2"
        >
          🥣 {t("sim.dairy.btn.starter")}
        </Button>
        <Button
          variant="outline"
          onClick={makeCheese}
          disabled={(phase !== "fermented" || completed) && proUnlocked}
          className="gap-2 relative"
        >
          <Circle className="h-4 w-4" />
          {t("sim.dairy.btn.cheese")}
          {!proUnlocked && <Lock className="h-3 w-3 absolute top-1 right-1 text-muted-foreground" />}
        </Button>
        <Button
          variant="outline"
          onClick={packageProduct}
          disabled={completed}
          className="gap-2 relative"
        >
          <Package className="h-4 w-4" />
          {t("sim.dairy.btn.package")}
          {!proUnlocked && <Lock className="h-3 w-3 absolute top-1 right-1 text-muted-foreground" />}
        </Button>
        <Button variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("sim.dairy.btn.reset")}
        </Button>
      </div>

      {/* Unlock PRO */}
      {!proUnlocked && phaseIndex >= 2 && (
        <Card className="border-primary bg-primary/10">
          <CardContent className="pt-4 text-center space-y-3">
            <p className="font-semibold">{t("sim.dairy.unlockTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.dairy.unlockDesc")}</p>
            <Button onClick={unlockPro}>{t("sim.dairy.unlockBtn")}</Button>
          </CardContent>
        </Card>
      )}

      {/* Log */}
      <Card className="bg-card border-muted">
        <CardContent className="pt-4">
          <div className="text-sm space-y-1 text-muted-foreground italic">
            {log.map((line, i) => (
              <p key={i}>🧑‍🍳 {line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Completed */}
      {completed && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-semibold">{t("sim.dairy.complete")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.dairy.finalScore")}: {score}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
