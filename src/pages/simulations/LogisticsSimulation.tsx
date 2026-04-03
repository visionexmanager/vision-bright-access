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
import { RotateCcw, Trophy, Package, Ship, Plane, Truck } from "lucide-react";

interface Props { simulationId?: string; }

interface Shipment {
  id: number;
  cargo: string;
  weight: number;
  destination: string;
  deadline: number;
  value: number;
  fragile: boolean;
}

const DESTINATIONS = [
  { id: "local", name: "🏙️ Local (50km)", distance: 50, baseCost: 30 },
  { id: "domestic", name: "🗺️ Domestic (500km)", distance: 500, baseCost: 150 },
  { id: "continental", name: "🌍 Continental (2000km)", distance: 2000, baseCost: 500 },
  { id: "overseas", name: "🌊 Overseas (8000km)", distance: 8000, baseCost: 1200 },
];

const TRANSPORT_MODES = [
  { id: "truck", name: "🚚 Truck", icon: <Truck className="h-4 w-4" />, speed: 1, cost: 1, maxWeight: 20, reliability: 0.9 },
  { id: "rail", name: "🚂 Rail", icon: <Package className="h-4 w-4" />, speed: 0.8, cost: 0.6, maxWeight: 100, reliability: 0.95 },
  { id: "sea", name: "🚢 Sea Freight", icon: <Ship className="h-4 w-4" />, speed: 0.3, cost: 0.3, maxWeight: 500, reliability: 0.85 },
  { id: "air", name: "✈️ Air Freight", icon: <Plane className="h-4 w-4" />, speed: 3, cost: 4, maxWeight: 10, reliability: 0.98 },
];

const CARGOS = ["Electronics", "Food & Perishables", "Machinery", "Textiles", "Furniture", "Chemicals"];

function randomShipment(id: number): Shipment {
  const dest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
  return {
    id,
    cargo: CARGOS[Math.floor(Math.random() * CARGOS.length)],
    weight: 0.5 + Math.round(Math.random() * 50 * 10) / 10,
    destination: dest.id,
    deadline: 2 + Math.floor(Math.random() * 10),
    value: 200 + Math.floor(Math.random() * 3000),
    fragile: Math.random() > 0.6,
  };
}

