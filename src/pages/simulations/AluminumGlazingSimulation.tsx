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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RotateCcw, Trophy } from "lucide-react";

interface Props { simulationId?: string; }

const GLASS_TYPES = [
  { id: "single", name: "Single Pane", cost: 20, insulation: 1, strength: 1 },
  { id: "double", name: "Double Glazed", cost: 45, insulation: 3, strength: 2 },
  { id: "triple", name: "Triple Glazed", cost: 75, insulation: 5, strength: 3 },
  { id: "laminated", name: "Laminated Safety", cost: 60, insulation: 2, strength: 5 },
  { id: "smart", name: "Smart Glass", cost: 120, insulation: 4, strength: 3 },
];

const FRAME_TYPES = [
  { id: "standard", name: "Standard Aluminum", cost: 15, durability: 2 },
  { id: "thermal", name: "Thermal Break", cost: 35, durability: 4 },
  { id: "heavy", name: "Heavy Duty", cost: 50, durability: 5 },
];

interface Order {
  id: number;
  type: string;
  width: number;
  height: number;
  quantity: number;
  budget: number;
  deadline: number;
}

function randomOrder(id: number): Order {
  const types = ["Window", "Door", "Curtain Wall", "Skylight", "Storefront"];
  const type = types[Math.floor(Math.random() * types.length)];
  const w = 80 + Math.floor(Math.random() * 200);
  const h = 100 + Math.floor(Math.random() * 250);
  const qty = 1 + Math.floor(Math.random() * 10);
  return { id, type, width: w, height: h, quantity: qty, budget: qty * (50 + Math.floor(Math.random() * 150)), deadline: 2 + Math.floor(Math.random() * 3) };
}

