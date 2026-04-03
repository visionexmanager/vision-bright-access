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
import { Scissors, RotateCcw, Trophy, Users, DollarSign, Star, Clock } from "lucide-react";

interface Props { simulationId?: string; }

interface Customer {
  id: number;
  name: string;
  patience: number;
  preferredService: string;
  tip: number;
}

const SERVICE_OPTIONS = [
  { id: "classic", emoji: "✂️", basePrice: 15, time: 20 },
  { id: "fade", emoji: "💈", basePrice: 25, time: 30 },
  { id: "beard", emoji: "🧔", basePrice: 12, time: 15 },
  { id: "color", emoji: "🎨", basePrice: 45, time: 50 },
  { id: "keratin", emoji: "🧴", basePrice: 60, time: 45 },
  { id: "full-spa", emoji: "💎", basePrice: 80, time: 60 },
];

const CUSTOMER_NAMES = ["Ahmad", "Lina", "Omar", "Sara", "Youssef", "Maya", "Ali", "Nour", "Karim", "Dina"];

function randomCustomer(id: number): Customer {
  const svc = SERVICE_OPTIONS[Math.floor(Math.random() * SERVICE_OPTIONS.length)];
  return {
    id,
    name: CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)],
    patience: 40 + Math.floor(Math.random() * 60),
    preferredService: svc.id,
    tip: Math.floor(Math.random() * 15),
  };
}

