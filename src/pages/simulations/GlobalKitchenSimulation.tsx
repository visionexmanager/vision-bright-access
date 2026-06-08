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
import { Input } from "@/components/ui/input";
import { CheckCircle2, RotateCcw, DollarSign, Star, ChefHat, Users, TrendingUp, Flame } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";
import { SimulationScene } from "@/components/SimulationScene";

type Stage = "setup" | "service" | "results";

type MenuItem = { nameKey: string; emoji: string; prepTime: number; cost: number; basePrice: number; difficulty: number };

const MENU_OPTIONS: MenuItem[] = [
  { nameKey: "sim.kitchen.menu.frenchOmelette", emoji: "🍳", prepTime: 5, cost: 3, basePrice: 12, difficulty: 2 },
  { nameKey: "sim.kitchen.menu.japaneseRamen", emoji: "🍜", prepTime: 15, cost: 6, basePrice: 18, difficulty: 5 },
  { nameKey: "sim.kitchen.menu.italianPasta", emoji: "🍝", prepTime: 10, cost: 4, basePrice: 15, difficulty: 3 },
  { nameKey: "sim.kitchen.menu.mexicanTacos", emoji: "🌮", prepTime: 8, cost: 3, basePrice: 11, difficulty: 2 },
  { nameKey: "sim.kitchen.menu.indianCurry", emoji: "🍛", prepTime: 12, cost: 5, basePrice: 16, difficulty: 4 },
  { nameKey: "sim.kitchen.menu.wagyuSteak", emoji: "🥩", prepTime: 20, cost: 25, basePrice: 55, difficulty: 7 },
  { nameKey: "sim.kitchen.menu.sushiPlatter", emoji: "🍣", prepTime: 18, cost: 15, basePrice: 40, difficulty: 8 },
  { nameKey: "sim.kitchen.menu.frenchMacarons", emoji: "🧁", prepTime: 25, cost: 8, basePrice: 22, difficulty: 9 },
];

type Props = { simulationId?: string };

