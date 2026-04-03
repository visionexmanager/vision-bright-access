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
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Trophy } from "lucide-react";

interface Props { simulationId?: string; }

const WOOD_TYPES = [
  { id: "pine", name: "🌲 Pine", cost: 8, hardness: 2, beauty: 2 },
  { id: "oak", name: "🌳 Oak", cost: 18, hardness: 4, beauty: 4 },
  { id: "walnut", name: "🟤 Walnut", cost: 30, hardness: 3, beauty: 5 },
  { id: "maple", name: "🍁 Maple", cost: 22, hardness: 5, beauty: 3 },
  { id: "cherry", name: "🍒 Cherry", cost: 25, hardness: 3, beauty: 5 },
];

const PROJECTS = [
  { id: "shelf", name: "📚 Bookshelf", complexity: 2, basePrice: 120, woodNeeded: 8 },
  { id: "table", name: "🪑 Dining Table", complexity: 4, basePrice: 350, woodNeeded: 15 },
  { id: "cabinet", name: "🗄️ Cabinet", complexity: 3, basePrice: 250, woodNeeded: 12 },
  { id: "desk", name: "💻 Office Desk", complexity: 3, basePrice: 280, woodNeeded: 10 },
  { id: "bed", name: "🛏️ Bed Frame", complexity: 5, basePrice: 450, woodNeeded: 20 },
];

const FINISHES = [
  { id: "raw", name: "Raw (no finish)", cost: 0, quality: 0 },
  { id: "oil", name: "🫙 Oil Finish", cost: 5, quality: 2 },
  { id: "lacquer", name: "✨ Lacquer", cost: 12, quality: 4 },
  { id: "epoxy", name: "🎨 Epoxy Resin", cost: 25, quality: 5 },
];

