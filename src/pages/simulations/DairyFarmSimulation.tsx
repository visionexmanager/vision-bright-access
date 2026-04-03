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
import { CheckCircle2, Milk, Thermometer, RotateCcw, TrendingUp, DollarSign, Heart, Droplets } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";

type Stage = "setup" | "production" | "results";

type Props = { simulationId?: string };

export function DairyFarmSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("setup");
  const [day, setDay] = useState(1);
  const [score, setScore] = useState(0);

  // Setup decisions
  const [herdSize, setHerdSize] = useState(20);
  const [feedQuality, setFeedQuality] = useState<"economy" | "standard" | "premium">("standard");
  const [pasteurizationTemp, setPasteurizationTemp] = useState(72);
  const [coolingTarget, setCoolingTarget] = useState(4);
  const [productType, setProductType] = useState<"milk" | "yogurt" | "cheese">("milk");

  // Production metrics
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [milkQuality, setMilkQuality] = useState(80);
  const [cowHealth, setCowHealth] = useState(85);
  const [dailyYield, setDailyYield] = useState(0);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const feedCostMultiplier = feedQuality === "economy" ? 0.6 : feedQuality === "standard" ? 1.0 : 1.5;
  const feedQualityBonus = feedQuality === "economy" ? -15 : feedQuality === "standard" ? 0 : 20;

  const calcMetrics = useCallback(() => {
    // Pasteurization accuracy (72°C is ideal)
    const tempDiff = Math.abs(pasteurizationTemp - 72);
    const pastScore = tempDiff === 0 ? 100 : Math.max(0, 100 - tempDiff * 5);

    // Cooling efficiency (4°C is ideal)
    const coolDiff = Math.abs(coolingTarget - 4);
    const coolScore = coolDiff === 0 ? 100 : Math.max(0, 100 - coolDiff * 10);

    // Base yield per cow per day (liters)
    const baseYield = feedQuality === "economy" ? 18 : feedQuality === "standard" ? 25 : 32;
    const yield_ = Math.round(baseYield * herdSize * (pastScore / 100));

    // Quality
    const quality = Math.min(100, Math.round((pastScore * 0.4 + coolScore * 0.3 + feedQualityBonus + 50) * 0.8));

    // Health
    const health = Math.min(100, Math.round(70 + feedQualityBonus + (coolingTarget <= 6 ? 10 : -5)));

    // Revenue per liter depends on product type
    const pricePerLiter = productType === "milk" ? 1.2 : productType === "yogurt" ? 2.5 : 4.0;
    const conversionRate = productType === "milk" ? 1.0 : productType === "yogurt" ? 0.8 : 0.3;
    const dailyRevenue = Math.round(yield_ * conversionRate * pricePerLiter);

    // Costs
    const feedCost = Math.round(herdSize * 8 * feedCostMultiplier);
    const laborCost = Math.round(herdSize * 3);
    const processingCost = productType === "milk" ? 50 : productType === "yogurt" ? 120 : 200;
    const dailyCost = feedCost + laborCost + processingCost;

    return { yield_, quality, health, dailyRevenue, dailyCost };
  }, [herdSize, feedQuality, pasteurizationTemp, coolingTarget, productType, feedCostMultiplier, feedQualityBonus]);

  const startProduction = () => {
    playSound("correct");
    setStage("production");
    setDay(1);
    const m = calcMetrics();
    setDailyYield(m.yield_);
    setMilkQuality(m.quality);
    setCowHealth(m.health);
    setRevenue(m.dailyRevenue);
    setCosts(m.dailyCost);
    setEvents([`Day 1: Production started with ${herdSize} cows`]);
  };

  const advanceDay = () => {
    const newDay = day + 1;
    setDay(newDay);
    playSound("tick");

    const m = calcMetrics();
    // Random events
    const rand = Math.random();
    let eventMsg = "";
    let revenueBonus = 0;
    let costBonus = 0;

    if (rand < 0.15) {
      eventMsg = `Day ${newDay}: 🌡️ Heat wave — milk yield dropped 10%`;
      m.yield_ = Math.round(m.yield_ * 0.9);
      m.health = Math.max(40, m.health - 10);
    } else if (rand < 0.25) {
      eventMsg = `Day ${newDay}: 📈 Market demand surge — prices up 20%`;
      revenueBonus = Math.round(m.dailyRevenue * 0.2);
    } else if (rand < 0.35) {
      eventMsg = `Day ${newDay}: 🔧 Equipment maintenance needed`;
      costBonus = 80;
    } else if (rand < 0.45) {
      eventMsg = `Day ${newDay}: 🏆 Quality inspection passed — bonus $50`;
      revenueBonus = 50;
    } else {
      eventMsg = `Day ${newDay}: Normal operations`;
    }

    setDailyYield(m.yield_);
    setMilkQuality(m.quality);
    setCowHealth(m.health);
    setRevenue(prev => prev + m.dailyRevenue + revenueBonus);
    setCosts(prev => prev + m.dailyCost + costBonus);
    setEvents(prev => [eventMsg, ...prev.slice(0, 5)]);

    if (newDay >= 7) {
      finishSim(m);
    }
  };

  const finishSim = async (m?: ReturnType<typeof calcMetrics>) => {
    const metrics = m || calcMetrics();
    const profit = revenue - costs;
    const qualityBonus = milkQuality >= 80 ? 20 : 0;
    const healthBonus = cowHealth >= 80 ? 15 : 0;
    const profitBonus = profit > 0 ? Math.min(30, Math.round(profit / 50)) : 0;
    const finalScore = 20 + qualityBonus + healthBonus + profitBonus;

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");
    toast.success(`Dairy farm complete! Score: ${finalScore}`);

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 7,
        decisions: { herdSize, feedQuality, pasteurizationTemp, coolingTarget, productType } as any,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("setup");
    setDay(1);
    setScore(0);
    setHerdSize(20);
    setFeedQuality("standard");
    setPasteurizationTemp(72);
    setCoolingTarget(4);
    setProductType("milk");
    setRevenue(0);
    setCosts(0);
    setMilkQuality(80);
    setCowHealth(85);
    setDailyYield(0);
    setEvents([]);
  };

  const profit = revenue - costs;

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">Dairy Farm Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-4 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Revenue</p><p className="text-lg font-bold text-green-500">${revenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Profit</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title="📊 7-Day Financial Summary" data={[
          { label: "Revenue", value: revenue, color: "hsl(142 71% 45%)" },
          { label: "Costs", value: costs, color: "hsl(0 84% 60%)" },
          { label: "Profit", value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title="🐄 Farm Performance" data={[
          { metric: "Milk Quality", value: milkQuality },
          { metric: "Cow Health", value: cowHealth },
          { metric: "Yield", value: Math.min(100, Math.round(dailyYield / herdSize * 3)) },
          { metric: "Profitability", value: Math.min(100, Math.max(0, Math.round((profit / Math.max(1, revenue)) * 100))) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
      </div>
    );
  }

  if (stage === "production") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Milk className="h-6 w-6 text-primary" /> Day {day}/7
          </h2>
          <Badge variant="secondary">Score: {score}</Badge>
        </div>

        <Progress value={(day / 7) * 100} className="h-3" />

        {/* Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-green-500" />
              <p className="text-lg font-bold text-green-500">${revenue}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-destructive" />
              <p className="text-lg font-bold text-destructive">${costs}</p>
              <p className="text-xs text-muted-foreground">Costs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Droplets className="h-5 w-5 mx-auto text-blue-500" />
              <p className="text-lg font-bold">{dailyYield}L</p>
              <p className="text-xs text-muted-foreground">Daily Yield</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Heart className="h-5 w-5 mx-auto text-pink-500" />
              <p className="text-lg font-bold">{cowHealth}%</p>
              <p className="text-xs text-muted-foreground">Cow Health</p>
            </CardContent>
          </Card>
        </div>

        {/* Quality bar */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Milk Quality</span>
              <span className="font-bold">{milkQuality}%</span>
            </div>
            <Progress value={milkQuality} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>Profit</span>
              <span className={`font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</span>
            </div>
          </CardContent>
        </Card>

        {/* Event log */}
        <Card className="bg-card border-muted">
          <CardContent className="pt-4">
            <div className="text-sm space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
              {events.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button onClick={advanceDay} className="w-full text-base" size="lg" disabled={day >= 7}>
          {day < 7 ? `Advance to Day ${day + 1}` : "Finishing..."}
        </Button>
      </div>
    );
  }

  // Setup stage
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Milk className="h-6 w-6 text-primary" /> Dairy Farm Setup
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">Configure your dairy farm. Your decisions will affect milk yield, quality, costs, and profit over 7 days.</p>

      {/* Herd Size */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">🐄 Herd Size</span>
            <Badge variant="outline">{herdSize} cows</Badge>
          </div>
          <Slider value={[herdSize]} onValueChange={([v]) => setHerdSize(v)} min={10} max={50} step={5} />
          <p className="text-xs text-muted-foreground">More cows = more yield but higher feed & labor costs</p>
        </CardContent>
      </Card>

      {/* Feed Quality */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <span className="font-medium">🌾 Feed Quality</span>
          <Select value={feedQuality} onValueChange={(v: any) => setFeedQuality(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Economy — Low cost, lower yield</SelectItem>
              <SelectItem value="standard">Standard — Balanced</SelectItem>
              <SelectItem value="premium">Premium — High yield, high cost</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Pasteurization Temperature */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium flex items-center gap-1">
              <Thermometer className="h-4 w-4 text-destructive" /> Pasteurization Temp
            </span>
            <Badge variant={pasteurizationTemp === 72 ? "default" : "outline"}>{pasteurizationTemp}°C</Badge>
          </div>
          <Slider value={[pasteurizationTemp]} onValueChange={([v]) => setPasteurizationTemp(v)} min={60} max={90} step={1} />
          <p className="text-xs text-muted-foreground">72°C is ideal. Too low = bacteria risk. Too high = nutrient loss.</p>
        </CardContent>
      </Card>

      {/* Cooling Target */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">❄️ Cooling Target</span>
            <Badge variant={coolingTarget === 4 ? "default" : "outline"}>{coolingTarget}°C</Badge>
          </div>
          <Slider value={[coolingTarget]} onValueChange={([v]) => setCoolingTarget(v)} min={1} max={10} step={1} />
          <p className="text-xs text-muted-foreground">4°C is ideal for safe storage</p>
        </CardContent>
      </Card>

      {/* Product Type */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <span className="font-medium">🧀 Product Type</span>
          <Select value={productType} onValueChange={(v: any) => setProductType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="milk">Fresh Milk — $1.2/L, easy processing</SelectItem>
              <SelectItem value="yogurt">Yogurt — $2.5/L, medium processing</SelectItem>
              <SelectItem value="cheese">Cheese — $4.0/L, high processing cost</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Preview metrics */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">📊 Estimated Daily Metrics:</p>
          {(() => {
            const m = calcMetrics();
            return (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Yield: <strong>{m.yield_}L/day</strong></span>
                <span>Quality: <strong>{m.quality}%</strong></span>
                <span>Revenue: <strong className="text-green-500">${m.dailyRevenue}/day</strong></span>
                <span>Costs: <strong className="text-destructive">${m.dailyCost}/day</strong></span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Button onClick={startProduction} className="w-full text-base" size="lg">
        🚀 Start 7-Day Production
      </Button>
    </div>
  );
}
