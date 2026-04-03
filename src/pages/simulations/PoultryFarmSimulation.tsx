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
import { RotateCcw, Trophy } from "lucide-react";

interface Props { simulationId?: string; }

const FLOCK_BREEDS = [
  { id: "broiler", name: "🐔 Broiler", growthRate: 5, cost: 2, meatYield: 2.5 },
  { id: "layer", name: "🥚 Layer Hen", growthRate: 3, cost: 3, eggYield: 280 },
  { id: "dual", name: "🐓 Dual Purpose", growthRate: 4, cost: 2.5, meatYield: 2, eggYield: 180 },
];

const FEED_TYPES = [
  { id: "basic", name: "🌾 Basic Feed", cost: 0.3, nutrition: 2, growth: 1 },
  { id: "premium", name: "🌽 Premium Mix", cost: 0.6, nutrition: 4, growth: 1.3 },
  { id: "organic", name: "🌿 Organic", cost: 1.0, nutrition: 5, growth: 1.2 },
];

const HOUSING_TYPES = [
  { id: "open", name: "🏕️ Open Range", capacity: 200, cost: 500, mortality: 0.08 },
  { id: "barn", name: "🏠 Barn Housing", capacity: 500, cost: 2000, mortality: 0.04 },
  { id: "climate", name: "❄️ Climate Controlled", capacity: 1000, cost: 5000, mortality: 0.02 },
];

export function PoultryFarmSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [breed, setBreed] = useState(FLOCK_BREEDS[0]);
  const [feed, setFeed] = useState(FEED_TYPES[0]);
  const [housing, setHousing] = useState(HOUSING_TYPES[0]);
  const [flockSize, setFlockSize] = useState(100);
  const [temperature, setTemperature] = useState(25);
  const [vaccination, setVaccination] = useState(false);
  const [sellPrice, setSellPrice] = useState(5);

  const [week, setWeek] = useState(1);
  const [totalWeeks] = useState(8);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [alive, setAlive] = useState(100);
  const [avgWeight, setAvgWeight] = useState(0.2);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [weeklyLog, setWeeklyLog] = useState<{ week: number; alive: number; weight: number; cost: number }[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: week,
      score: sc, completed: done, decisions: { revenue, costs, alive } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, week, revenue, costs, alive]);

  const setupCost = breed.cost * flockSize + housing.cost + (vaccination ? flockSize * 0.5 : 0);

  const startFarm = () => {
    setStarted(true);
    setAlive(flockSize);
    setCosts(setupCost);
    playSound("scan");
    toast.success(`🐔 Farm started! ${flockSize} ${breed.name} chicks`);
  };

  const simulateWeek = () => {
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

        const tempStress = Math.abs(temperature - 25) > 8 ? 0.05 : Math.abs(temperature - 25) > 4 ? 0.02 : 0;
        const mortalityRate = housing.mortality + tempStress - (vaccination ? 0.02 : 0);
        const deaths = Math.max(0, Math.round(alive * mortalityRate * Math.random() * 2));
        const newAlive = alive - deaths;

        const weightGain = breed.growthRate * 0.1 * feed.growth * (1 - tempStress);
        const newWeight = Math.round((avgWeight + weightGain) * 100) / 100;

        const weekFeedCost = Math.round(newAlive * feed.cost * 7);

        setAlive(newAlive);
        setAvgWeight(newWeight);
        setCosts((c) => c + weekFeedCost);
        setWeeklyLog((l) => [...l, { week, alive: newAlive, weight: newWeight, cost: weekFeedCost }]);

        setSimulating(false);
        playSound("ding");
        if (deaths > 0) toast.error(`💀 ${deaths} birds lost this week`);
        else toast.success(`✅ Week ${week}: All birds healthy! Weight: ${newWeight}kg`);

        if (week >= totalWeeks) harvestAndSell();
        else setWeek((w) => w + 1);
      }
    }, 120);
  };

  const harvestAndSell = () => {
    const totalMeat = Math.round(alive * avgWeight * (breed.meatYield ?? 1));
    const saleRevenue = Math.round(totalMeat * sellPrice);
    setRevenue(saleRevenue);
    const finalScore = Math.max(0, Math.round((saleRevenue - costs) / 10) + Math.round((alive / flockSize) * 50));
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
    toast.success(`🎉 Harvest! ${totalMeat}kg meat sold for $${saleRevenue}`);
  };

  const restart = () => {
    setWeek(1); setRevenue(0); setCosts(0); setAlive(100); setAvgWeight(0.2);
    setSimulating(false); setFinished(false); setScore(0); setWeeklyLog([]);
    setStarted(false); setFlockSize(100);
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">🐔 Farm Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{alive}/{flockSize}</p><p className="text-xs text-muted-foreground">Survived</p></div>
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
        <h2 className="text-lg font-bold">🐔 {started ? `Week ${week}/${totalWeeks}` : "Farm Setup"}</h2>
        {started && <Badge variant="secondary">🐔 {alive} alive | {avgWeight}kg avg</Badge>}
      </div>
      {started && <Progress value={(week / totalWeeks) * 100} className="h-2" />}

      {simulating && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold animate-pulse">🐔 Simulating week {week}...</p>
            <Progress value={simProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!started && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🏗️ Farm Setup</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Breed</label>
              <Select value={breed.id} onValueChange={(v) => setBreed(FLOCK_BREEDS.find((b) => b.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FLOCK_BREEDS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} (${b.cost}/chick)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Flock: {flockSize} birds</label>
              <Slider value={[flockSize]} onValueChange={([v]) => setFlockSize(v)} min={50} max={Math.min(500, housing.capacity)} step={25} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Housing</label>
              <Select value={housing.id} onValueChange={(v) => setHousing(HOUSING_TYPES.find((h) => h.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOUSING_TYPES.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name} (cap: {h.capacity}, ${h.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant={vaccination ? "default" : "outline"} onClick={() => setVaccination(!vaccination)} className="w-full">
              💉 Vaccination {vaccination ? "✓" : ""} (${(flockSize * 0.5).toFixed(0)})
            </Button>
            <div className="p-3 rounded-lg bg-muted/50 text-xs">
              <div className="flex justify-between font-bold"><span>Setup Cost:</span><span>${setupCost}</span></div>
            </div>
            <Button onClick={startFarm} className="w-full">🐔 Start Farm</Button>
          </CardContent>
        </Card>
      )}

      {started && !simulating && week <= totalWeeks && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Alive</p><p className="font-bold">{alive}</p></div>
              <div><p className="text-xs text-muted-foreground">Weight</p><p className="font-bold">{avgWeight}kg</p></div>
              <div><p className="text-xs text-muted-foreground">Costs</p><p className="font-bold text-red-500">${costs}</p></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Feed Type</label>
              <Select value={feed.id} onValueChange={(v) => setFeed(FEED_TYPES.find((f) => f.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEED_TYPES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} (${f.cost}/bird/day)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Barn Temp: {temperature}°C (25°C ideal)</label>
              <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={10} max={40} step={1} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Target Sell Price: ${sellPrice}/kg</label>
              <Slider value={[sellPrice]} onValueChange={([v]) => setSellPrice(v)} min={2} max={15} step={0.5} />
            </div>
            <Button onClick={simulateWeek} className="w-full">⏭️ Simulate Week {week}</Button>
          </CardContent>
        </Card>
      )}

      {weeklyLog.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Weekly Log</h3>
            {weeklyLog.map((l) => (
              <div key={l.week} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>Week {l.week}: {l.alive} birds, {l.weight}kg</span>
                <span className="text-red-500">-${l.cost}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
