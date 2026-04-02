import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, Wrench, Flame, Cpu, Battery, MemoryStick, Fan, Monitor, Zap, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ComponentState = "pending" | "installed" | "burned";

type BoardComponent = {
  id: string;
  nameKey: string;
  statusKey: string;
  icon: React.ReactNode;
  premium: boolean;
  tool: "hand" | "solder" | "bios";
  fixAction: string;
};

const COMPONENTS: BoardComponent[] = [
  { id: "battery", nameKey: "sim.board.comp.battery", statusKey: "sim.board.status.connected", icon: <Battery className="h-6 w-6" />, premium: false, tool: "hand", fixAction: "disconnect" },
  { id: "ram", nameKey: "sim.board.comp.ram", statusKey: "sim.board.status.needsUpgrade", icon: <MemoryStick className="h-6 w-6" />, premium: false, tool: "hand", fixAction: "upgrade" },
  { id: "fan", nameKey: "sim.board.comp.fan", statusKey: "sim.board.status.dusty", icon: <Fan className="h-6 w-6" />, premium: false, tool: "hand", fixAction: "clean" },
  { id: "bios", nameKey: "sim.board.comp.bios", statusKey: "sim.board.status.corrupted", icon: <Cpu className="h-6 w-6" />, premium: true, tool: "bios", fixAction: "flash" },
  { id: "powerIc", nameKey: "sim.board.comp.powerIc", statusKey: "sim.board.status.burned", icon: <Zap className="h-6 w-6" />, premium: true, tool: "solder", fixAction: "replace" },
  { id: "display", nameKey: "sim.board.comp.display", statusKey: "sim.board.status.needsReplace", icon: <Monitor className="h-6 w-6" />, premium: false, tool: "hand", fixAction: "replace" },
];

type Tool = "hand" | "solder" | "bios";

type Props = { simulationId?: string };

