import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Milk, Thermometer, RotateCcw, TrendingUp, DollarSign, Heart, Droplets, ArrowLeft } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { SimulationMentor } from "@/components/SimulationMentor";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";
import { SimulationScene } from "@/components/SimulationScene";

type Stage = "setup" | "production" | "results";

type Props = { simulationId?: string };

export function DairyFarmSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce } = useScreenReader();
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
  const [dailyLog, setDailyLog] = useState<{ day: number; yield_: number; rev: number; event: string }[]>([]);
  const [marketPrice, setMarketPrice] = useState(1.0); // daily price multiplier

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
    playSound("pour");
    announce("Correct! Well done.");
    setStage("production");
    setDay(1);
    const m = calcMetrics();
    const startEvent = t("sim.dairyfarm.event.started").replace("{count}", String(herdSize));
    setDailyYield(m.yield_);
    setMilkQuality(m.quality);
    setCowHealth(m.health);
    setRevenue(m.dailyRevenue);
    setCosts(m.dailyCost);
    setEvents([startEvent]);
    setDailyLog([{ day: 1, yield_: m.yield_, rev: m.dailyRevenue, event: startEvent }]);
    setMarketPrice(1.0);
  };

  const advanceDay = () => {
    const newDay = day + 1;
    setDay(newDay);
    playSound("tick");

    // Market price fluctuates ±15% each day
    const newPrice = Math.max(0.7, Math.min(1.4, marketPrice + (Math.random() - 0.48) * 0.15));
    setMarketPrice(newPrice);

    const m = calcMetrics();
    const adjustedRevenue = Math.round(m.dailyRevenue * newPrice);

    // Random events
    const rand = Math.random();
    let eventMsg = "";
    let revenueBonus = 0;
    let costBonus = 0;

    if (rand < 0.15) {
      eventMsg = t("sim.dairyfarm.event.heatWave").replace("{day}", String(newDay));
      m.yield_ = Math.round(m.yield_ * 0.9);
      m.health = Math.max(40, m.health - 10);
    } else if (rand < 0.25) {
      eventMsg = t("sim.dairyfarm.event.demandSurge").replace("{day}", String(newDay));
      revenueBonus = Math.round(adjustedRevenue * 0.2);
    } else if (rand < 0.35) {
      eventMsg = t("sim.dairyfarm.event.maintenance").replace("{day}", String(newDay));
      costBonus = 80;
    } else if (rand < 0.45) {
      eventMsg = t("sim.dairyfarm.event.inspection").replace("{day}", String(newDay));
      revenueBonus = 50;
    } else {
      eventMsg = t("sim.dairyfarm.event.normal").replace("{day}", String(newDay));
    }

    const dayRev = adjustedRevenue + revenueBonus;
    setDailyYield(m.yield_);
    setMilkQuality(m.quality);
    setCowHealth(m.health);
    setRevenue(prev => prev + dayRev);
    setCosts(prev => prev + m.dailyCost + costBonus);
    setEvents(prev => [eventMsg, ...prev.slice(0, 5)]);
    setDailyLog(prev => [...prev, { day: newDay, yield_: m.yield_, rev: dayRev, event: eventMsg }]);

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
    announce(`Simulation complete! Final score: ${finalScore}`);
    toast.success(`Dairy farm complete! Score: ${finalScore}`);

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 7,
        decisions: { herdSize, feedQuality, pasteurizationTemp, coolingTarget, productType } as Record<string, unknown>,
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
    setDailyLog([]);
    setMarketPrice(1.0);
  };

  const profit = revenue - costs;

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">{t("sim.dairyfarm.results.title")}</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-4 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.dairyfarm.metric.revenue")}</p><p className="text-lg font-bold text-green-500">${revenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.dairyfarm.metric.profit")}</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title={t("sim.dairyfarm.chart.financialSummary")} data={[
          { label: t("sim.dairyfarm.metric.revenue"), value: revenue, color: "hsl(142 71% 45%)" },
          { label: t("sim.dairyfarm.metric.costs"), value: costs, color: "hsl(0 84% 60%)" },
          { label: t("sim.dairyfarm.metric.profit"), value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title={t("sim.dairyfarm.chart.performance")} data={[
          { metric: t("sim.dairyfarm.metric.milkQuality"), value: milkQuality },
          { metric: t("sim.dairyfarm.metric.cowHealth"), value: cowHealth },
          { metric: t("sim.dairyfarm.metric.yield"), value: Math.min(100, Math.round(dailyYield / herdSize * 3)) },
          { metric: t("sim.dairyfarm.metric.profitability"), value: Math.min(100, Math.max(0, Math.round((profit / Math.max(1, revenue)) * 100))) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> {t("sim.dairyfarm.btn.playAgain")}</Button>
      </div>
    );
  }

  if (stage === "production") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Milk className="h-6 w-6 text-primary" /> {t("sim.dairyfarm.label.dayHeader").replace("{day}", String(day))}
          </h2>
          <Badge variant="secondary" role="status" aria-live="polite">{t("sim.noc.score")}: {score}</Badge>
        </div>

        <Progress value={(day / 7) * 100} className="h-3" />

        {/* Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-green-500" />
              <p className="text-lg font-bold text-green-500">${revenue}</p>
              <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.metric.revenue")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-destructive" />
              <p className="text-lg font-bold text-destructive">${costs}</p>
              <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.metric.costs")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Droplets className="h-5 w-5 mx-auto text-blue-500" />
              <p className="text-lg font-bold">{dailyYield}L</p>
              <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.card.dailyYield")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Heart className="h-5 w-5 mx-auto text-pink-500" />
              <p className="text-lg font-bold">{cowHealth}%</p>
              <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.card.cowHealth")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quality bar */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t("sim.dairyfarm.card.milkQuality")}</span>
              <span className="font-bold">{milkQuality}%</span>
            </div>
            <Progress value={milkQuality} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>{t("sim.dairyfarm.metric.profit")}</span>
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

        {/* Market Price Indicator */}
        <Card className={`border-l-4 ${marketPrice >= 1.1 ? "border-l-green-500" : marketPrice <= 0.9 ? "border-l-destructive" : "border-l-primary"}`}>
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium">{t("sim.dairyfarm.market") ?? "Market Price"}</span>
            <span className={`font-bold ${marketPrice >= 1.1 ? "text-green-500" : marketPrice <= 0.9 ? "text-destructive" : "text-primary"}`}>
              {(marketPrice * 100).toFixed(0)}% {marketPrice >= 1.1 ? "▲" : marketPrice <= 0.9 ? "▼" : "—"}
            </span>
          </CardContent>
        </Card>

        {/* Daily Log */}
        {dailyLog.length > 1 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-semibold mb-2">📊 {t("sim.dairyfarm.history.title") ?? "Daily Log"}</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...dailyLog].reverse().map(d => (
                  <div key={d.day} className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-1">
                    <span>Day {d.day}</span>
                    <span>{d.yield_}L</span>
                    <span className="text-green-600">+${d.rev}</span>
                    <span className="max-w-[120px] truncate">{d.event.replace(/Day \d+: /,'')}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={advanceDay} className="w-full text-base" size="lg" disabled={day >= 7}>
          {day < 7 ? t("sim.dairyfarm.btn.advanceDay").replace("{day}", String(day + 1)) : t("sim.dairyfarm.btn.finishing")}
        </Button>
      </div>
    );
  }

  // Setup stage
  return (
    <div className="space-y-6">
      <SimulationScene slug="dairy-farm" isActive={score > 0} isComplete={stage === "results"} />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Milk className="h-6 w-6 text-primary" /> {t("sim.dairyfarm.setupTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("sim.dairyfarm.setupDescription")}</p>

      {/* Herd Size */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">🐄 {t("sim.dairyfarm.label.herdSize")}</span>
            <Badge variant="outline">{herdSize} cows</Badge>
          </div>
          <Slider value={[herdSize]} onValueChange={([v]) => setHerdSize(v)} min={10} max={50} step={5} />
          <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.hint.herdSize")}</p>
        </CardContent>
      </Card>

      {/* Feed Quality */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <span className="font-medium">🌾 {t("sim.dairyfarm.label.feedQuality")}</span>
          <Select value={feedQuality} onValueChange={(v: any) => setFeedQuality(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">{t("sim.dairyfarm.feed.economy")}</SelectItem>
              <SelectItem value="standard">{t("sim.dairyfarm.feed.standard")}</SelectItem>
              <SelectItem value="premium">{t("sim.dairyfarm.feed.premium")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Pasteurization Temperature */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium flex items-center gap-1">
              <Thermometer className="h-4 w-4 text-destructive" /> {t("sim.dairyfarm.label.pasteurization")}
            </span>
            <Badge variant={pasteurizationTemp === 72 ? "default" : "outline"}>{pasteurizationTemp}°C</Badge>
          </div>
          <Slider value={[pasteurizationTemp]} onValueChange={([v]) => setPasteurizationTemp(v)} min={60} max={90} step={1} />
          <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.hint.pasteurization")}</p>
        </CardContent>
      </Card>

      {/* Cooling Target */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">❄️ {t("sim.dairyfarm.label.cooling")}</span>
            <Badge variant={coolingTarget === 4 ? "default" : "outline"}>{coolingTarget}°C</Badge>
          </div>
          <Slider value={[coolingTarget]} onValueChange={([v]) => setCoolingTarget(v)} min={1} max={10} step={1} />
          <p className="text-xs text-muted-foreground">{t("sim.dairyfarm.hint.cooling")}</p>
        </CardContent>
      </Card>

      {/* Product Type */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <span className="font-medium">🧀 {t("sim.dairyfarm.label.productType")}</span>
          <Select value={productType} onValueChange={(v: any) => setProductType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="milk">{t("sim.dairyfarm.product.freshMilk")}</SelectItem>
              <SelectItem value="yogurt">{t("sim.dairyfarm.product.yogurt")}</SelectItem>
              <SelectItem value="cheese">{t("sim.dairyfarm.product.cheese")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Preview metrics */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">📊 {t("sim.dairyfarm.section.estimatedMetrics")}</p>
          {(() => {
            const m = calcMetrics();
            return (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>{t("sim.dairyfarm.metric.yield")}: <strong>{m.yield_}L/day</strong></span>
                <span>{t("sim.dairyfarm.metric.milkQuality")}: <strong>{m.quality}%</strong></span>
                <span>{t("sim.dairyfarm.metric.revenue")}: <strong className="text-green-500">${m.dailyRevenue}/day</strong></span>
                <span>{t("sim.dairyfarm.metric.costs")}: <strong className="text-destructive">${m.dailyCost}/day</strong></span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

            <SimulationMentor simulationTitle={t("sim.dairyfarm.setupTitle")} currentStepTitle="" />

      <Button onClick={startProduction} className="w-full text-base" size="lg" aria-label="Start 7-Day Production">
        {t("sim.dairyfarm.btn.startProduction")}
      </Button>
    </div>
  );
}
