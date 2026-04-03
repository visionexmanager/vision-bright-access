import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Trophy, Smartphone, Cpu } from "lucide-react";

interface Props { simulationId?: string; }

interface RepairJob {
  id: number;
  device: string;
  issue: string;
  difficulty: number;
  customerBudget: number;
  urgency: "normal" | "rush";
}

const DEVICES = ["iPhone 15", "Samsung S24", "Pixel 8", "iPad Pro", "MacBook Air", "OnePlus 12"];
const ISSUES = [
  { name: "Cracked Screen", partCost: 45, time: 30 },
  { name: "Battery Replacement", partCost: 25, time: 20 },
  { name: "Charging Port", partCost: 15, time: 25 },
  { name: "Water Damage", partCost: 60, time: 45 },
  { name: "Motherboard Repair", partCost: 120, time: 60 },
  { name: "Software Flash", partCost: 0, time: 15 },
];

const TOOL_UPGRADES = [
  { id: "basic", name: "🔧 Basic Kit", speedBonus: 0, qualityBonus: 0, cost: 0 },
  { id: "pro", name: "🛠️ Pro Kit", speedBonus: 15, qualityBonus: 10, cost: 200 },
  { id: "micro", name: "🔬 Micro-Soldering", speedBonus: 10, qualityBonus: 25, cost: 500 },
];

function randomJob(id: number): RepairJob {
  const issue = ISSUES[Math.floor(Math.random() * ISSUES.length)];
  return {
    id,
    device: DEVICES[Math.floor(Math.random() * DEVICES.length)],
    issue: issue.name,
    difficulty: 1 + Math.floor(Math.random() * 5),
    customerBudget: issue.partCost + 30 + Math.floor(Math.random() * 80),
    urgency: Math.random() > 0.7 ? "rush" : "normal",
  };
}

