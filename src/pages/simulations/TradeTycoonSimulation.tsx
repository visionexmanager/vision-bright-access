import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Trophy, TrendingUp, DollarSign } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";

interface Props { simulationId?: string; }

const MARKETS = [
  { id: "electronics", name: "📱 Electronics", volatility: 0.3, margin: 0.4, demand: 80 },
  { id: "clothing",    name: "👕 Clothing",    volatility: 0.15, margin: 0.6, demand: 70 },
  { id: "food",        name: "🥫 Food & Grocery", volatility: 0.05, margin: 0.25, demand: 95 },
  { id: "luxury",      name: "💎 Luxury Goods",   volatility: 0.5,  margin: 1.2, demand: 40 },
];

const ROUNDS = 6;

export function TradeTycoonSimulation({ simulationId }: Props) {
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [market, setMarket] = useState(MARKETS[0]);
  const [capital, setCapital] = useState(10000);
  const [buyQty, setBuyQty] = useState(20);
  const [sellPrice, setSellPrice] = useState(150);
  const [adBudget, setAdBudget] = useState(300);

  const [round, setRound] = useState(1);
  const [cash, setCash] = useState(10000);
  const [inventory, setInventory] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [reputation, setReputation] = useState(50);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<{ round: number; bought: number; sold: number; profit: number }[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: round, score: sc, completed: done,
      decisions: { cash, inventory, totalRevenue, totalCosts, reputation } as any,
    });
  }, [user, simulationId, round, cash, inventory, totalRevenue, totalCosts, reputation]);

  const startGame = () => {
    setCash(capital);
    setTotalCosts(0);
    setTotalRevenue(0);
    setInventory(0);
    setReputation(50);
    setLog([]);
    setRound(1);
    setStarted(true);
    playSound("scan");
    toast.success(`📈 Trading started in ${market.name}!`);
  };

  const buyQtyCost = buyQty * (sellPrice * (1 - market.margin));

  const simulateRound = () => {
    if (simulating) return;
    if (buyQtyCost > cash) {
      toast.error(`Not enough cash! Need $${Math.round(buyQtyCost)}`);
      return;
    }
    setSimulating(true);
    setSimProgress(0);

    let step = 0;
    const total = 15;
    const interval = setInterval(() => {
      step++;
      setSimProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);

        const priceSwing = 1 + (Math.random() - 0.5) * market.volatility * 2;
        const adEffect = adBudget / 100;
        const demandFactor = (market.demand / 100) * (0.7 + adEffect * 0.3) * priceSwing;
        const unitsSold = Math.round(Math.min(buyQty + inventory, buyQty * demandFactor));
        const costPerUnit = sellPrice * (1 - market.margin);
        const purchaseCost = buyQty * costPerUnit;
        const roundRevenue = unitsSold * sellPrice;
        const roundCosts = purchaseCost + adBudget;
        const roundProfit = roundRevenue - roundCosts;
        const newInventory = Math.max(0, buyQty + inventory - unitsSold);
        const newCash = cash - roundCosts + roundRevenue;
        const repChange = unitsSold > buyQty * 0.7 ? 5 : unitsSold < buyQty * 0.3 ? -8 : 0;
        const newRep = Math.max(0, Math.min(100, reputation + repChange));

        setCash(Math.round(newCash));
        setInventory(newInventory);
        setTotalRevenue((r) => r + roundRevenue);
        setTotalCosts((c) => c + roundCosts);
        setReputation(newRep);
        setLog((l) => [...l, { round, bought: buyQty, sold: unitsSold, profit: Math.round(roundProfit) }]);
        setSimulating(false);
        playSound("ding");

        if (roundProfit > 0)
          toast.success(`Round ${round} ✅ Sold ${unitsSold} units. Profit $${Math.round(roundProfit)}`);
        else
          toast.error(`Round ${round} ❌ Lost $${Math.abs(Math.round(roundProfit))}`);

        if (round >= ROUNDS) {
          const finalScore = Math.max(0, Math.round((newCash - capital) / 50 + newRep));
          setScore(finalScore);
          setFinished(true);
          playSound("complete");
          saveProgress(finalScore, true);
        } else {
          setRound((r) => r + 1);
        }
      }
    }, 100);
  };

  const restart = () => {
    setRound(1); setCash(capital); setInventory(0);
    setTotalRevenue(0); setTotalCosts(0); setReputation(50);
    setSimulating(false); setFinished(false); setScore(0); setLog([]); setStarted(false);
  };

  if (finished) {
    const netProfit = totalRevenue - totalCosts;
    return (
      <div className="max-w-lg mx-auto animate-in fade-in space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-2xl font-bold">📈 Trade Report</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
              <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">${totalCosts.toLocaleString()}</p><p className="text-xs text-muted-foreground">Costs</p></div>
              <div className={`rounded-xl p-3 ${netProfit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>${netProfit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Net Profit</p>
              </div>
              <div className="rounded-xl bg-yellow-500/10 p-3"><p className="text-2xl font-bold text-yellow-500">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
            </div>
            <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
          </CardContent>
        </Card>
        <SimulationMentor simulationTitle="Trade Tycoon" currentStepTitle="Results" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {started ? `Round ${round}/${ROUNDS}` : "Market Setup"}
        </h2>
        {started && (
          <div className="flex gap-2">
            <Badge variant="secondary">💰 ${cash.toLocaleString()}</Badge>
            <Badge variant="outline">📦 {inventory}</Badge>
          </div>
        )}
      </div>
      {started && <Progress value={((round - 1) / ROUNDS) * 100} className="h-2" />}

      {simulating && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <TrendingUp className="mx-auto h-8 w-8 text-primary animate-bounce" />
            <p className="font-semibold">Trading Round {round}…</p>
            <Progress value={simProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!started && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🏪 Market Selection</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Market</label>
              <Select value={market.id} onValueChange={(v) => setMarket(MARKETS.find((m) => m.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — Margin {Math.round(m.margin * 100)}% | Demand {m.demand}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Starting Capital: ${capital.toLocaleString()}</label>
              <Slider value={[capital]} onValueChange={([v]) => setCapital(v)} min={5000} max={50000} step={1000} />
            </div>
            <Button onClick={startGame} className="w-full">📈 Start Trading</Button>
          </CardContent>
        </Card>
      )}

      {started && !simulating && round <= ROUNDS && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Cash</p><p className="font-bold text-sm">${cash.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Inventory</p><p className="font-bold text-sm">{inventory} units</p></div>
              <div><p className="text-xs text-muted-foreground">Reputation</p><p className="font-bold text-sm">{reputation}%</p></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Buy Quantity: {buyQty} units (Cost: ${Math.round(buyQtyCost)})</label>
              <Slider value={[buyQty]} onValueChange={([v]) => setBuyQty(v)} min={5} max={200} step={5} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sell Price: ${sellPrice}/unit</label>
              <Slider value={[sellPrice]} onValueChange={([v]) => setSellPrice(v)} min={50} max={500} step={10} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ad Budget: ${adBudget}</label>
              <Slider value={[adBudget]} onValueChange={([v]) => setAdBudget(v)} min={0} max={2000} step={50} />
            </div>
            <Button onClick={simulateRound} className="w-full">⏭️ Execute Round {round}</Button>
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Trade Log</h3>
            {log.map((l) => (
              <div key={l.round} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>Round {l.round}: bought {l.bought} → sold {l.sold}</span>
                <span className={l.profit >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                  {l.profit >= 0 ? "+" : ""}${l.profit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {started && <SimulationMentor simulationTitle="Trade Tycoon" currentStepTitle={`Round ${round}`} />}
    </div>
  );
}
