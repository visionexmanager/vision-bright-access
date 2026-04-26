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
import { CheckCircle2, RotateCcw, DollarSign, Heart, Droplets, Thermometer, Leaf, TrendingUp } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";

type Stage = "setup" | "management" | "results";
type Season = "spring" | "summer" | "autumn" | "winter";

type Props = { simulationId?: string };

export function CattleDairySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("setup");
  const [score, setScore] = useState(0);

  // Setup
  const [herdSize, setHerdSize] = useState(30);
  const [breedType, setBreedType] = useState<"holstein" | "jersey" | "brown-swiss">("holstein");
  const [grazingAcres, setGrazingAcres] = useState(50);
  const [feedStrategy, setFeedStrategy] = useState<"pasture" | "mixed" | "grain">("mixed");
  const [vetBudget, setVetBudget] = useState(3);

  // Management
  const [season, setSeason] = useState<Season>("spring");
  const [week, setWeek] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [herdHealth, setHerdHealth] = useState(80);
  const [milkProduction, setMilkProduction] = useState(0);
  const [reproductionRate, setReproductionRate] = useState(70);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const breedYield = breedType === "holstein" ? 35 : breedType === "jersey" ? 22 : 28;
  const breedFat = breedType === "holstein" ? 3.5 : breedType === "jersey" ? 5.0 : 4.0;

  const seasonMultiplier = season === "spring" ? 1.1 : season === "summer" ? 0.85 : season === "autumn" ? 1.0 : 0.9;
  const feedCost = feedStrategy === "pasture" ? 5 : feedStrategy === "mixed" ? 8 : 12;

  const calcWeekMetrics = useCallback(() => {
    const dailyYield = Math.round(breedYield * herdSize * seasonMultiplier * (herdHealth / 100));
    const weeklyYield = dailyYield * 7;

    // Revenue: price per liter depends on fat content
    const pricePerLiter = 0.8 + breedFat * 0.15;
    const weeklyRevenue = Math.round(weeklyYield * pricePerLiter);

    // Costs
    const feedCosts = Math.round(herdSize * feedCost * 7);
    const laborCosts = Math.round(herdSize * 2 * 7);
    const vetCosts = Math.round(vetBudget * herdSize);
    const landCosts = Math.round(grazingAcres * 1.5);
    const weeklyCosts = feedCosts + laborCosts + vetCosts + landCosts;

    // Health effects
    const healthDelta = vetBudget >= 4 ? 2 : vetBudget >= 2 ? 0 : -3;
    const feedHealth = feedStrategy === "grain" ? -1 : feedStrategy === "mixed" ? 1 : 2;
    const crowding = herdSize > grazingAcres ? -3 : 0;

    return { dailyYield, weeklyYield, weeklyRevenue, weeklyCosts, healthDelta: healthDelta + feedHealth + crowding };
  }, [breedYield, breedFat, herdSize, seasonMultiplier, herdHealth, feedCost, feedStrategy, vetBudget, grazingAcres]);

  const startManagement = () => {
    playSound("correct");
    setStage("management");
    setSeason("spring");
    setWeek(1);
    const m = calcWeekMetrics();
    setMilkProduction(m.dailyYield);
    setEvents(["🌱 Spring — Season started. Your herd is ready!"]);
  };

  const advanceWeek = () => {
    const newWeek = week + 1;
    const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
    const newSeason = seasons[Math.floor((newWeek - 1) / 3) % 4];
    if (newSeason !== season) {
      toast(`Season changed to ${newSeason}!`);
    }

    setWeek(newWeek);
    setSeason(newSeason);
    playSound("tick");

    const m = calcWeekMetrics();

    // Random events
    const rand = Math.random();
    let eventMsg = "";
    let healthMod = 0;
    let costMod = 0;
    let revMod = 0;

    if (rand < 0.1) {
      eventMsg = `Week ${newWeek}: 🦠 Disease outbreak! -15% health`;
      healthMod = -15;
      costMod = herdSize * 5;
    } else if (rand < 0.2) {
      eventMsg = `Week ${newWeek}: 📈 Milk prices surged +20%`;
      revMod = Math.round(m.weeklyRevenue * 0.2);
    } else if (rand < 0.28) {
      eventMsg = `Week ${newWeek}: 🐄 New calf born! Herd +1`;
      setHerdSize(prev => prev + 1);
    } else if (rand < 0.35) {
      eventMsg = `Week ${newWeek}: 🌧️ Heavy rain — grazing limited`;
      healthMod = -3;
    } else {
      eventMsg = `Week ${newWeek}: Normal operations (${newSeason})`;
    }

    setHerdHealth(prev => Math.min(100, Math.max(20, prev + m.healthDelta + healthMod)));
    setMilkProduction(m.dailyYield);
    setTotalRevenue(prev => prev + m.weeklyRevenue + revMod);
    setTotalCosts(prev => prev + m.weeklyCosts + costMod);
    setEvents(prev => [eventMsg, ...prev.slice(0, 5)]);

    if (newWeek >= 12) finishSim();
  };

  const finishSim = async () => {
    const profit = totalRevenue - totalCosts;
    const healthBonus = herdHealth >= 80 ? 20 : herdHealth >= 60 ? 10 : 0;
    const profitBonus = profit > 0 ? Math.min(30, Math.round(profit / 100)) : 0;
    const productionBonus = milkProduction > herdSize * 25 ? 15 : 0;
    const finalScore = 15 + healthBonus + profitBonus + productionBonus;

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 12,
        decisions: { herdSize, breedType, grazingAcres, feedStrategy, vetBudget } as Record<string, unknown>,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("setup");
    setScore(0);
    setHerdSize(30);
    setBreedType("holstein");
    setGrazingAcres(50);
    setFeedStrategy("mixed");
    setVetBudget(3);
    setWeek(1);
    setSeason("spring");
    setTotalRevenue(0);
    setTotalCosts(0);
    setHerdHealth(80);
    setMilkProduction(0);
    setEvents([]);
  };

  const profit = totalRevenue - totalCosts;

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">Cattle Ranch — Season Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Revenue</p><p className="text-lg font-bold text-green-500">${totalRevenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Profit</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title="📊 12-Week Financial Summary" data={[
          { label: "Revenue", value: totalRevenue, color: "hsl(142 71% 45%)" },
          { label: "Costs", value: totalCosts, color: "hsl(0 84% 60%)" },
          { label: "Profit", value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title="🐄 Ranch Performance" data={[
          { metric: "Herd Health", value: herdHealth },
          { metric: "Production", value: Math.min(100, Math.round(milkProduction / 100)) },
          { metric: "Profitability", value: Math.min(100, Math.max(0, Math.round((profit / Math.max(1, totalRevenue)) * 100))) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
      </div>
    );
  }

  if (stage === "management") {
    const seasonEmoji = { spring: "🌱", summer: "☀️", autumn: "🍂", winter: "❄️" };
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">🐄 Week {week}/12 — {seasonEmoji[season]} {season}</h2>
          <Badge variant="secondary">Herd: {herdSize}</Badge>
        </div>
        <Progress value={(week / 12) * 100} className="h-3" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold text-green-500">${totalRevenue}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-destructive" />
            <p className="text-lg font-bold text-destructive">${totalCosts}</p>
            <p className="text-xs text-muted-foreground">Costs</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Droplets className="h-5 w-5 mx-auto text-blue-500" />
            <p className="text-lg font-bold">{milkProduction}L/day</p>
            <p className="text-xs text-muted-foreground">Production</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Heart className="h-5 w-5 mx-auto text-pink-500" />
            <p className="text-lg font-bold">{herdHealth}%</p>
            <p className="text-xs text-muted-foreground">Herd Health</p>
          </CardContent></Card>
        </div>

        <Card className="border-muted"><CardContent className="pt-4">
          <p className={`text-sm font-medium ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>Profit: ${profit}</p>
        </CardContent></Card>

        <Card className="bg-card border-muted"><CardContent className="pt-4">
          <div className="text-sm space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
            {events.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </CardContent></Card>

        <Button onClick={advanceWeek} className="w-full" size="lg" disabled={week >= 12}>
          {week < 12 ? `Advance to Week ${week + 1}` : "Finishing..."}
        </Button>
      </div>
    );
  }

  // Setup
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">🐄 Cattle Ranch Setup</h2>
      <p className="text-sm text-muted-foreground">Build your cattle ranch and manage it through 12 weeks (4 seasons). Balance breeding, feeding, health, and finances.</p>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🐄 Herd Size</span><Badge variant="outline">{herdSize} cattle</Badge></div>
        <Slider value={[herdSize]} onValueChange={([v]) => setHerdSize(v)} min={15} max={80} step={5} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🧬 Breed</span>
        <Select value={breedType} onValueChange={(v: any) => setBreedType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="holstein">Holstein — High yield (35L), 3.5% fat</SelectItem>
            <SelectItem value="jersey">Jersey — Low yield (22L), 5.0% fat (premium price)</SelectItem>
            <SelectItem value="brown-swiss">Brown Swiss — Medium (28L), 4.0% fat</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🌿 Grazing Acres</span><Badge variant="outline">{grazingAcres} acres</Badge></div>
        <Slider value={[grazingAcres]} onValueChange={([v]) => setGrazingAcres(v)} min={20} max={150} step={10} />
        <p className="text-xs text-muted-foreground">Too many cattle per acre reduces health</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🌾 Feed Strategy</span>
        <Select value={feedStrategy} onValueChange={(v: any) => setFeedStrategy(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pasture">Pasture Only — Low cost, +health</SelectItem>
            <SelectItem value="mixed">Mixed — Balanced</SelectItem>
            <SelectItem value="grain">Grain-fed — High cost, -health but higher yield</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🏥 Vet Budget (per head/week)</span><Badge variant="outline">${vetBudget}</Badge></div>
        <Slider value={[vetBudget]} onValueChange={([v]) => setVetBudget(v)} min={1} max={8} step={1} />
        <p className="text-xs text-muted-foreground">Higher budget improves health but increases costs</p>
      </CardContent></Card>

      <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
        <p className="text-sm font-medium mb-2">📊 Estimated Weekly:</p>
        {(() => {
          const m = calcWeekMetrics();
          return (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>Daily Yield: <strong>{m.dailyYield}L</strong></span>
              <span>Weekly Revenue: <strong className="text-green-500">${m.weeklyRevenue}</strong></span>
              <span>Weekly Costs: <strong className="text-destructive">${m.weeklyCosts}</strong></span>
              <span>Health Trend: <strong className={m.healthDelta >= 0 ? "text-green-500" : "text-destructive"}>{m.healthDelta >= 0 ? "+" : ""}{m.healthDelta}/week</strong></span>
            </div>
          );
        })()}
      </CardContent></Card>

      <Button onClick={startManagement} className="w-full text-base" size="lg">🚀 Start 12-Week Season</Button>
    </div>
  );
}
