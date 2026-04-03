import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Wrench, Flame, Cpu, Battery, MemoryStick, Fan, Monitor, Zap, RotateCcw, Thermometer, AlertTriangle } from "lucide-react";
import { FinancialBar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";

type Stage = "diagnosis" | "repair" | "testing" | "results";

type Symptom = { id: string; description: string; icon: React.ReactNode };
type RepairAction = { id: string; name: string; tool: string; cost: number; time: number; correctFor: string[] };

const SYMPTOMS: Symptom[] = [
  { id: "no-power", description: "Device won't turn on at all", icon: <Zap className="h-5 w-5" /> },
  { id: "overheating", description: "Device shuts down after 5 minutes", icon: <Thermometer className="h-5 w-5" /> },
  { id: "slow", description: "Extremely slow performance", icon: <Cpu className="h-5 w-5" /> },
  { id: "display-flicker", description: "Screen flickering and artifacts", icon: <Monitor className="h-5 w-5" /> },
  { id: "battery-drain", description: "Battery drains in 30 minutes", icon: <Battery className="h-5 w-5" /> },
];

const REPAIR_ACTIONS: RepairAction[] = [
  { id: "replace-battery", name: "Replace Battery", tool: "hand", cost: 25, time: 15, correctFor: ["battery-drain", "no-power"] },
  { id: "replace-fan", name: "Replace/Clean Fan", tool: "hand", cost: 15, time: 20, correctFor: ["overheating"] },
  { id: "apply-thermal", name: "Apply Thermal Paste", tool: "hand", cost: 5, time: 10, correctFor: ["overheating"] },
  { id: "upgrade-ram", name: "Upgrade RAM", tool: "hand", cost: 40, time: 10, correctFor: ["slow"] },
  { id: "replace-ssd", name: "Replace HDD with SSD", tool: "hand", cost: 60, time: 15, correctFor: ["slow"] },
  { id: "replace-gpu", name: "Reflow/Replace GPU", tool: "solder", cost: 80, time: 45, correctFor: ["display-flicker"] },
  { id: "replace-lcd", name: "Replace LCD Cable", tool: "hand", cost: 20, time: 20, correctFor: ["display-flicker"] },
  { id: "replace-ic", name: "Replace Power IC", tool: "solder", cost: 35, time: 30, correctFor: ["no-power"] },
  { id: "flash-bios", name: "Flash BIOS Chip", tool: "bios", cost: 10, time: 25, correctFor: ["no-power", "slow"] },
  { id: "clean-board", name: "Ultrasonic Clean Board", tool: "hand", cost: 15, time: 15, correctFor: ["no-power", "overheating", "slow"] },
];

type ClientCase = {
  device: string;
  symptomIds: string[];
  customerBudget: number;
  urgency: "low" | "medium" | "high";
};

const CASES: ClientCase[] = [
  { device: "MacBook Pro 2019", symptomIds: ["overheating", "slow"], customerBudget: 150, urgency: "high" },
  { device: "iPhone 13", symptomIds: ["battery-drain"], customerBudget: 80, urgency: "medium" },
  { device: "Dell XPS 15", symptomIds: ["no-power"], customerBudget: 120, urgency: "high" },
  { device: "Gaming Laptop", symptomIds: ["display-flicker", "overheating"], customerBudget: 200, urgency: "low" },
];

type Props = { simulationId?: string };

export function BoardSurgeonSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("diagnosis");
  const [score, setScore] = useState(0);

  // Case management
  const [caseIndex, setCaseIndex] = useState(0);
  const [selectedRepairs, setSelectedRepairs] = useState<string[]>([]);
  const [chargePrice, setChargePrice] = useState(100);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [caseResults, setCaseResults] = useState<{ device: string; fixed: boolean; profit: number; satisfaction: number }[]>([]);
  const [diagnosticNotes, setDiagnosticNotes] = useState<string[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const currentCase = CASES[caseIndex];
  const caseSymptoms = currentCase ? SYMPTOMS.filter(s => currentCase.symptomIds.includes(s.id)) : [];

  const toggleRepair = (id: string) => {
    setSelectedRepairs(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const runDiagnostics = () => {
    if (!currentCase) return;
    playSound("scan");
    const notes: string[] = [];

    currentCase.symptomIds.forEach(sid => {
      const symptom = SYMPTOMS.find(s => s.id === sid);
      if (sid === "overheating") notes.push("🌡️ CPU temperature: 95°C (critical). Fan RPM: 800 (expected: 3000+).");
      else if (sid === "slow") notes.push("🐌 Disk read speed: 40 MB/s. RAM usage: 95% (4GB total).");
      else if (sid === "no-power") notes.push("⚡ No voltage on power rail. Battery shows 0V. Power IC not responding.");
      else if (sid === "display-flicker") notes.push("📺 GPU stress test shows artifacts at 60°C. LCD cable resistance: abnormal.");
      else if (sid === "battery-drain") notes.push("🔋 Battery health: 42%. Cycle count: 1200. Cells degraded.");
      else notes.push(`🔍 ${symptom?.description}`);
    });

    setDiagnosticNotes(notes);
    toast.success("Diagnostics complete!");
  };

  const submitRepair = () => {
    if (!currentCase || selectedRepairs.length === 0) {
      toast.error("Select at least one repair action!");
      return;
    }

    playSound("correct");

    // Check if repairs match symptoms
    const correctRepairs = selectedRepairs.filter(rid => {
      const action = REPAIR_ACTIONS.find(a => a.id === rid);
      return action && action.correctFor.some(cf => currentCase.symptomIds.includes(cf));
    });

    const wrongRepairs = selectedRepairs.filter(rid => !correctRepairs.includes(rid));
    const missedSymptoms = currentCase.symptomIds.filter(sid =>
      !selectedRepairs.some(rid => {
        const action = REPAIR_ACTIONS.find(a => a.id === rid);
        return action?.correctFor.includes(sid);
      })
    );

    const repairCost = selectedRepairs.reduce((s, rid) => {
      const action = REPAIR_ACTIONS.find(a => a.id === rid);
      return s + (action?.cost ?? 0);
    }, 0);

    const fixed = missedSymptoms.length === 0;
    const profit = chargePrice - repairCost;
    const satisfaction = fixed
      ? (chargePrice <= currentCase.customerBudget ? 90 : 60) - wrongRepairs.length * 10
      : 20;

    const caseScore = (correctRepairs.length * 10) - (wrongRepairs.length * 5) + (fixed ? 15 : 0) + (profit > 0 ? 5 : 0);

    setScore(prev => prev + Math.max(0, caseScore));
    setTotalRevenue(prev => prev + chargePrice);
    setTotalCosts(prev => prev + repairCost);
    setCaseResults(prev => [...prev, { device: currentCase.device, fixed, profit, satisfaction }]);

    toast(fixed ? `✅ ${currentCase.device} fixed!` : `⚠️ ${currentCase.device} — some issues remain`);

    if (caseIndex + 1 >= CASES.length) {
      setStage("testing");
    } else {
      setCaseIndex(prev => prev + 1);
      setSelectedRepairs([]);
      setChargePrice(100);
      setDiagnosticNotes([]);
    }
  };

  const finishSim = async () => {
    const totalProfit = totalRevenue - totalCosts;
    const fixedCount = caseResults.filter(r => r.fixed).length;
    const avgSatisfaction = caseResults.length > 0 ? Math.round(caseResults.reduce((s, r) => s + r.satisfaction, 0) / caseResults.length) : 0;

    const profitBonus = totalProfit > 0 ? Math.min(20, Math.round(totalProfit / 20)) : 0;
    const fixBonus = fixedCount * 5;
    const satBonus = avgSatisfaction >= 70 ? 10 : 0;
    const finalScore = score + profitBonus + fixBonus + satBonus;

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: CASES.length,
        decisions: { caseResults } as any,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("diagnosis");
    setScore(0);
    setCaseIndex(0);
    setSelectedRepairs([]);
    setChargePrice(100);
    setTotalRevenue(0);
    setTotalCosts(0);
    setCaseResults([]);
    setDiagnosticNotes([]);
  };

  const profit = totalRevenue - totalCosts;

  if (stage === "results") {
    const fixedCount = caseResults.filter(r => r.fixed).length;
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <Wrench className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Repair Shop — Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Devices Fixed</p><p className="text-lg font-bold text-green-500">{fixedCount}/{CASES.length}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Profit</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
            </div>
            {caseResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.fixed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span>{r.device} — {r.fixed ? "Fixed" : "Incomplete"} — ${r.profit} profit</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <FinancialBar title="📊 Profit Per Device" data={caseResults.map(r => ({
          label: r.device.split(" ")[0],
          value: Math.max(0, r.profit),
          color: r.fixed ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)",
        }))} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
      </div>
    );
  }

  if (stage === "testing") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" /> All Cases Complete</h2>
        <div className="space-y-3">
          {caseResults.map((r, i) => (
            <Card key={i} className={r.fixed ? "border-green-500/30" : "border-destructive/30"}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.device}</p>
                  <p className="text-sm text-muted-foreground">Profit: ${r.profit} | Satisfaction: {r.satisfaction}%</p>
                </div>
                {r.fixed ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={finishSim} className="w-full" size="lg">🏆 Get Final Score</Button>
      </div>
    );
  }

  // Diagnosis & Repair stage
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" /> Board Surgeon</h2>
        <Badge variant="secondary">Case {caseIndex + 1}/{CASES.length}</Badge>
      </div>

      <Progress value={((caseIndex) / CASES.length) * 100} className="h-2" />

      {/* Client Case */}
      <Card className="border-primary/30">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">📱 {currentCase.device}</h3>
            <Badge variant={currentCase.urgency === "high" ? "destructive" : currentCase.urgency === "medium" ? "secondary" : "outline"}>
              {currentCase.urgency} urgency
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Customer budget: ${currentCase.customerBudget}</p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Symptoms:</p>
            {caseSymptoms.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm bg-destructive/10 rounded-lg px-3 py-2">
                {s.icon}
                <span>{s.description}</span>
              </div>
            ))}
          </div>

          <Button onClick={runDiagnostics} variant="outline" className="w-full gap-2">
            🔍 Run Diagnostics
          </Button>
        </CardContent>
      </Card>

      {/* Diagnostic Notes */}
      {diagnosticNotes.length > 0 && (
        <Card className="bg-black/30 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-xs font-mono text-primary mb-2">DIAGNOSTIC RESULTS:</p>
            {diagnosticNotes.map((n, i) => (
              <p key={i} className="text-xs font-mono text-muted-foreground">{n}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Repair Actions */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="font-medium">🔧 Select Repairs:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REPAIR_ACTIONS.map(action => {
              const isSelected = selectedRepairs.includes(action.id);
              return (
                <Button
                  key={action.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRepair(action.id)}
                  className="h-auto py-2 flex flex-col text-xs text-left"
                >
                  <span>{action.name}</span>
                  <span className="opacity-70">${action.cost} · {action.time}min · {action.tool}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">💰 Charge Customer</span>
            <Badge variant="outline">${chargePrice}</Badge>
          </div>
          <Slider value={[chargePrice]} onValueChange={([v]) => setChargePrice(v)} min={30} max={300} step={10} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Parts cost: ${selectedRepairs.reduce((s, r) => s + (REPAIR_ACTIONS.find(a => a.id === r)?.cost ?? 0), 0)}</span>
            <span>Customer budget: ${currentCase.customerBudget}</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={submitRepair} className="w-full" size="lg" disabled={selectedRepairs.length === 0}>
        🔧 Submit Repair — Case {caseIndex + 1}
      </Button>
    </div>
  );
}