export function GlobalKitchenSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce, announceUrgent } = useScreenReader();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("setup");
  const [score, setScore] = useState(0);

  // Setup
  const [restaurantName, setRestaurantName] = useState("");
  const [chefCount, setChefCount] = useState(3);
  const [menuSelection, setMenuSelection] = useState<string[]>([]);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);
  const [ambiance, setAmbiance] = useState<"casual" | "fine" | "street">("casual");
  const [location, setLocation] = useState<"downtown" | "suburb" | "tourist">("downtown");

  // Service
  const [round, setRound] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [customersSatisfied, setCustomersSatisfied] = useState(0);
  const [customersLost, setCustomersLost] = useState(0);
  const [reputation, setReputation] = useState(70);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const toggleMenuItem = (nameKey: string) => {
    setMenuSelection(prev =>
      prev.includes(nameKey) ? prev.filter(n => n !== nameKey) : prev.length < 5 ? [...prev, nameKey] : prev
    );
  };

  const selectedItems = MENU_OPTIONS.filter(m => menuSelection.includes(m.nameKey));

  const locationTraffic = location === "downtown" ? 25 : location === "tourist" ? 30 : 15;
  const ambianceMultiplier = ambiance === "fine" ? 1.5 : ambiance === "casual" ? 1.0 : 0.7;
  const ambianceCost = ambiance === "fine" ? 200 : ambiance === "casual" ? 80 : 30;

  const startService = () => {
    if (menuSelection.length < 2) {
      toast.error(t("sim.kitchen.error.minMenuItems"));
      return;
    }
    announce("Correct! Well done.");
    playSound("cooking");
    setStage("service");
    setRound(1);
    setEvents([t("sim.kitchen.event.kitchenOpen")]);
  };

  const serveRound = () => {
    const newRound = round + 1;
    setRound(newRound);
    playSound("sizzle");

    const baseCustomers = locationTraffic + Math.round(reputation / 10);
    const menuVariety = Math.min(1.2, selectedItems.length * 0.2 + 0.4);
    const customers = Math.round(baseCustomers * menuVariety);

    const avgMenuCost = selectedItems.reduce((s, i) => s + i.cost, 0) / selectedItems.length;
    const avgMenuPrice = selectedItems.reduce((s, i) => s + i.basePrice, 0) / selectedItems.length * priceMultiplier * ambianceMultiplier;
    const avgDifficulty = selectedItems.reduce((s, i) => s + i.difficulty, 0) / selectedItems.length;

    const maxCapacity = chefCount * 8;
    const ordersServed = Math.min(customers, maxCapacity);
    const overworked = customers > maxCapacity;
    const qualityPenalty = overworked ? 15 : 0;
    const quality = Math.max(30, 100 - avgDifficulty * 5 - qualityPenalty + (chefCount * 3));

    const satisfaction = quality >= 80 ? ordersServed : Math.round(ordersServed * (quality / 100));
    const lost = customers - ordersServed;

    const roundRevenue = Math.round(ordersServed * avgMenuPrice);
    const roundCosts = Math.round(ordersServed * avgMenuCost + chefCount * 50 + ambianceCost / 6);

    const rand = Math.random();
    let eventMsg = "";
    let repMod = 0;
    let revMod = 0;

    if (rand < 0.12) {
      eventMsg = t("sim.kitchen.event.criticVisit").replace("{round}", String(newRound));
      repMod = quality >= 70 ? 10 : -10;
    } else if (rand < 0.2) {
      eventMsg = t("sim.kitchen.event.viralPost").replace("{round}", String(newRound));
      revMod = Math.round(roundRevenue * 0.3);
    } else if (rand < 0.28) {
      eventMsg = t("sim.kitchen.event.supplyChain").replace("{round}", String(newRound));
      revMod = -Math.round(roundCosts * 0.2);
    } else if (overworked) {
      eventMsg = t("sim.kitchen.event.overwhelmed").replace("{round}", String(newRound)).replace("{lost}", String(lost));
      repMod = -5;
    } else {
      eventMsg = t("sim.kitchen.event.normal").replace("{round}", String(newRound)).replace("{orders}", String(ordersServed));
    }

    setTotalRevenue(prev => prev + roundRevenue + Math.max(0, revMod));
    setTotalCosts(prev => prev + roundCosts + Math.max(0, -revMod));
    setCustomersSatisfied(prev => prev + satisfaction);
    setCustomersLost(prev => prev + lost);
    setReputation(prev => Math.min(100, Math.max(20, prev + repMod + (satisfaction >= ordersServed * 0.8 ? 2 : -2))));
    setEvents(prev => [eventMsg, ...prev.slice(0, 5)]);

    if (newRound >= 6) finishSim();
  };

  const finishSim = async () => {
    const profit = totalRevenue - totalCosts;
    const repBonus = reputation >= 80 ? 20 : reputation >= 60 ? 10 : 0;
    const profitBonus = profit > 0 ? Math.min(25, Math.round(profit / 100)) : 0;
    const satisfactionRate = customersSatisfied / Math.max(1, customersSatisfied + customersLost);
    const satBonus = satisfactionRate >= 0.8 ? 15 : satisfactionRate >= 0.6 ? 8 : 0;
    const finalScore = 10 + repBonus + profitBonus + satBonus;

    setScore(finalScore);
    setStage("results");
    announce(`Level complete! Score: ${finalScore}`);
    playSound("levelUp");

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 6,
        decisions: { menuSelection, chefCount, priceMultiplier, ambiance, location } as Record<string, unknown>,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("setup");
    setScore(0);
    setRestaurantName("");
    setChefCount(3);
    setMenuSelection([]);
    setPriceMultiplier(1.0);
    setAmbiance("casual");
    setLocation("downtown");
    setRound(1);
    setTotalRevenue(0);
    setTotalCosts(0);
    setCustomersSatisfied(0);
    setCustomersLost(0);
    setReputation(70);
    setEvents([]);
  };

  const profit = totalRevenue - totalCosts;

  if (stage === "results") {
    const satRate = Math.round((customersSatisfied / Math.max(1, customersSatisfied + customersLost)) * 100);
    const displayName = restaurantName || t("sim.kitchen.results.defaultName");
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <ChefHat className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">{t("sim.kitchen.results.title").replace("{name}", displayName)}</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.kitchen.metric.revenue")}</p><p className="text-lg font-bold text-green-500">${totalRevenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.kitchen.metric.profit")}</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.kitchen.metric.reputation")}</p><p className="text-lg font-bold">{reputation}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.kitchen.metric.satisfaction")}</p><p className="text-lg font-bold">{satRate}%</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title={t("sim.kitchen.chart.financialOverview")} data={[
          { label: t("sim.kitchen.metric.revenue"), value: totalRevenue, color: "hsl(142 71% 45%)" },
          { label: t("sim.kitchen.metric.profit"), value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title={t("sim.kitchen.chart.performanceMetrics")} data={[
          { metric: t("sim.kitchen.metric.reputation"), value: reputation },
          { metric: t("sim.kitchen.metric.satisfaction"), value: satRate },
          { metric: t("sim.kitchen.metric.menuVariety"), value: Math.min(100, menuSelection.length * 20) },
          { metric: t("sim.kitchen.metric.capacity"), value: Math.min(100, chefCount * 12) },
          { metric: t("sim.kitchen.metric.profitability"), value: Math.min(100, Math.max(0, Math.round((profit / Math.max(1, totalRevenue)) * 100))) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> {t("sim.kitchen.btn.playAgain")}</Button>
      </div>
    );
  }

  if (stage === "service") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2"><Flame className="h-6 w-6 text-primary" /> {t("sim.kitchen.label.roundProgress").replace("{round}", String(round))}</h2>
          <Badge variant="secondary" role="status" aria-live="polite">⭐ {reputation}</Badge>
        </div>
        <Progress value={(round / 6) * 100} className="h-3" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold text-green-500">${totalRevenue}</p>
            <p className="text-xs text-muted-foreground">{t("sim.kitchen.metric.revenue")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-destructive" />
            <p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p>
            <p className="text-xs text-muted-foreground">{t("sim.kitchen.card.profit")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-500" />
            <p className="text-lg font-bold">{customersSatisfied}</p>
            <p className="text-xs text-muted-foreground">{t("sim.kitchen.card.satisfied")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-500" />
            <p className="text-lg font-bold">{reputation}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.kitchen.metric.reputation")}</p>
          </CardContent></Card>
        </div>

        <Card className="bg-card border-muted"><CardContent className="pt-4">
          <div className="text-sm space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
            {events.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </CardContent></Card>

        <Button onClick={serveRound} className="w-full" size="lg" disabled={round >= 6}>
          {round < 6 ? t("sim.kitchen.btn.serveRound").replace("{round}", String(round + 1)) : t("sim.kitchen.btn.finishing")}
        </Button>
        <SimulationMentor simulationTitle={t("sim.kitchen.title")} currentStepTitle={t("sim.kitchen.label.roundProgress").replace("{round}", String(round))} />
      </div>
    );
  }

  // Setup
  return (
    <div className="space-y-6">
      <SimulationScene slug="global-kitchen" isActive={round > 1} isComplete={stage === "results"} />
      <h2 className="text-xl font-bold flex items-center gap-2"><ChefHat className="h-6 w-6 text-primary" /> {t("sim.kitchen.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("sim.kitchen.description")}</p>

      <Card><CardContent className="pt-6 space-y-2">
        <span className="font-medium">🏪 {t("sim.kitchen.label.restaurantName")}</span>
        <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder={t("sim.kitchen.placeholder.restaurantName")} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📍 {t("sim.kitchen.label.location")}</span>
        <Select value={location} onValueChange={(v: any) => setLocation(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="downtown">{t("sim.kitchen.location.downtown")}</SelectItem>
            <SelectItem value="tourist">{t("sim.kitchen.location.tourist")}</SelectItem>
            <SelectItem value="suburb">{t("sim.kitchen.location.suburb")}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🎨 {t("sim.kitchen.label.ambiance")}</span>
        <Select value={ambiance} onValueChange={(v: any) => setAmbiance(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="street">{t("sim.kitchen.ambiance.street")}</SelectItem>
            <SelectItem value="casual">{t("sim.kitchen.ambiance.casual")}</SelectItem>
            <SelectItem value="fine">{t("sim.kitchen.ambiance.fine")}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">👨‍🍳 {t("sim.kitchen.label.chefs")}</span><Badge variant="outline">{chefCount}</Badge></div>
        <Slider value={[chefCount]} onValueChange={([v]) => setChefCount(v)} min={1} max={8} step={1} />
        <p className="text-xs text-muted-foreground">{t("sim.kitchen.hint.chefs")}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📋 {t("sim.kitchen.label.menu")}</span>
        <div className="grid grid-cols-2 gap-2">
          {MENU_OPTIONS.map(item => {
            const selected = menuSelection.includes(item.nameKey);
            return (
              <Button
                key={item.nameKey}
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMenuItem(item.nameKey)}
                className="h-auto py-2 flex flex-col text-xs"
                aria-label={t(item.nameKey as any)}
              >
                <span>{item.emoji} {t(item.nameKey as any)}</span>
                <span className="opacity-70">${item.basePrice} · ⭐{item.difficulty}/10</span>
              </Button>
            );
          })}
        </div>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💰 {t("sim.kitchen.label.priceMultiplier")}</span><Badge variant="outline">x{priceMultiplier.toFixed(1)}</Badge></div>
        <Slider value={[priceMultiplier * 10]} onValueChange={([v]) => setPriceMultiplier(v / 10)} min={5} max={20} step={1} />
        <p className="text-xs text-muted-foreground">{t("sim.kitchen.hint.priceMultiplier")}</p>
      </CardContent></Card>

      <Button onClick={startService} className="w-full text-base" size="lg" disabled={menuSelection.length < 2}>
        {t("sim.kitchen.btn.openRestaurant")}
      </Button>
      <SimulationMentor simulationTitle={t("sim.kitchen.title")} currentStepTitle={t("sim.kitchen.stepTitle.setup")} />
    </div>
  );
}