export function MobileRepairSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [jobs, setJobs] = useState<RepairJob[]>(() => Array.from({ length: 3 }, (_, i) => randomJob(i)));
  const [currentJob, setCurrentJob] = useState<RepairJob | null>(null);
  const [toolKit, setToolKit] = useState(TOOL_UPGRADES[0]);
  const [laborRate, setLaborRate] = useState(40);
  const [qualityFocus, setQualityFocus] = useState(5);
  const [useOemParts, setUseOemParts] = useState(true);

  const [round, setRound] = useState(1);
  const [totalRounds] = useState(6);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [reputation, setReputation] = useState(60);
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [repairStage, setRepairStage] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<{ device: string; issue: string; profit: number; quality: number }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: round,
      score: sc, completed: done, decisions: { revenue, costs, history } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, round, revenue, costs, history]);

  const selectJob = (job: RepairJob) => {
    setCurrentJob(job);
    setJobs((j) => j.filter((x) => x.id !== job.id));
    playSound("scan");
  };

  const issueData = currentJob ? ISSUES.find((i) => i.name === currentJob.issue) ?? ISSUES[0] : ISSUES[0];
  const partCost = useOemParts ? issueData.partCost : Math.round(issueData.partCost * 0.5);
  const totalCharge = laborRate + partCost + (currentJob?.urgency === "rush" ? 20 : 0);

  const startRepair = () => {
    if (!currentJob || repairing) return;
    if (totalCharge > currentJob.customerBudget * 1.3) {
      toast.error("❌ Price too high! Customer walked away.");
      setReputation((r) => Math.max(0, r - 8));
      setCurrentJob(null);
      return;
    }
    setRepairing(true);
    setRepairProgress(0);
    playSound("scan");

    const stages = ["🔍 Diagnosing...", "🔧 Disassembling...", `🛠️ Fixing ${currentJob.issue}...`, "🔬 Testing...", "✅ Quality check..."];
    let step = 0;
    const total = 20;
    const interval = setInterval(() => {
      step++;
      setRepairProgress(Math.round((step / total) * 100));
      setRepairStage(stages[Math.min(Math.floor((step / total) * stages.length), stages.length - 1)]);
      if (step >= total) {
        clearInterval(interval);
        let quality = 60 + toolKit.qualityBonus + qualityFocus * 3 + (useOemParts ? 10 : -5);
        quality = Math.min(100, Math.max(0, quality - currentJob.difficulty * 5));

        const jobRevenue = totalCharge;
        const jobCost = partCost + toolKit.cost * 0.05;
        const profit = Math.round(jobRevenue - jobCost);
        const repChange = quality > 80 ? 5 : quality > 60 ? 2 : -8;

        setRevenue((r) => r + jobRevenue);
        setCosts((c) => c + Math.round(jobCost));
        setReputation((r) => Math.max(0, Math.min(100, r + repChange)));
        setHistory((h) => [...h, { device: currentJob.device, issue: currentJob.issue, profit, quality }]);

        setRepairing(false);
        setCurrentJob(null);
        playSound("ding");
        toast.success(`✅ ${currentJob.device} fixed! Quality: ${quality}% | +$${profit}`);

        if (round >= totalRounds) finishGame();
        else {
          setRound((r) => r + 1);
          setJobs((prev) => [...prev, randomJob(round * 10 + Math.random() * 100)]);
        }
      }
    }, 140);
  };

  const finishGame = () => {
    const avgQ = history.length > 0 ? Math.round(history.reduce((a, h) => a + h.quality, 0) / history.length) : 0;
    const finalScore = Math.max(0, Math.round((revenue - costs) / 5) + reputation + avgQ);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setRound(1); setRevenue(0); setCosts(0); setReputation(60);
    setRepairing(false); setFinished(false); setScore(0); setHistory([]);
    setCurrentJob(null); setJobs(Array.from({ length: 3 }, (_, i) => randomJob(i)));
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">📱 Repair Shop Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{reputation}%</p><p className="text-xs text-muted-foreground">Reputation</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm p-1 bg-muted/30 rounded">
              <span>{h.device}: {h.issue}</span>
              <span className={h.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{h.quality}% | ${h.profit}</span>
            </div>
          ))}
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><Smartphone className="h-5 w-5" /> Job {round}/{totalRounds}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">${revenue - costs} profit</Badge>
          <Badge variant="outline">⭐ {reputation}%</Badge>
        </div>
      </div>
      <Progress value={(round / totalRounds) * 100} className="h-2" />

      {repairing && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Cpu className="mx-auto h-8 w-8 text-primary animate-pulse" />
            <p className="font-semibold">{repairStage}</p>
            <Progress value={repairProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!currentJob && !repairing && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">📋 Repair Queue</h3>
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => selectJob(j)}>
                <div>
                  <p className="font-medium text-sm">{j.device} - {j.issue} {j.urgency === "rush" ? "⚡" : ""}</p>
                  <p className="text-xs text-muted-foreground">Difficulty: {"⭐".repeat(j.difficulty)} | Budget: ${j.customerBudget}</p>
                </div>
                <Button size="sm" variant="outline">Take</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {currentJob && !repairing && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🔧 {currentJob.device} - {currentJob.issue}</h3>
            <p className="text-xs text-muted-foreground">Difficulty: {"⭐".repeat(currentJob.difficulty)} | Budget: ${currentJob.customerBudget} {currentJob.urgency === "rush" ? "| ⚡ Rush" : ""}</p>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tool Kit</label>
              <Select value={toolKit.id} onValueChange={(v) => setToolKit(TOOL_UPGRADES.find((t) => t.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOOL_UPGRADES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} {t.cost > 0 ? `($${t.cost})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Labor Rate: ${laborRate}</label>
              <Slider value={[laborRate]} onValueChange={([v]) => setLaborRate(v)} min={20} max={100} step={5} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quality Focus: {qualityFocus}/10</label>
              <Slider value={[qualityFocus]} onValueChange={([v]) => setQualityFocus(v)} min={1} max={10} step={1} />
            </div>

            <div className="flex gap-3">
              <Button variant={useOemParts ? "default" : "outline"} size="sm" onClick={() => setUseOemParts(true)} className="flex-1">
                🏷️ OEM Parts (${issueData.partCost})
              </Button>
              <Button variant={!useOemParts ? "default" : "outline"} size="sm" onClick={() => setUseOemParts(false)} className="flex-1">
                🔄 Generic (${Math.round(issueData.partCost * 0.5)})
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Labor:</span><span>${laborRate}</span></div>
              <div className="flex justify-between"><span>Parts:</span><span>${partCost}</span></div>
              {currentJob.urgency === "rush" && <div className="flex justify-between"><span>Rush fee:</span><span>$20</span></div>}
              <div className="flex justify-between font-bold border-t border-border pt-1">
                <span>Total Charge:</span>
                <span className={totalCharge > currentJob.customerBudget * 1.3 ? "text-red-500" : "text-green-500"}>${totalCharge}</span>
              </div>
              <div className="flex justify-between"><span>Budget:</span><span>${currentJob.customerBudget}</span></div>
            </div>

            <Button onClick={startRepair} className="w-full">🔧 Start Repair</Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Repair History</h3>
            {history.map((h, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>{h.device}: {h.issue}</span>
                <span className={h.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{h.quality}% | ${h.profit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