export function WoodworkingSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  // Choices
  const [wood, setWood] = useState(WOOD_TYPES[0]);
  const [project, setProject] = useState(PROJECTS[0]);
  const [finish, setFinish] = useState(FINISHES[1]);
  const [sandGrit, setSandGrit] = useState(120);
  const [joineryType, setJoineryType] = useState<"screws" | "dowels" | "dovetail" | "mortise">("screws");
  const [dryingTime, setDryingTime] = useState(24);

  // Game state
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(5);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [crafting, setCrafting] = useState(false);
  const [craftProgress, setCraftProgress] = useState(0);
  const [craftStage, setCraftStage] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ project: string; quality: number; profit: number }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: round,
      score: sc, completed: done, decisions: { revenue, costs, results } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, round, revenue, costs, results]);

  const materialCost = wood.cost * project.woodNeeded + finish.cost;
  const joineryBonus = joineryType === "dovetail" ? 15 : joineryType === "mortise" ? 20 : joineryType === "dowels" ? 5 : 0;

  const calculateQuality = () => {
    let q = 50;
    q += wood.beauty * 3;
    q += finish.quality * 4;
    q += joineryBonus / 2;
    if (sandGrit >= 180) q += 10;
    else if (sandGrit >= 120) q += 5;
    else q -= 10;
    if (dryingTime >= 24) q += 5;
    else if (dryingTime < 12) q -= 15;
    q -= (project.complexity - 3) * 3;
    return Math.max(0, Math.min(100, Math.round(q)));
  };

  const startCrafting = () => {
    if (crafting) return;
    setCrafting(true);
    setCraftProgress(0);
    playSound("scan");

    const stages = ["🪚 Cutting lumber...", "📐 Measuring & marking...", `🔩 ${joineryType} joinery...`, `✨ Sanding (${sandGrit} grit)...`, `🎨 Applying ${finish.name}...`, "⏳ Drying...", "✅ Final inspection..."];
    let step = 0;
    const total = 28;
    const interval = setInterval(() => {
      step++;
      setCraftProgress(Math.round((step / total) * 100));
      setCraftStage(stages[Math.min(Math.floor((step / total) * stages.length), stages.length - 1)]);
      if (step >= total) {
        clearInterval(interval);
        const quality = calculateQuality();
        const sellPrice = Math.round(project.basePrice * (quality / 70) * (1 + wood.beauty * 0.05));
        const profit = sellPrice - materialCost;

        setRevenue((r) => r + sellPrice);
        setCosts((c) => c + materialCost);
        setResults((h) => [...h, { project: project.name, quality, profit }]);

        setCrafting(false);
        playSound("ding");
        toast.success(`🪵 ${project.name} complete! Quality: ${quality}% | Sold: $${sellPrice}`);

        if (round >= totalRounds) finishGame();
        else setRound((r) => r + 1);
      }
    }, 140);
  };

  const finishGame = () => {
    const avgQ = results.length > 0 ? Math.round(results.reduce((a, r) => a + r.quality, 0) / results.length) : 0;
    const finalScore = Math.max(0, Math.round((revenue - costs) / 5) + avgQ);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setRound(1); setRevenue(0); setCosts(0); setCrafting(false);
    setFinished(false); setScore(0); setResults([]);
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">🪵 Workshop Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">${revenue - costs}</p><p className="text-xs text-muted-foreground">Profit</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          {results.map((r, i) => (
            <div key={i} className="flex justify-between text-sm p-1 bg-muted/30 rounded">
              <span>#{i + 1} {r.project}</span>
              <span className={r.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{r.quality}% | ${r.profit}</span>
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
        <h2 className="text-lg font-bold">🪵 Project {round}/{totalRounds}</h2>
        <Badge variant="secondary">${revenue - costs} profit</Badge>
      </div>
      <Progress value={(round / totalRounds) * 100} className="h-2" />

      {crafting && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold animate-pulse">{craftStage}</p>
            <Progress value={craftProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!crafting && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🛠️ Workshop Controls</h3>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project</label>
              <Select value={project.id} onValueChange={(v) => setProject(PROJECTS.find((p) => p.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (base ${p.basePrice}) ⚙️{p.complexity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Wood Type</label>
              <Select value={wood.id} onValueChange={(v) => setWood(WOOD_TYPES.find((w) => w.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WOOD_TYPES.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} (${w.cost}/unit) 💪{w.hardness} ✨{w.beauty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Joinery Method</label>
              <Select value={joineryType} onValueChange={(v: any) => setJoineryType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="screws">🔩 Screws (fast, basic)</SelectItem>
                  <SelectItem value="dowels">🪵 Dowels (+5 quality)</SelectItem>
                  <SelectItem value="dovetail">🔲 Dovetail (+15 quality)</SelectItem>
                  <SelectItem value="mortise">🏗️ Mortise & Tenon (+20 quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sand Grit: {sandGrit} (180+ best)</label>
              <Slider value={[sandGrit]} onValueChange={([v]) => setSandGrit(v)} min={60} max={400} step={20} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Finish</label>
              <Select value={finish.id} onValueChange={(v) => setFinish(FINISHES.find((f) => f.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINISHES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} (${f.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Drying Time: {dryingTime}h (24h+ ideal)</label>
              <Slider value={[dryingTime]} onValueChange={([v]) => setDryingTime(v)} min={4} max={48} step={2} />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Wood ({project.woodNeeded} units):</span><span>${wood.cost * project.woodNeeded}</span></div>
              <div className="flex justify-between"><span>Finish:</span><span>${finish.cost}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total Cost:</span><span>${materialCost}</span></div>
              <div className="flex justify-between text-green-500"><span>Est. Sale (at 100% quality):</span><span>${project.basePrice}</span></div>
            </div>

            <Button onClick={startCrafting} className="w-full">🪚 Start Crafting</Button>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Completed Projects</h3>
            {results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>#{i + 1} {r.project}</span>
                <span className={r.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{r.quality}% | ${r.profit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
