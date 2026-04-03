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
import { RotateCcw, Trophy, Thermometer, Wind, Snowflake, Flame } from "lucide-react";

interface Props { simulationId?: string; }

const BUILDING_TYPES = [
  { id: "office", name: "🏢 Office Building", area: 500, occupants: 50, heatLoad: 80 },
  { id: "hospital", name: "🏥 Hospital", area: 2000, occupants: 200, heatLoad: 120 },
  { id: "mall", name: "🛒 Shopping Mall", area: 3000, occupants: 500, heatLoad: 100 },
  { id: "home", name: "🏠 Residential", area: 150, occupants: 5, heatLoad: 40 },
];

const SYSTEM_TYPES = [
  { id: "split", name: "Split AC", cooling: 3, heating: 2, cost: 800, efficiency: 3.5 },
  { id: "central", name: "Central HVAC", cooling: 5, heating: 4, cost: 5000, efficiency: 4.0 },
  { id: "vrf", name: "VRF System", cooling: 5, heating: 5, cost: 12000, efficiency: 5.5 },
  { id: "geothermal", name: "Geothermal", cooling: 4, heating: 5, cost: 20000, efficiency: 6.0 },
];

export function HvacSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [building, setBuilding] = useState(BUILDING_TYPES[0]);
  const [system, setSystem] = useState(SYSTEM_TYPES[0]);
  const [targetTemp, setTargetTemp] = useState(22);
  const [fanSpeed, setFanSpeed] = useState(3);
  const [zoneCount, setZoneCount] = useState(1);

  const [hour, setHour] = useState(8);
  const [currentTemp, setCurrentTemp] = useState(30);
  const [outdoorTemp, setOutdoorTemp] = useState(35);
  const [humidity, setHumidity] = useState(60);
  const [energyUsed, setEnergyUsed] = useState(0);
  const [comfortScore, setComfortScore] = useState(50);
  const [totalCost, setTotalCost] = useState(0);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [hourlyLog, setHourlyLog] = useState<{ hour: number; temp: number; comfort: number; energy: number }[]>([]);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId, current_step: hour,
      score: sc, completed: done, decisions: { energyUsed, comfortScore, totalCost } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, hour, energyUsed, comfortScore, totalCost]);

  const installCost = system.cost * zoneCount;
  const energyRate = 0.12;

  const installSystem = () => {
    setInstalled(true);
    setTotalCost(installCost);
    playSound("scan");
    toast.success(`❄️ ${system.name} installed in ${building.name}!`);
  };

  const simulateHour = () => {
    if (running) return;
    setRunning(true);
    setRunProgress(0);

    let step = 0;
    const total = 12;
    const interval = setInterval(() => {
      step++;
      setRunProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);

        const hourOutdoor = 20 + 15 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
        setOutdoorTemp(Math.round(hourOutdoor));

        const coolingPower = system.cooling * fanSpeed * 0.3 * zoneCount;
        const tempDiff = currentTemp - targetTemp;
        const newTemp = currentTemp + (hourOutdoor - currentTemp) * 0.1 - (tempDiff > 0 ? coolingPower * 0.5 : -coolingPower * 0.3);
        const clampedTemp = Math.round(Math.max(16, Math.min(40, newTemp)) * 10) / 10;

        const hourEnergy = Math.round(building.heatLoad * 0.1 * fanSpeed * (1 / system.efficiency) * zoneCount);
        const hourCost = Math.round(hourEnergy * energyRate * 100) / 100;

        const tempComfort = Math.max(0, 100 - Math.abs(clampedTemp - targetTemp) * 15);
        const humComfort = Math.max(0, 100 - Math.abs(humidity - 45) * 2);
        const hourComfort = Math.round((tempComfort * 0.7 + humComfort * 0.3));

        setCurrentTemp(clampedTemp);
        setHumidity(Math.max(30, Math.min(80, humidity + (Math.random() > 0.5 ? -2 : 2))));
        setEnergyUsed((e) => e + hourEnergy);
        setTotalCost((c) => c + hourCost);
        setComfortScore((prev) => Math.round((prev * (hour - 8) + hourComfort) / (hour - 7)));
        setHourlyLog((l) => [...l, { hour, temp: clampedTemp, comfort: hourComfort, energy: hourEnergy }]);

        setRunning(false);
        playSound("ding");
        toast.success(`🕐 ${hour}:00 - Temp: ${clampedTemp}°C | Comfort: ${hourComfort}%`);

        if (hour >= 20) finishGame();
        else setHour((h) => h + 1);
      }
    }, 120);
  };

  const finishGame = () => {
    const finalScore = Math.max(0, comfortScore + Math.round(100 - energyUsed / 50) - Math.round(totalCost));
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setHour(8); setCurrentTemp(30); setOutdoorTemp(35); setHumidity(60);
    setEnergyUsed(0); setComfortScore(50); setTotalCost(0); setRunning(false);
    setFinished(false); setScore(0); setHourlyLog([]); setInstalled(false);
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">❄️ HVAC Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3"><p className="text-2xl font-bold text-blue-500">{comfortScore}%</p><p className="text-xs text-muted-foreground">Avg Comfort</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{energyUsed} kWh</p><p className="text-xs text-muted-foreground">Energy Used</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${totalCost.toFixed(0)}</p><p className="text-xs text-muted-foreground">Total Cost</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {currentTemp > targetTemp ? <Flame className="h-5 w-5 text-red-500" /> : <Snowflake className="h-5 w-5 text-blue-500" />}
          {installed ? `${hour}:00` : "System Design"}
        </h2>
        {installed && <Badge variant="secondary"><Thermometer className="h-3 w-3" /> {currentTemp}°C</Badge>}
      </div>
      {installed && <Progress value={((hour - 8) / 12) * 100} className="h-2" />}

      {running && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Wind className="mx-auto h-8 w-8 text-blue-500 animate-spin" />
            <p className="font-semibold">Simulating {hour}:00...</p>
            <Progress value={runProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!installed && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🏗️ Design HVAC System</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Building</label>
              <Select value={building.id} onValueChange={(v) => setBuilding(BUILDING_TYPES.find((b) => b.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILDING_TYPES.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.area}m², {b.occupants} people)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">System Type</label>
              <Select value={system.id} onValueChange={(v) => setSystem(SYSTEM_TYPES.find((s) => s.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_TYPES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} (EER: {s.efficiency}, ${s.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zones: {zoneCount}</label>
              <Slider value={[zoneCount]} onValueChange={([v]) => setZoneCount(v)} min={1} max={6} step={1} />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs">
              <div className="flex justify-between font-bold"><span>Install Cost:</span><span>${installCost}</span></div>
            </div>
            <Button onClick={installSystem} className="w-full">❄️ Install System</Button>
          </CardContent>
        </Card>
      )}

      {installed && !running && hour <= 20 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Indoor</p><p className="font-bold">{currentTemp}°C</p></div>
              <div><p className="text-xs text-muted-foreground">Outdoor</p><p className="font-bold">{outdoorTemp}°C</p></div>
              <div><p className="text-xs text-muted-foreground">Humidity</p><p className="font-bold">{humidity}%</p></div>
              <div><p className="text-xs text-muted-foreground">Comfort</p><p className="font-bold">{comfortScore}%</p></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Target: {targetTemp}°C</label>
              <Slider value={[targetTemp]} onValueChange={([v]) => setTargetTemp(v)} min={18} max={28} step={0.5} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fan Speed: {fanSpeed}</label>
              <Slider value={[fanSpeed]} onValueChange={([v]) => setFanSpeed(v)} min={1} max={5} step={1} />
            </div>
            <Button onClick={simulateHour} className="w-full">⏭️ Next Hour ({hour}:00 → {hour + 1}:00)</Button>
          </CardContent>
        </Card>
      )}

      {hourlyLog.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Hourly Log</h3>
            <div className="max-h-32 overflow-y-auto">
              {hourlyLog.map((l) => (
                <div key={l.hour} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                  <span>{l.hour}:00</span>
                  <span>{l.temp}°C | 😊{l.comfort}% | ⚡{l.energy}kWh</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
