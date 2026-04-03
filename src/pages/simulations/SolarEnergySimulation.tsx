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
import { RotateCcw, Trophy, Sun, Zap } from "lucide-react";

interface Props { simulationId?: string; }

const PANEL_TYPES = [
  { id: "mono", name: "Monocrystalline", efficiency: 22, cost: 300, durability: 25 },
  { id: "poly", name: "Polycrystalline", efficiency: 17, cost: 200, durability: 20 },
  { id: "thin", name: "Thin-Film", efficiency: 12, cost: 120, durability: 15 },
  { id: "bifacial", name: "Bifacial", efficiency: 25, cost: 450, durability: 30 },
];

const LOCATIONS = [
  { id: "roof", name: "🏠 Rooftop", sunHours: 5, installCost: 500 },
  { id: "ground", name: "🌿 Ground Mount", sunHours: 6, installCost: 800 },
  { id: "desert", name: "🏜️ Desert Farm", sunHours: 8, installCost: 2000 },
  { id: "floating", name: "🌊 Floating Solar", sunHours: 7, installCost: 3000 },
];

const BATTERY_OPTIONS = [
  { id: "none", name: "No Battery", capacity: 0, cost: 0 },
  { id: "small", name: "5kWh Battery", capacity: 5, cost: 2000 },
  { id: "medium", name: "13kWh Powerwall", capacity: 13, cost: 5000 },
  { id: "large", name: "30kWh Industrial", capacity: 30, cost: 10000 },
];