export function BarberSalonSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  // Business decisions
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(SERVICE_OPTIONS.map((s) => [s.id, s.basePrice]))
  );
  const [staffCount, setStaffCount] = useState(1);
  const [salonTier, setSalonTier] = useState<"basic" | "premium" | "luxury">("basic");

  // Game state
  const [day, setDay] = useState(1);
  const [totalDays] = useState(7);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [reputation, setReputation] = useState(50);
  const [customersServed, setCustomersServed] = useState(0);
  const [customersLost, setCustomersLost] = useState(0);
  const [queue, setQueue] = useState<Customer[]>([]);
  const [serving, setServing] = useState<{ customer: Customer; service: string; progress: number } | null>(null);
  const [dayActive, setDayActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);

  // Derived
  const dailyRent = salonTier === "luxury" ? 200 : salonTier === "premium" ? 120 : 60;
  const dailyStaffCost = staffCount * 80;
  const dailyFixedCost = dailyRent + dailyStaffCost;
  const profit = revenue - costs;
  const maxQueue = staffCount + 2;

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: day,
      decisions: { prices, staffCount, salonTier, revenue, costs, customersServed } as any,
      score: sc,
      completed: done,
    });
  }, [user, simulationId, day, prices, staffCount, salonTier, revenue, costs, customersServed]);

  // Start a business day
  const startDay = () => {
    if (dayActive) return;
    setDayActive(true);
    setCosts((c) => c + dailyFixedCost);
    playSound("scan");

    // Generate customers for the day
    const tierBonus = salonTier === "luxury" ? 3 : salonTier === "premium" ? 1 : 0;
    const repBonus = Math.floor(reputation / 25);
    const count = 3 + staffCount + tierBonus + repBonus + Math.floor(Math.random() * 3);
    const newQueue = Array.from({ length: count }, (_, i) => randomCustomer(day * 100 + i));
    setQueue(newQueue);
    toast.success(`📋 ${count} customers arrived today!`);
  };

  // Serve the next customer
  const serveCustomer = (serviceId: string) => {
    if (serving || queue.length === 0) return;
    const customer = queue[0];
    setQueue((q) => q.slice(1));
    setServing({ customer, service: serviceId, progress: 0 });
    playSound("snip");
  };

  // Progress serving
  useEffect(() => {
    if (!serving) return;
    const svc = SERVICE_OPTIONS.find((s) => s.id === serving.service)!;
    const interval = setInterval(() => {
      setServing((prev) => {
        if (!prev) return null;
        const newProgress = prev.progress + 5;
        if (newProgress >= 100) {
          clearInterval(interval);
          const price = prices[svc.id] ?? svc.basePrice;
          const priceRatio = price / svc.basePrice;
          const satisfied = priceRatio <= 1.5;
          const tipAmount = satisfied ? prev.customer.tip : 0;
          setRevenue((r) => r + price + tipAmount);
          setCustomersServed((c) => c + 1);
          setReputation((r) => Math.min(100, r + (satisfied ? 3 : -5)));
          playSound("ding");
          toast.success(`✅ ${prev.customer.name} served! +$${price + tipAmount}`);
          return null;
        }
        return { ...prev, progress: newProgress };
      });
    }, 200);
    return () => clearInterval(interval);
  }, [serving?.customer.id, serving?.service]);

  // Customer patience drain
  useEffect(() => {
    if (!dayActive || queue.length === 0) return;
    const interval = setInterval(() => {
      setQueue((prev) => {
        const updated = prev.map((c) => ({ ...c, patience: c.patience - 5 }));
        const leaving = updated.filter((c) => c.patience <= 0);
        if (leaving.length > 0) {
          setCustomersLost((l) => l + leaving.length);
          setReputation((r) => Math.max(0, r - leaving.length * 4));
          leaving.forEach((c) => toast.error(`😤 ${c.name} left! (too long wait)`));
        }
        return updated.filter((c) => c.patience > 0);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [dayActive, queue.length]);

  // End day
  const endDay = () => {
    setDayActive(false);
    setServing(null);
    setQueue([]);
    if (day >= totalDays) {
      finishGame();
    } else {
      setDay((d) => d + 1);
      toast.success(`🌙 Day ${day} complete! Profit so far: $${profit}`);
    }
  };

  const finishGame = () => {
    const finalScore = Math.max(0, Math.round(profit / 10) + reputation + customersServed * 5 - customersLost * 3);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setDay(1);
    setRevenue(0);
    setCosts(0);
    setReputation(50);
    setCustomersServed(0);
    setCustomersLost(0);
    setQueue([]);
    setServing(null);
    setDayActive(false);
    setFinished(false);
    setScore(0);
    setStaffCount(1);
    setSalonTier("basic");
    setPrices(Object.fromEntries(SERVICE_OPTIONS.map((s) => [s.id, s.basePrice])));
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">Salon Week Complete!</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3">
              <p className="text-2xl font-bold text-green-500">${revenue}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <p className="text-2xl font-bold text-red-500">${costs}</p>
              <p className="text-xs text-muted-foreground">Costs</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3">
              <p className="text-2xl font-bold text-primary">${profit}</p>
              <p className="text-xs text-muted-foreground">Net Profit</p>
            </div>
            <div className="rounded-xl bg-yellow-500/10 p-3">
              <p className="text-2xl font-bold text-yellow-500">{score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            👥 {customersServed} served | 😤 {customersLost} lost | ⭐ {reputation} reputation
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Scissors className="h-5 w-5" /> Day {day}/{totalDays}
        </h2>
        <div className="flex gap-2">
          <Badge variant="secondary"><DollarSign className="h-3 w-3" /> ${profit}</Badge>
          <Badge variant="outline"><Star className="h-3 w-3" /> {reputation}</Badge>
        </div>
      </div>
      <Progress value={(day / totalDays) * 100} className="h-2" />

      {/* Business Setup (before day starts) */}
      {!dayActive && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">⚙️ Business Decisions</h3>

            {/* Salon Tier */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Salon Tier (affects rent & customers)</label>
              <Select value={salonTier} onValueChange={(v: any) => setSalonTier(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">🏠 Basic ($60/day)</SelectItem>
                  <SelectItem value="premium">✨ Premium ($120/day)</SelectItem>
                  <SelectItem value="luxury">💎 Luxury ($200/day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Staff */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Staff: {staffCount} ($80/each/day = ${staffCount * 80})
              </label>
              <Slider
                value={[staffCount]}
                onValueChange={([v]) => setStaffCount(v)}
                min={1} max={4} step={1}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Set Your Prices</p>
              {SERVICE_OPTIONS.map((svc) => (
                <div key={svc.id} className="flex items-center gap-2">
                  <span className="text-lg w-8">{svc.emoji}</span>
                  <span className="text-xs w-20 truncate">{svc.id}</span>
                  <Slider
                    value={[prices[svc.id]]}
                    onValueChange={([v]) => setPrices((p) => ({ ...p, [svc.id]: v }))}
                    min={Math.round(svc.basePrice * 0.5)}
                    max={Math.round(svc.basePrice * 2.5)}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-bold w-10 text-right">${prices[svc.id]}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Daily fixed costs: ${dailyFixedCost} (rent ${dailyRent} + staff ${dailyStaffCost})
            </p>
            <Button onClick={startDay} className="w-full">🚀 Open Salon for Day {day}</Button>
          </CardContent>
        </Card>
      )}

      {/* Active Day */}
      {dayActive && (
        <>
          {/* Currently serving */}
          {serving && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold flex items-center gap-2">
                    <Scissors className="h-4 w-4 animate-spin" />
                    Serving {serving.customer.name}
                  </span>
                  <Badge>{serving.service}</Badge>
                </div>
                <Progress value={serving.progress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Customer Queue */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-1">
                  <Users className="h-4 w-4" /> Queue ({queue.length})
                </h3>
                <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Waiting</Badge>
              </div>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No customers waiting</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {queue.slice(0, maxQueue).map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">wants: {c.preferredService}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Progress
                            value={c.patience}
                            className={`h-1.5 ${c.patience < 30 ? "[&>div]:bg-destructive" : ""}`}
                          />
                        </div>
                        {i === 0 && !serving && (
                          <Select onValueChange={(v) => serveCustomer(v)}>
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue placeholder="Serve" />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_OPTIONS.map((svc) => (
                                <SelectItem key={svc.id} value={svc.id}>
                                  {svc.emoji} ${prices[svc.id]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Day Stats */}
          <div className="grid grid-cols-4 gap-2">
            <Card><CardContent className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-sm font-bold text-green-500">${revenue}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Costs</p>
              <p className="text-sm font-bold text-red-500">${costs}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Served</p>
              <p className="text-sm font-bold">{customersServed}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Lost</p>
              <p className="text-sm font-bold text-destructive">{customersLost}</p>
            </CardContent></Card>
          </div>

          <Button onClick={endDay} variant="outline" className="w-full" disabled={!!serving}>
            🌙 End Day {day}
          </Button>
        </>
      )}
    </div>
  );
}
