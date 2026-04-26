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
import { Input } from "@/components/ui/input";
import { CheckCircle2, RotateCcw, DollarSign, Star, ChefHat, Users, TrendingUp, Flame } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";

type Stage = "setup" | "service" | "results";

type MenuItem = { name: string; emoji: string; prepTime: number; cost: number; basePrice: number; difficulty: number };

const MENU_OPTIONS: MenuItem[] = [
  { name: "French Omelette", emoji: "🍳", prepTime: 5, cost: 3, basePrice: 12, difficulty: 2 },
  { name: "Japanese Ramen", emoji: "🍜", prepTime: 15, cost: 6, basePrice: 18, difficulty: 5 },
  { name: "Italian Pasta", emoji: "🍝", prepTime: 10, cost: 4, basePrice: 15, difficulty: 3 },
  { name: "Mexican Tacos", emoji: "🌮", prepTime: 8, cost: 3, basePrice: 11, difficulty: 2 },
  { name: "Indian Curry", emoji: "🍛", prepTime: 12, cost: 5, basePrice: 16, difficulty: 4 },
  { name: "Wagyu Steak", emoji: "🥩", prepTime: 20, cost: 25, basePrice: 55, difficulty: 7 },
  { name: "Sushi Platter", emoji: "🍣", prepTime: 18, cost: 15, basePrice: 40, difficulty: 8 },
  { name: "French Macarons", emoji: "🧁", prepTime: 25, cost: 8, basePrice: 22, difficulty: 9 },
];

type Props = { simulationId?: string };