export function SolarEnergySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [panelType, setPanelType] = useState(PANEL_TYPES[0]);
  const [panelCount, setPanelCount] = useState(10);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [battery, setBattery] = useState(BATTERY_OPTIONS[0]);
  const [tiltAngle, setTiltAngle] = useState(30);
  const [gridSellPrice, setGridSellPrice] = useState(0.08);

  const [month, setMonth] = useState(1);
  const [totalMonths] = useState(12);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [monthlyData, setMonthlyData] = useState<{ month: number; energy: number; revenue: number }[]>([]);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: month,
      score: sc, completed: done, decisions: { totalRevenue, totalCost, totalEnergy } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, month, totalRevenue, totalCost, totalEnergy]);

  const installCost = panelType.cost * panelCount + location.installCost + battery.cost;
  const tiltBonus = Math.abs(tiltAngle - 30) <= 10 ? 1 : Math.abs(tiltAngle - 30) <= 20 ? 0.85 : 0.7;
  const dailyOutput = panelCount * (panelType.efficiency / 100) * location.sunHours * tiltBonus * 0.4;

  const installSystem = () => {
    setInstalled(true);
    setTotalCost(installCost);
    playSound("scan");
    toast.success(`☀️ System installed! ${panelCount} panels at ${location.name}`);
  };

  const simulateMonth = () => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);
    playSound("scan");

    const seasonFactor = [0.6, 0.7, 0.85, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 0.85, 0.7, 0.6][month - 1];
    let step = 0;
    const total = 15;
    const interval = setInterval(() => {
      step++;
      setSimProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);
        const monthEnergy = Math.round(dailyOutput * 30 * seasonFactor);
        const selfConsumed = Math.min(monthEnergy * 0.6, battery.capacity > 0 ? monthEnergy * 0.8 : monthEnergy * 0.4);
        const gridSold = monthEnergy - selfConsumed;
        const savedElectricity = selfConsumed * 0.15;
        const gridIncome = gridSold * gridSellPrice;
        const monthRevenue = Math.round(savedElectricity + gridIncome);
        const maintenance = Math.round(panelCount * 0.5);

        setTotalRevenue((r) => r + monthRevenue);
        setTotalCost((c) => c + maintenance);
        setTotalEnergy((e) => e + monthEnergy);
        setMonthlyData((d) => [...d, { month, energy: monthEnergy, revenue: monthRevenue }]);

        setSimulating(false);
        playSound("ding");
        toast.success(`📊 Month ${month}: ${monthEnergy} kWh generated | +$${monthRevenue}`);

        if (month >= totalMonths) finishGame();
        else setMonth((m) => m + 1);
      }
    }, 120);
  };

  const finishGame = () => {
    const roi = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / installCost) * 100) : 0;
    const finalScore = Math.max(0, Math.round(totalEnergy / 50) + roi + (totalRevenue > totalCost ? 50 : 0));
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setMonth(1); setTotalRevenue(0); setTotalCost(0); setTotalEnergy(0);
    setSimulating(false); setFinished(false); setScore(0); setMonthlyData([]);
    setInstalled(false);
  };

  if (finished) {
    const profit = totalRevenue - totalCost;
    const paybackYears = profit > 0 ? (installCost / (profit)).toFixed(1) : "N/A";
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">☀️ Solar Farm Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${totalRevenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${totalCost}</p><p className="text-xs text-muted-foreground">Total Cost</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{totalEnergy} kWh</p><p className="text-xs text-muted-foreground">Total Energy</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{paybackYears} yrs</p><p className="text-xs text-muted-foreground">Payback</p></div>
          </div>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><Sun className="h-5 w-5 text-yellow-500" /> {installed ? `Month ${month}/${totalMonths}` : "System Design"}</h2>
        {installed && <Badge variant="secondary"><Zap className="h-3 w-3" /> {totalEnergy} kWh</Badge>}
      </div>
      {installed && <Progress value={(month / totalMonths) * 100} className="h-2" />}

      {simulating && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Sun className="mx-auto h-8 w-8 text-yellow-500 animate-spin" />
            <p className="font-semibold">Simulating month {month}...</p>
            <Progress value={simProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!installed && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">☀️ Design Your Solar System</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Panel Type</label>
              <Select value={panelType.id} onValueChange={(v) => setPanelType(PANEL_TYPES.find((p) => p.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PANEL_TYPES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.efficiency}% eff, ${p.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Panels: {panelCount}</label>
              <Slider value={[panelCount]} onValueChange={([v]) => setPanelCount(v)} min={4} max={50} step={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Location</label>
              <Select value={location.id} onValueChange={(v) => setLocation(LOCATIONS.find((l) => l.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.sunHours}h sun, ${l.installCost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Battery Storage</label>
              <Select value={battery.id} onValueChange={(v) => setBattery(BATTERY_OPTIONS.find((b) => b.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BATTERY_OPTIONS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} {b.cost > 0 ? `($${b.cost})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tilt Angle: {tiltAngle}° (30° optimal)</label>
              <Slider value={[tiltAngle]} onValueChange={([v]) => setTiltAngle(v)} min={0} max={60} step={5} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grid Sell Price: ${gridSellPrice}/kWh</label>
              <Slider value={[gridSellPrice * 100]} onValueChange={([v]) => setGridSellPrice(v / 100)} min={3} max={20} step={1} />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Panels ({panelCount}x):</span><span>${panelType.cost * panelCount}</span></div>
              <div className="flex justify-between"><span>Installation:</span><span>${location.installCost}</span></div>
              {battery.cost > 0 && <div className="flex justify-between"><span>Battery:</span><span>${battery.cost}</span></div>}
              <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total Investment:</span><span>${installCost}</span></div>
              <div className="flex justify-between text-green-500"><span>Est. Daily Output:</span><span>{dailyOutput.toFixed(1)} kWh</span></div>
            </div>
            <Button onClick={installSystem} className="w-full">☀️ Install System</Button>
          </CardContent>
        </Card>
      )}

      {installed && !simulating && month <= totalMonths && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Revenue</p><p className="font-bold text-green-500">${totalRevenue}</p></div>
              <div><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold text-red-500">${totalCost}</p></div>
              <div><p className="text-xs text-muted-foreground">Energy</p><p className="font-bold">{totalEnergy} kWh</p></div>
            </div>
            <Button onClick={simulateMonth} className="w-full">⏭️ Simulate Month {month}</Button>
          </CardContent>
        </Card>
      )}

      {monthlyData.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Monthly Performance</h3>
            {monthlyData.map((d) => (
              <div key={d.month} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>Month {d.month}</span>
                <span>{d.energy} kWh | +${d.revenue}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
