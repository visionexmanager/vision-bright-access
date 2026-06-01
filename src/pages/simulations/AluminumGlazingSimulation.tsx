import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useScreenReader } from "@/hooks/useScreenReader";
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
import { RotateCcw, Trophy, ArrowLeft } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";
import { SimulationScene } from "@/components/SimulationScene";

interface Props { simulationId?: string; }

const GLASS_TYPE_IDS = [
  { id: "single", key: "sim.glazing.glass.single", cost: 20, insulation: 1, strength: 1 },
  { id: "double", key: "sim.glazing.glass.double", cost: 45, insulation: 3, strength: 2 },
  { id: "triple", key: "sim.glazing.glass.triple", cost: 75, insulation: 5, strength: 3 },
  { id: "laminated", key: "sim.glazing.glass.laminated", cost: 60, insulation: 2, strength: 5 },
  { id: "smart", key: "sim.glazing.glass.smart", cost: 120, insulation: 4, strength: 3 },
];

const FRAME_TYPE_IDS = [
  { id: "standard", key: "sim.glazing.frame.standard", cost: 15, durability: 2 },
  { id: "thermal", key: "sim.glazing.frame.thermal", cost: 35, durability: 4 },
  { id: "heavy", key: "sim.glazing.frame.heavy", cost: 50, durability: 5 },
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

const ORDER_TYPE_IDS = ["sim.glazing.orderType.window", "sim.glazing.orderType.door", "sim.glazing.orderType.curtainWall", "sim.glazing.orderType.skylight", "sim.glazing.orderType.storefront"];
const ORDER_TYPE_NAMES = ["Window", "Door", "Curtain Wall", "Skylight", "Storefront"];

function randomOrder(id: number): Order {
  const types = ORDER_TYPE_NAMES;
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
  const { announce, announceUrgent } = useScreenReader();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [orders, setOrders] = useState<Order[]>(() => Array.from({ length: 3 }, (_, i) => randomOrder(i)));
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const GLASS_TYPES = GLASS_TYPE_IDS.map((g) => ({ ...g, name: t(g.key) }));
  const FRAME_TYPES = FRAME_TYPE_IDS.map((f) => ({ ...f, name: t(f.key) }));

  // Design choices
  const [glassType, setGlassType] = useState(GLASS_TYPE_IDS[1]);
  const [frameType, setFrameType] = useState(FRAME_TYPE_IDS[0]);
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

  // Unmount guard: clear any in-flight fabrication interval if the user navigates away.
  const fabricationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (fabricationIntervalRef.current) clearInterval(fabricationIntervalRef.current); }, []);

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
      toast.error(t("sim.glazing.error.quoteTooHigh"));
      setSatisfaction((s) => Math.max(0, s - 10));
      setCurrentOrder(null);
      return;
    }
    setFabricating(true);
    setFabProgress(0);
    playSound("scan");

    const stages = [t("sim.glazing.stage.cutting"), t("sim.glazing.stage.fittingGlass"), t("sim.glazing.stage.applySealant"), t("sim.glazing.stage.assembly"), t("sim.glazing.stage.qualityCheck")];
    let step = 0;
    const total = 25;
    fabricationIntervalRef.current = setInterval(() => {
      step++;
      setFabProgress(Math.round((step / total) * 100));
      setFabStage(stages[Math.min(Math.floor((step / total) * stages.length), stages.length - 1)]);
      if (step >= total) {
        clearInterval(fabricationIntervalRef.current!);
        fabricationIntervalRef.current = null;
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
    announce("Simulation complete!");
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
          <h2 className="text-2xl font-bold">{t("sim.glazing.report.title")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${revenue}</p><p className="text-xs text-muted-foreground">{t("sim.glazing.report.revenue")}</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${costs}</p><p className="text-xs text-muted-foreground">{t("sim.glazing.report.costs")}</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{satisfaction}%</p><p className="text-xs text-muted-foreground">{t("sim.glazing.report.satisfaction")}</p></div>
            <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">{t("sim.glazing.report.score")}</p></div>
          </div>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm p-1 bg-muted/30 rounded">
              <span>#{i + 1} {h.order}</span>
              <span className={h.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{h.quality}% | ${h.profit}</span>
            </div>
          ))}
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.glazing.report.playAgain")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SimulationScene slug="aluminum-glazing" isActive={round > 0} isComplete={finished} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🏗️ Round {round}/{totalRounds}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary" role="status" aria-live="polite">${revenue - costs} profit</Badge>
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
            <h3 className="font-bold text-sm">{t("sim.glazing.availableOrders")}</h3>
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => selectOrder(o)}>
                <div>
                  <p className="font-medium text-sm">{o.type} ({o.quantity}x)</p>
                  <p className="text-xs text-muted-foreground">{o.width}x{o.height}cm | Budget: ${o.budget} | {o.deadline} days</p>
                </div>
                <Button size="sm" variant="outline" aria-label={`Select ${o.type} order`}>{t("sim.glazing.selectOrder")}</Button>
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
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.glazing.glassType")}</label>
              <Select value={glassType.id} onValueChange={(v) => setGlassType(GLASS_TYPE_IDS.find((g) => g.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GLASS_TYPES.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} (${g.cost}) ❄️{g.insulation} 💪{g.strength}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.glazing.frameType")}</label>
              <Select value={frameType.id} onValueChange={(v) => setFrameType(FRAME_TYPE_IDS.find((f) => f.id === v)!)}>
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
              <div className="flex justify-between"><span>{t("sim.glazing.costBreakdown.unitCost")}:</span><span>${unitCost}</span></div>
              <div className="flex justify-between"><span>{t("sim.glazing.costBreakdown.totalCost")} ({currentOrder.quantity}x):</span><span>${unitCost * currentOrder.quantity}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1">
                <span>{t("sim.glazing.costBreakdown.yourQuote")}:</span>
                <span className={quotePrice > currentOrder.budget * 1.5 ? "text-red-500" : "text-green-500"}>${quotePrice}</span>
              </div>
              <div className="flex justify-between"><span>{t("sim.glazing.costBreakdown.customerBudget")}:</span><span>${currentOrder.budget}</span></div>
            </div>

            <Button onClick={startFabrication} className="w-full" aria-label="Start Fabrication">{t("sim.glazing.btn.startFabrication")}</Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">{t("sim.glazing.history.title")}</h3>
            {history.map((h, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>#{i + 1} {h.order}</span>
                <span className={h.profit > 0 ? "text-green-500" : "text-red-500"}>Q:{h.quality}% | ${h.profit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <SimulationMentor simulationTitle="Aluminum Glazing" currentStepTitle="" />
    </div>
  );
}