export function GlobalKitchenSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
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

  const toggleMenuItem = (name: string) => {
    setMenuSelection(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 5 ? [...prev, name] : prev
    );
  };

  const selectedItems = MENU_OPTIONS.filter(m => menuSelection.includes(m.name));

  const locationTraffic = location === "downtown" ? 25 : location === "tourist" ? 30 : 15;
  const ambianceMultiplier = ambiance === "fine" ? 1.5 : ambiance === "casual" ? 1.0 : 0.7;
  const ambianceCost = ambiance === "fine" ? 200 : ambiance === "casual" ? 80 : 30;

  const startService = () => {
    if (menuSelection.length < 2) {
      toast.error("Select at least 2 menu items!");
      return;
    }
    playSound("correct");
    setStage("service");
    setRound(1);
    setEvents(["🔓 Kitchen is open! First customers arriving..."]);
  };

  const serveRound = () => {
    const newRound = round + 1;
    setRound(newRound);
    playSound("tick");

    // Customers per round
    const baseCustomers = locationTraffic + Math.round(reputation / 10);
    const menuVariety = Math.min(1.2, selectedItems.length * 0.2 + 0.4);
    const customers = Math.round(baseCustomers * menuVariety);

    // Each customer orders random item
    const avgMenuCost = selectedItems.reduce((s, i) => s + i.cost, 0) / selectedItems.length;
    const avgMenuPrice = selectedItems.reduce((s, i) => s + i.basePrice, 0) / selectedItems.length * priceMultiplier * ambianceMultiplier;
    const avgDifficulty = selectedItems.reduce((s, i) => s + i.difficulty, 0) / selectedItems.length;

    // Quality depends on chef capacity
    const maxCapacity = chefCount * 8; // 8 orders per chef
    const ordersServed = Math.min(customers, maxCapacity);
    const overworked = customers > maxCapacity;
    const qualityPenalty = overworked ? 15 : 0;
    const quality = Math.max(30, 100 - avgDifficulty * 5 - qualityPenalty + (chefCount * 3));

    // Satisfaction
    const satisfaction = quality >= 80 ? ordersServed : Math.round(ordersServed * (quality / 100));
    const lost = customers - ordersServed;

    const roundRevenue = Math.round(ordersServed * avgMenuPrice);
    const roundCosts = Math.round(ordersServed * avgMenuCost + chefCount * 50 + ambianceCost / 6);

    // Random events
    const rand = Math.random();
    let eventMsg = "";
    let repMod = 0;
    let revMod = 0;

    if (rand < 0.12) {
      eventMsg = `Round ${newRound}: 🌟 Food critic visit — reputation ${quality >= 70 ? "+10" : "-10"}`;
      repMod = quality >= 70 ? 10 : -10;
    } else if (rand < 0.2) {
      eventMsg = `Round ${newRound}: 📱 Viral social media post — +30% traffic`;
      revMod = Math.round(roundRevenue * 0.3);
    } else if (rand < 0.28) {
      eventMsg = `Round ${newRound}: ⚠️ Supply chain issue — costs +20%`;
      revMod = -Math.round(roundCosts * 0.2);
    } else if (overworked) {
      eventMsg = `Round ${newRound}: 😤 Kitchen overwhelmed! ${lost} customers left. Consider hiring more chefs.`;
      repMod = -5;
    } else {
      eventMsg = `Round ${newRound}: Served ${ordersServed} customers — ${satisfaction >= ordersServed * 0.8 ? "great service!" : "some complaints."}`;
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
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <ChefHat className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">{restaurantName || "Your Restaurant"} — Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Revenue</p><p className="text-lg font-bold text-green-500">${totalRevenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Profit</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Reputation</p><p className="text-lg font-bold">{reputation}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Satisfaction</p><p className="text-lg font-bold">{satRate}%</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title="📊 Financial Overview" data={[
          { label: "Revenue", value: totalRevenue, color: "hsl(142 71% 45%)" },
          { label: "Costs", value: totalCosts, color: "hsl(0 84% 60%)" },
          { label: "Profit", value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title="⭐ Performance Metrics" data={[
          { metric: "Reputation", value: reputation },
          { metric: "Satisfaction", value: satRate },
          { metric: "Menu Variety", value: Math.min(100, menuSelection.length * 20) },
          { metric: "Capacity", value: Math.min(100, chefCount * 12) },
          { metric: "Profitability", value: Math.min(100, Math.max(0, Math.round((profit / Math.max(1, totalRevenue)) * 100))) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
      </div>
    );
  }

  if (stage === "service") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2"><Flame className="h-6 w-6 text-primary" /> Round {round}/6</h2>
          <Badge variant="secondary">⭐ {reputation}</Badge>
        </div>
        <Progress value={(round / 6) * 100} className="h-3" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold text-green-500">${totalRevenue}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-destructive" />
            <p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p>
            <p className="text-xs text-muted-foreground">Profit</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-500" />
            <p className="text-lg font-bold">{customersSatisfied}</p>
            <p className="text-xs text-muted-foreground">Satisfied</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-500" />
            <p className="text-lg font-bold">{reputation}%</p>
            <p className="text-xs text-muted-foreground">Reputation</p>
          </CardContent></Card>
        </div>

        <Card className="bg-card border-muted"><CardContent className="pt-4">
          <div className="text-sm space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
            {events.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </CardContent></Card>

        <Button onClick={serveRound} className="w-full" size="lg" disabled={round >= 6}>
          {round < 6 ? `Serve Round ${round + 1}` : "Finishing..."}
        </Button>
      </div>
    );
  }

  // Setup
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><ChefHat className="h-6 w-6 text-primary" /> Global Kitchen</h2>
      <p className="text-sm text-muted-foreground">Open your restaurant! Choose menu items, hire chefs, set prices, and serve 6 rounds of customers.</p>

      <Card><CardContent className="pt-6 space-y-2">
        <span className="font-medium">🏪 Restaurant Name</span>
        <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="e.g., Fusion Bistro" />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📍 Location</span>
        <Select value={location} onValueChange={(v: any) => setLocation(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="downtown">Downtown — Medium traffic, medium rent</SelectItem>
            <SelectItem value="tourist">Tourist Area — High traffic, high rent</SelectItem>
            <SelectItem value="suburb">Suburb — Low traffic, low rent</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🎨 Ambiance</span>
        <Select value={ambiance} onValueChange={(v: any) => setAmbiance(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="street">Street Food — Low cost, x0.7 prices</SelectItem>
            <SelectItem value="casual">Casual Dining — Medium cost, standard prices</SelectItem>
            <SelectItem value="fine">Fine Dining — High cost, x1.5 prices</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">👨‍🍳 Chefs</span><Badge variant="outline">{chefCount}</Badge></div>
        <Slider value={[chefCount]} onValueChange={([v]) => setChefCount(v)} min={1} max={8} step={1} />
        <p className="text-xs text-muted-foreground">Each chef handles ~8 orders/round. More chefs = higher capacity but higher labor costs ($50/chef/round).</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📋 Menu (select 2-5 items)</span>
        <div className="grid grid-cols-2 gap-2">
          {MENU_OPTIONS.map(item => {
            const selected = menuSelection.includes(item.name);
            return (
              <Button
                key={item.name}
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMenuItem(item.name)}
                className="h-auto py-2 flex flex-col text-xs"
              >
                <span>{item.emoji} {item.name}</span>
                <span className="opacity-70">${item.basePrice} · ⭐{item.difficulty}/10</span>
              </Button>
            );
          })}
        </div>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💰 Price Multiplier</span><Badge variant="outline">x{priceMultiplier.toFixed(1)}</Badge></div>
        <Slider value={[priceMultiplier * 10]} onValueChange={([v]) => setPriceMultiplier(v / 10)} min={5} max={20} step={1} />
        <p className="text-xs text-muted-foreground">Higher prices = more revenue per customer but may reduce demand</p>
      </CardContent></Card>

      <Button onClick={startService} className="w-full text-base" size="lg" disabled={menuSelection.length < 2}>
        🍽️ Open Restaurant — Serve 6 Rounds
      </Button>
    </div>
  );
}