export function AluminumGlazingSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [orders, setOrders] = useState<Order[]>(() => Array.from({ length: 3 }, (_, i) => randomOrder(i)));
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Design choices
  const [glassType, setGlassType] = useState(GLASS_TYPES[1]);
  const [frameType, setFrameType] = useState(FRAME_TYPES[0]);
  const [cutAngle, setCutAngle] = useState(45);
  const [sealantThickness, setSealantThickness] = useState(3);
  const [markup, setMarkup] = useState(30);

  // Game state
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(5);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [satisfaction, setSatisfaction] = useState(70);
  const [fabricating, setFabricating] = useState(false);
  const [fabProgress, setFabProgress] = useState(0);
  const [fabStage, setFabStage] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<{ order: string; profit: number; quality: number }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: round, score: sc, completed: done,
      decisions: { revenue, costs, history } as Record<string, unknown>,
    });
  }, [user, simulationId, round, revenue, costs, history]);

  const selectOrder = (order: Order) => {
    setCurrentOrder(order);
    setOrders((o) => o.filter((x) => x.id !== order.id));
    playSound("scan");
  };

  const unitCost = glassType.cost + frameType.cost + sealantThickness * 2;
  const quotePrice = currentOrder ? Math.round(unitCost * currentOrder.quantity * (1 + markup / 100)) : 0;

  const calculateQuality = () => {
    let q = 70;
    q += glassType.insulation * 3;
    q += frameType.durability * 2;
    if (cutAngle === 45 || cutAngle === 90) q += 10;
    if (sealantThickness >= 3 && sealantThickness <= 5) q += 5;
    else if (sealantThickness < 2) q -= 15;
    return Math.max(0, Math.min(100, q));
  };

  const startFabrication = () => {
    if (!currentOrder || fabricating) return;
    if (quotePrice > currentOrder.budget * 1.5) {
      toast.error("❌ Quote too high! Customer rejected.");
      setSatisfaction((s) => Math.max(0, s - 10));
      setCurrentOrder(null);
      return;
    }
    setFabricating(true);
    setFabProgress(0);
    playSound("scan");

    const stages = ["📐 Cutting aluminum...", "🪟 Fitting glass...", "🔧 Applying sealant...", "⚡ Assembly...", "✅ Quality check..."];
    let step = 0;
    const total = 25;
    const interval = setInterval(() => {
      step++;
      setFabProgress(Math.round((step / total) * 100));
      setFabStage(stages[Math.min(Math.floor((step / total) * stages.length), stages.length - 1)]);
      if (step >= total) {
        clearInterval(interval);
        const quality = calculateQuality();
        const totalCost = unitCost * currentOrder.quantity;
        const withinBudget = quotePrice <= currentOrder.budget;
        const satChange = withinBudget ? (quality > 80 ? 8 : quality > 60 ? 3 : -5) : -8;

        setRevenue((r) => r + quotePrice);
        setCosts((c) => c + totalCost);
        setSatisfaction((s) => Math.max(0, Math.min(100, s + satChange)));
        setHistory((h) => [...h, { order: currentOrder.type, profit: quotePrice - totalCost, quality }]);

        setFabricating(false);
        setCurrentOrder(null);
        playSound("ding");
        toast.success(`✅ ${currentOrder.type} complete! Quality: ${quality}%`);

        if (round >= totalRounds) {
          finishGame();
        } else {
          setRound((r) => r + 1);
          setOrders((prev) => [...prev, randomOrder(round * 10 + Math.random() * 100)]);
        }
      }
    }, 150);
  };

  const finishGame = () => {
    const finalScore = Math.max(0, Math.round((revenue - costs) / 8) + satisfaction + history.reduce((a, h) => a + h.quality, 0) / Math.max(1, history.length));
    setScore(Math.round(finalScore));
    setFinished(true);
    playSound("complete");
    saveProgress(Math.round(finalScore), true);
  };

  const restart = () => {
    setRound(1);
    setRevenue(0);
    setCosts(0);
    setSatisfaction(70);
    setFabricating(false);
    setFinished(false);
    setScore(0);
    setHistory([]);
    setCurrentOrder(null);
    setOrders(Array.from({ length: 3 }, (_, i) => randomOrder(i)));
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">🏗️ Workshop Report</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">Costs</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{satisfaction}%</p><p className="text-xs text-muted-foreground">Satisfaction</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm p-1 bg-muted/30 rounded">
              <span>#{i + 1} {h.order}</span>
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
        <h2 className="text-lg font-bold">🏗️ Round {round}/{totalRounds}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">${revenue - costs} profit</Badge>
          <Badge variant="outline">⭐ {satisfaction}%</Badge>
        </div>
      </div>
      <Progress value={(round / totalRounds) * 100} className="h-2" />

      {/* Fabrication */}
      {fabricating && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold animate-pulse">{fabStage}</p>
            <Progress value={fabProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Order Selection */}
      {!currentOrder && !fabricating && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">📋 Available Orders</h3>
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => selectOrder(o)}>
                <div>
                  <p className="font-medium text-sm">{o.type} ({o.quantity}x)</p>
                  <p className="text-xs text-muted-foreground">{o.width}x{o.height}cm | Budget: ${o.budget} | {o.deadline} days</p>
                </div>
                <Button size="sm" variant="outline">Select</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Design Controls */}
      {currentOrder && !fabricating && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🔧 Design: {currentOrder.type} ({currentOrder.quantity}x)</h3>
            <p className="text-xs text-muted-foreground">Size: {currentOrder.width}x{currentOrder.height}cm | Budget: ${currentOrder.budget}</p>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Glass Type</label>
              <Select value={glassType.id} onValueChange={(v) => setGlassType(GLASS_TYPES.find((g) => g.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GLASS_TYPES.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} (${g.cost}) ❄️{g.insulation} 💪{g.strength}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Frame Type</label>
              <Select value={frameType.id} onValueChange={(v) => setFrameType(FRAME_TYPES.find((f) => f.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRAME_TYPES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} (${f.cost})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cut Angle: {cutAngle}° (45° or 90° optimal)</label>
              <Slider value={[cutAngle]} onValueChange={([v]) => setCutAngle(v)} min={30} max={90} step={5} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sealant: {sealantThickness}mm (3-5mm ideal)</label>
              <Slider value={[sealantThickness]} onValueChange={([v]) => setSealantThickness(v)} min={1} max={8} step={0.5} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Markup: {markup}%</label>
              <Slider value={[markup]} onValueChange={([v]) => setMarkup(v)} min={0} max={100} step={5} />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Unit cost:</span><span>${unitCost}</span></div>
              <div className="flex justify-between"><span>Total cost ({currentOrder.quantity}x):</span><span>${unitCost * currentOrder.quantity}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1">
                <span>Your Quote:</span>
                <span className={quotePrice > currentOrder.budget * 1.5 ? "text-red-500" : "text-green-500"}>${quotePrice}</span>
              </div>
              <div className="flex justify-between"><span>Customer Budget:</span><span>${currentOrder.budget}</span></div>
            </div>

            <Button onClick={startFabrication} className="w-full">🔨 Start Fabrication</Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Order History</h3>
            {history.map((h, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>#{i + 1} {h.order}</span>
                <span className={h.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{h.quality}% | ${h.profit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