export function BoardSurgeonSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [proUnlocked, setProUnlocked] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("hand");
  const [states, setStates] = useState<Record<string, ComponentState>>(
    Object.fromEntries(COMPONENTS.map((c) => [c.id, "pending"]))
  );
  const [log, setLog] = useState<string[]>([`> ${t("sim.board.log.ready")}`]);
  const [score, setScore] = useState(0);
  const [bootTested, setBootTested] = useState(false);

  // Restore saved progress
  useEffect(() => {
    if (!savedProgress) return;
    const d = savedProgress.decisions as any;
    if (Array.isArray(d)) {
      const newStates = { ...Object.fromEntries(COMPONENTS.map((c) => [c.id, "pending" as ComponentState])) };
      d.forEach((id: string) => { newStates[id] = "installed"; });
      setStates(newStates);
    }
    setScore(savedProgress.score ?? 0);
  }, [savedProgress]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-6), `> ${msg}`]);
  }, []);

  const handleComponent = useCallback((comp: BoardComponent) => {
    if (comp.premium && !proUnlocked) {
      toast.info(t("sim.board.unlockHint"));
      return;
    }
    if (states[comp.id] === "installed") return;

    if (activeTool !== comp.tool) {
      addLog(t("sim.board.wrongTool"));
      setStates((s) => ({ ...s, [comp.id]: "burned" }));
      playSound("wrong");
      toast.error(t("sim.board.componentBurned"));
      return;
    }

    setStates((s) => ({ ...s, [comp.id]: "installed" }));
    setScore((s) => s + (comp.premium ? 25 : 15));
    addLog(`${t(comp.nameKey)}: ${t("sim.board.fixed")}`);
    playSound("correct");
    toast.success(`${t(comp.nameKey)} ✓`);
  }, [proUnlocked, states, activeTool, addLog, t, playSound]);

  const bootTest = useCallback(async () => {
    setBootTested(true);
    const installed = Object.values(states).filter((s) => s === "installed").length;
    const burned = Object.values(states).filter((s) => s === "burned").length;
    const total = COMPONENTS.filter((c) => !c.premium || proUnlocked).length;

    if (burned > 0) {
      addLog(t("sim.board.bootFail.burned"));
      toast.error(t("sim.board.bootFail.burned"));
    } else if (installed < total) {
      addLog(t("sim.board.bootFail.incomplete"));
      toast.warning(t("sim.board.bootFail.incomplete"));
    } else {
      const bonus = 30;
      setScore((s) => s + bonus);
      addLog(t("sim.board.bootSuccess"));
      toast.success(t("sim.board.bootSuccess"));

      if (user && simulationId) {
        const { data: existing } = await supabase
          .from("simulation_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("simulation_id", simulationId)
          .maybeSingle();

        const payload = {
          current_step: installed,
          decisions: JSON.parse(JSON.stringify(Object.entries(states).filter(([, v]) => v === "installed").map(([k]) => k))),
          score: score + bonus,
          completed: true,
        };

        if (existing) {
          await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("simulation_progress").insert([{
            user_id: user.id,
            simulation_id: simulationId,
            ...payload,
          }]);
        }
      }
    }
  }, [states, proUnlocked, score, user, simulationId, addLog, t]);

  const reset = () => {
    setStates(Object.fromEntries(COMPONENTS.map((c) => [c.id, "pending"])));
    setLog([`> ${t("sim.board.log.ready")}`]);
    setScore(0);
    setBootTested(false);
    setActiveTool("hand");
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setScore((s) => s + 20);
    toast.success(t("sim.board.proUnlocked"));
    addLog(t("sim.board.proUnlocked"));
  };

  const tools: { id: Tool; nameKey: string; icon: React.ReactNode; premium: boolean }[] = [
    { id: "hand", nameKey: "sim.board.tool.hand", icon: <Wrench className="h-4 w-4" />, premium: false },
    { id: "solder", nameKey: "sim.board.tool.solder", icon: <Flame className="h-4 w-4" />, premium: true },
    { id: "bios", nameKey: "sim.board.tool.bios", icon: <Cpu className="h-4 w-4" />, premium: true },
  ];

  const allInstalled = COMPONENTS
    .filter((c) => !c.premium || proUnlocked)
    .every((c) => states[c.id] === "installed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">{t("sim.board.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t("sim.board.score")}: {score}</Badge>
          <Badge variant={proUnlocked ? "default" : "outline"}>
            {proUnlocked ? "PRO" : t("sim.board.levelHobby")}
          </Badge>
        </div>
      </div>

      {/* Toolbox */}
      <div className="flex gap-2 flex-wrap">
        {tools.map((tool) => {
          const isLocked = tool.premium && !proUnlocked;
          return (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "outline"}
              size="sm"
              disabled={isLocked}
              onClick={() => setActiveTool(tool.id)}
              className="gap-2"
            >
              {tool.icon}
              {t(tool.nameKey)}
              {isLocked && <Lock className="h-3 w-3" />}
            </Button>
          );
        })}
      </div>

      {/* Motherboard grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COMPONENTS.map((comp) => {
          const state = states[comp.id];
          const isLocked = comp.premium && !proUnlocked;

          return (
            <Card
              key={comp.id}
              className={`cursor-pointer transition-all ${
                state === "installed"
                  ? "border-green-500/60 bg-green-500/10"
                  : state === "burned"
                  ? "border-destructive/60 bg-destructive/10 animate-pulse"
                  : isLocked
                  ? "opacity-50 grayscale"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleComponent(comp)}
            >
              <CardContent className="pt-4 text-center space-y-1 relative">
                {isLocked && <Lock className="h-3 w-3 absolute top-2 right-2 text-muted-foreground" />}
                {state === "installed" && <CheckCircle2 className="h-3 w-3 absolute top-2 right-2 text-green-500" />}
                <div className="flex justify-center text-primary">{comp.icon}</div>
                <p className="font-medium text-xs">{t(comp.nameKey)}</p>
                <p className="text-[10px] text-muted-foreground">{t(comp.statusKey)}</p>
                {isLocked && <Badge variant="outline" className="text-[9px] px-1">PRO</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Terminal log */}
      <Card className="bg-card border-primary/30">
        <CardContent className="pt-4">
          <div className="font-mono text-xs space-y-1 text-green-500 dark:text-green-400">
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unlock PRO */}
      {!proUnlocked && Object.values(states).filter((s) => s === "installed").length >= 2 && (
        <Card className="border-primary bg-primary/10">
          <CardContent className="pt-4 text-center space-y-3">
            <p className="font-semibold">{t("sim.board.unlockTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.board.unlockDesc")}</p>
            <Button onClick={unlockPro}>{t("sim.board.unlockBtn")}</Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={bootTest} disabled={bootTested && allInstalled} className="flex-1 gap-2">
          🚀 {t("sim.board.bootTest")}
        </Button>
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("sim.board.reset")}
        </Button>
      </div>
    </div>
  );
}