export function LogisticsSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  // Available shipments
  const [shipments, setShipments] = useState<Shipment[]>(() => Array.from({ length: 3 }, (_, i) => randomShipment(i)));
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(null);

  // Decisions
  const [transport, setTransport] = useState(TRANSPORT_MODES[0]);
  const [insurance, setInsurance] = useState(false);
  const [rushDelivery, setRushDelivery] = useState(false);
  const [warehouseDays, setWarehouseDays] = useState(0);

  // Game state
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(6);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [onTime, setOnTime] = useState(0);
  const [late, setLate] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [shipping, setShipping] = useState(false);
  const [shipProgress, setShipProgress] = useState(0);
  const [shipStage, setShipStage] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<{ cargo: string; dest: string; profit: number; status: string }[]>([]);

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

  const selectShipment = (s: Shipment) => {
    setCurrentShipment(s);
    setShipments((prev) => prev.filter((x) => x.id !== s.id));
    playSound("scan");
  };

  const dest = currentShipment ? DESTINATIONS.find((d) => d.id === currentShipment.destination)! : DESTINATIONS[0];
  const shippingCost = Math.round(dest.baseCost * transport.cost * (1 + currentShipment?.weight! * 0.02));
  const insuranceCost = insurance ? Math.round(currentShipment?.value! * 0.05) : 0;
  const rushCost = rushDelivery ? Math.round(shippingCost * 0.4) : 0;
  const warehouseCost = warehouseDays * 15;
  const totalCost = shippingCost + insuranceCost + rushCost + warehouseCost;
  const fee = Math.round(currentShipment?.value! * 0.15 + shippingCost * 0.3);

  const startShipping = () => {
    if (!currentShipment || shipping) return;
    if (currentShipment.weight > transport.maxWeight) {
      toast.error(`❌ ${transport.name} max weight: ${transport.maxWeight}T. Cargo is ${currentShipment.weight}T`);
      return;
    }
    setShipping(true);
    setShipProgress(0);
    playSound("scan");

    const stages = ["📦 Loading cargo...", "🔍 Customs clearance...", `${transport.name} in transit...`, "📍 Approaching destination...", "📋 Delivery confirmation..."];
    let step = 0;
    const total = 25;
    const interval = setInterval(() => {
      step++;
      setShipProgress(Math.round((step / total) * 100));
      setShipStage(stages[Math.min(Math.floor((step / total) * stages.length), stages.length - 1)]);
      if (step >= total) {
        clearInterval(interval);

        const deliveryDays = Math.round((dest.distance / (100 * transport.speed)) * (rushDelivery ? 0.6 : 1));
        const isOnTime = deliveryDays <= currentShipment.deadline;
        const isDamaged = !insurance && currentShipment.fragile && Math.random() > transport.reliability;

        let shipRevenue = fee;
        if (!isOnTime) shipRevenue = Math.round(fee * 0.6);
        if (isDamaged) shipRevenue = Math.round(shipRevenue * 0.3);

        const profit = shipRevenue - totalCost;
        setRevenue((r) => r + shipRevenue);
        setCosts((c) => c + totalCost);
        if (isOnTime) setOnTime((o) => o + 1); else setLate((l) => l + 1);
        if (isDamaged) setDamaged((d) => d + 1);

        const status = isDamaged ? "💥 Damaged" : isOnTime ? "✅ On Time" : "⏰ Late";
        setHistory((h) => [...h, { cargo: currentShipment.cargo, dest: dest.name, profit, status }]);

        setShipping(false);
        setCurrentShipment(null);
        playSound("ding");
        toast.success(`${status} | ${currentShipment.cargo} → ${dest.name} | ${profit > 0 ? "+" : ""}$${profit}`);

        if (round >= totalRounds) finishGame();
        else {
          setRound((r) => r + 1);
          setShipments((prev) => [...prev, randomShipment(round * 10 + Math.random() * 100)]);
        }
      }
    }, 150);
  };

  const finishGame = () => {
    const finalScore = Math.max(0, Math.round((revenue - costs) / 10) + onTime * 15 - late * 5 - damaged * 20);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setRound(1); setRevenue(0); setCosts(0); setOnTime(0); setLate(0); setDamaged(0);
    setShipping(false); setFinished(false); setScore(0); setHistory([]); setCurrentShipment(null);
    setShipments(Array.from({ length: 3 }, (_, i) => randomShipment(i)));
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">📦 Logistics Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{onTime}/{onTime + late}</p><p className="text-xs text-muted-foreground">On Time</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm p-1 bg-muted/30 rounded">
              <span>{h.cargo} → {h.dest}</span>
              <span>{h.status} | ${h.profit}</span>
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
        <h2 className="text-lg font-bold">📦 Shipment {round}/{totalRounds}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">${revenue - costs} profit</Badge>
          <Badge variant="outline">✅ {onTime} | ⏰ {late}</Badge>
        </div>
      </div>
      <Progress value={(round / totalRounds) * 100} className="h-2" />

      {shipping && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold animate-pulse">{shipStage}</p>
            <Progress value={shipProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!currentShipment && !shipping && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">📋 Available Shipments</h3>
            {shipments.map((s) => {
              const d = DESTINATIONS.find((x) => x.id === s.destination)!;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => selectShipment(s)}>
                  <div>
                    <p className="font-medium text-sm">{s.cargo} {s.fragile ? "⚠️" : ""}</p>
                    <p className="text-xs text-muted-foreground">{s.weight}T → {d.name} | {s.deadline} days | ${s.value}</p>
                  </div>
                  <Button size="sm" variant="outline">Accept</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {currentShipment && !shipping && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🚚 Plan: {currentShipment.cargo} ({currentShipment.weight}T)</h3>
            <p className="text-xs text-muted-foreground">→ {dest.name} | Deadline: {currentShipment.deadline} days | Value: ${currentShipment.value} {currentShipment.fragile ? "| ⚠️ Fragile" : ""}</p>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Transport Mode</label>
              <Select value={transport.id} onValueChange={(v) => setTransport(TRANSPORT_MODES.find((t) => t.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSPORT_MODES.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} (max {m.maxWeight}T, speed ×{m.speed})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentShipment.weight > transport.maxWeight && (
                <p className="text-xs text-destructive mt-1">⚠️ Overweight! Max: {transport.maxWeight}T</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant={insurance ? "default" : "outline"} size="sm" onClick={() => setInsurance(!insurance)} className="flex-1">
                🛡️ Insurance {insurance ? "✓" : ""} (${Math.round(currentShipment.value * 0.05)})
              </Button>
              <Button variant={rushDelivery ? "default" : "outline"} size="sm" onClick={() => setRushDelivery(!rushDelivery)} className="flex-1">
                ⚡ Rush {rushDelivery ? "✓" : ""} (+${Math.round(shippingCost * 0.4)})
              </Button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Warehouse Days: {warehouseDays} ($15/day)</label>
              <Slider value={[warehouseDays]} onValueChange={([v]) => setWarehouseDays(v)} min={0} max={5} step={1} />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Shipping:</span><span>${shippingCost}</span></div>
              {insuranceCost > 0 && <div className="flex justify-between"><span>Insurance:</span><span>${insuranceCost}</span></div>}
              {rushCost > 0 && <div className="flex justify-between"><span>Rush fee:</span><span>${rushCost}</span></div>}
              {warehouseCost > 0 && <div className="flex justify-between"><span>Warehouse:</span><span>${warehouseCost}</span></div>}
              <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total Cost:</span><span>${totalCost}</span></div>
              <div className="flex justify-between text-green-500"><span>Your Fee:</span><span>${fee}</span></div>
              <div className="flex justify-between font-bold"><span>Est. Profit:</span>
                <span className={fee - totalCost > 0 ? "text-green-500" : "text-red-500"}>${fee - totalCost}</span>
              </div>
            </div>

            <Button onClick={startShipping} className="w-full">🚀 Ship It!</Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Shipment History</h3>
            {history.map((h, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>{h.cargo} → {h.dest.split(" ")[1]}</span>
                <span>{h.status} | ${h.profit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
