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

const SHEEP_BREEDS = [
  { id: "awassi", name: "🐑 Awassi", woolQuality: 3, meatYield: 4, milkYield: 2, cost: 150 },
  { id: "merino", name: "🐏 Merino", woolQuality: 5, meatYield: 2, milkYield: 1, cost: 200 },
  { id: "suffolk", name: "🐑 Suffolk", woolQuality: 2, meatYield: 5, milkYield: 1, cost: 180 },
];

const GRAZING_OPTIONS = [
  { id: "natural", name: "🌿 Natural Pasture", cost: 0, nutrition: 2 },
  { id: "improved", name: "🌾 Improved Pasture", cost: 100, nutrition: 4 },
  { id: "supplement", name: "🌽 Supplemented", cost: 250, nutrition: 5 },
];

export function SheepFarmSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [breed, setBreed] = useState(SHEEP_BREEDS[0]);
  const [grazing, setGrazing] = useState(GRAZING_OPTIONS[0]);
  const [flockSize, setFlockSize] = useState(30);
  const [waterAccess, setWaterAccess] = useState(3);
  const [shearingFreq, setShearingFreq] = useState(2);
  const [vaccineBudget, setVaccineBudget] = useState(50);

  const [month, setMonth] = useState(1);
  const [totalMonths] = useState(6);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [alive, setAlive] = useState(30);
  const [woolHarvest, setWoolHarvest] = useState(0);
  const [health, setHealth] = useState(80);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<{ month: number; alive: number; wool: number; revenue: number }[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: month,
      score: sc, completed: done, decisions: { revenue, costs, alive, woolHarvest } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, month, revenue, costs, alive, woolHarvest]);

  const setupCost = breed.cost * flockSize + grazing.cost;

  const startFarm = () => {
    setStarted(true);
    setAlive(flockSize);
    setCosts(setupCost);
    setHealth(80);
    playSound("scan");
    toast.success(`🐑 Flock of ${flockSize} ${breed.name} started!`);
  };

  const simulateMonth = () => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);

    let step = 0;
    const total = 15;
    const interval = setInterval(() => {
      step++;
      setSimProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);

        const waterBonus = waterAccess >= 3 ? 5 : waterAccess >= 2 ? 0 : -10;
        const nutritionBonus = grazing.nutrition * 3;
        const vaccineBonus = vaccineBudget > 30 ? 5 : vaccineBudget > 10 ? 0 : -10;
        const newHealth = Math.max(20, Math.min(100, health + waterBonus + vaccineBonus + nutritionBonus / 2 - 5));
        
        const mortalityRate = newHealth > 80 ? 0.01 : newHealth > 50 ? 0.04 : 0.08;
        const deaths = Math.max(0, Math.round(alive * mortalityRate * (0.5 + Math.random())));
        const newAlive = alive - deaths;

        const isShearMonth = month % Math.max(1, Math.round(6 / shearingFreq)) === 0;
        const monthWool = isShearMonth ? Math.round(newAlive * breed.woolQuality * 0.5) : 0;
        const woolRevenue = monthWool * 8;

        const monthCost = Math.round(newAlive * (grazing.cost / (6 * flockSize) + 2) + vaccineBudget);

        setAlive(newAlive);
        setHealth(Math.round(newHealth));
        setWoolHarvest((w) => w + monthWool);
        setRevenue((r) => r + woolRevenue);
        setCosts((c) => c + monthCost);
        setLog((l) => [...l, { month, alive: newAlive, wool: monthWool, revenue: woolRevenue }]);

        setSimulating(false);
        playSound("ding");
        if (deaths > 0) toast.error(`💀 ${deaths} sheep lost`);
        if (monthWool > 0) toast.success(`🧶 Shearing! ${monthWool}kg wool harvested`);
        else toast.success(`✅ Month ${month} complete. Health: ${Math.round(newHealth)}%`);

        if (month >= totalMonths) sellAndFinish(newAlive);
        else setMonth((m) => m + 1);
      }
    }, 120);
  };

  const sellAndFinish = (finalAlive: number) => {
    const meatRevenue = Math.round(finalAlive * breed.meatYield * 10);
    const totalRev = revenue + meatRevenue;
    setRevenue(totalRev);
    const finalScore = Math.max(0, Math.round((totalRev - costs) / 10) + Math.round((finalAlive / flockSize) * 40) + health);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setMonth(1); setRevenue(0); setCosts(0); setAlive(30); setWoolHarvest(0); setHealth(80);
    setSimulating(false); setFinished(false); setScore(0); setLog([]); setStarted(false);
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">🐑 Farm Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{woolHarvest}kg</p><p className="text-xs text-muted-foreground">Wool</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🐑 {started ? `Month ${month}/${totalMonths}` : "Farm Setup"}</h2>
        {started && <Badge variant="secondary">🐑 {alive} | ❤️ {health}%</Badge>}
      </div>
      {started && <Progress value={(month / totalMonths) * 100} className="h-2" />}

      {!started && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🏗️ Sheep Farm Setup</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Breed</label>
              <Select value={breed.id} onValueChange={(v) => setBreed(SHEEP_BREEDS.find((b) => b.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHEEP_BREEDS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} 🧶{b.woolQuality} 🥩{b.meatYield} (${b.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Flock: {flockSize} sheep</label>
              <Slider value={[flockSize]} onValueChange={([v]) => setFlockSize(v)} min={10} max={100} step={5} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grazing</label>
              <Select value={grazing.id} onValueChange={(v) => setGrazing(GRAZING_OPTIONS.find((g) => g.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRAZING_OPTIONS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} {g.cost > 0 ? `($${g.cost})` : "(Free)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs">
              <div className="flex justify-between font-bold"><span>Setup Cost:</span><span>${setupCost}</span></div>
            </div>
            <Button onClick={startFarm} className="w-full">🐑 Start Farm</Button>
          </CardContent>
        </Card>
      )}

      {started && !simulating && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Alive</p><p className="font-bold">{alive}</p></div>
              <div><p className="text-xs text-muted-foreground">Wool</p><p className="font-bold">{woolHarvest}kg</p></div>
              <div><p className="text-xs text-muted-foreground">Health</p><p className="font-bold">{health}%</p></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Water Access: {waterAccess}/5</label>
              <Slider value={[waterAccess]} onValueChange={([v]) => setWaterAccess(v)} min={1} max={5} step={1} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Shearing: {shearingFreq}x/season</label>
              <Slider value={[shearingFreq]} onValueChange={([v]) => setShearingFreq(v)} min={1} max={4} step={1} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vaccine Budget: ${vaccineBudget}/month</label>
              <Slider value={[vaccineBudget]} onValueChange={([v]) => setVaccineBudget(v)} min={0} max={100} step={10} />
            </div>
            <Button onClick={simulateMonth} className="w-full">⏭️ Simulate Month {month}</Button>
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Monthly Log</h3>
            {log.map((l) => (
              <div key={l.month} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>Month {l.month}: {l.alive} sheep</span>
                <span>{l.wool > 0 ? `🧶${l.wool}kg ` : ""}${l.revenue > 0 ? `+$${l.revenue}` : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
