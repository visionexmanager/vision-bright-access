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
import { RotateCcw, Trophy, Thermometer, Flame } from "lucide-react";

interface Props { simulationId?: string; }

const RECIPES = [
  { id: "dark", name: "🍫 Dark Chocolate", cocoa: 70, sugar: 15, milk: 5, sellPrice: 8, idealTemp: 32 },
  { id: "milk", name: "🥛 Milk Chocolate", cocoa: 40, sugar: 25, milk: 25, sellPrice: 6, idealTemp: 30 },
  { id: "white", name: "🤍 White Chocolate", cocoa: 0, sugar: 30, milk: 40, sellPrice: 7, idealTemp: 28 },
  { id: "truffle", name: "🟤 Truffle Deluxe", cocoa: 60, sugar: 10, milk: 15, sellPrice: 15, idealTemp: 31 },
  { id: "hazelnut", name: "🌰 Hazelnut Praline", cocoa: 50, sugar: 20, milk: 10, sellPrice: 12, idealTemp: 29 },
];

export function ChocolateFactorySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  // Business decisions
  const [selectedRecipe, setSelectedRecipe] = useState(RECIPES[0]);
  const [batchSize, setBatchSize] = useState(50);
  const [temperature, setTemperature] = useState(30);
  const [mixTime, setMixTime] = useState(5);
  const [packaging, setPackaging] = useState<"basic" | "premium" | "luxury">("basic");

  // Game state
  const [batch, setBatch] = useState(1);
  const [totalBatches] = useState(5);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [wastedBars, setWastedBars] = useState(0);
  const [producing, setProducing] = useState(false);
  const [prodProgress, setProdProgress] = useState(0);
  const [prodStage, setProdStage] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [batches, setBatches] = useState<{ recipe: string; quality: number; profit: number }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    const payload = {
      user_id: user.id, simulation_id: simulationId,
      current_step: batch, score: sc, completed: done,
      decisions: { revenue, costs, batches } as any,
    };
    const { data: existing } = await supabase
      .from("simulation_progress").select("id")
      .eq("user_id", user.id).eq("simulation_id", simulationId).maybeSingle();
    if (existing) await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
    else await supabase.from("simulation_progress").insert(payload);
  }, [user, simulationId, batch, revenue, costs, batches]);

  const packagingCost = packaging === "luxury" ? 3 : packaging === "premium" ? 1.5 : 0.5;
  const ingredientCost = (selectedRecipe.cocoa * 0.1 + selectedRecipe.sugar * 0.05 + selectedRecipe.milk * 0.08) * (batchSize / 50);

  const calculateQuality = () => {
    const tempDiff = Math.abs(temperature - selectedRecipe.idealTemp);
    let q = 100;
    if (tempDiff > 5) q -= 40;
    else if (tempDiff > 3) q -= 20;
    else if (tempDiff > 1) q -= 5;

    if (mixTime < 3) q -= 25;
    else if (mixTime > 8) q -= 15;
    else if (mixTime >= 4 && mixTime <= 6) q += 5;

    return Math.max(0, Math.min(100, q));
  };

  const startProduction = () => {
    if (producing) return;
    setProducing(true);
    setProdProgress(0);
    playSound("scan");

    const stages = ["Melting cocoa...", "Mixing ingredients...", "Tempering...", "Molding...", "Cooling...", "Packaging..."];
    let step = 0;
    const totalSteps = 30;

    const interval = setInterval(() => {
      step++;
      setProdProgress(Math.round((step / totalSteps) * 100));
      setProdStage(stages[Math.min(Math.floor((step / totalSteps) * stages.length), stages.length - 1)]);

      if (step >= totalSteps) {
        clearInterval(interval);
        const quality = calculateQuality();
        const yieldRate = quality > 70 ? 0.95 : quality > 40 ? 0.75 : 0.5;
        const goodBars = Math.round(batchSize * yieldRate);
        const waste = batchSize - goodBars;
        const batchRevenue = goodBars * (selectedRecipe.sellPrice * (quality / 80));
        const batchCost = ingredientCost + packagingCost * batchSize;

        setRevenue((r) => r + Math.round(batchRevenue));
        setCosts((c) => c + Math.round(batchCost));
        setWastedBars((w) => w + waste);
        setQualityScore((q) => Math.round((q * (batch - 1) + quality) / batch));
        setBatches((b) => [...b, { recipe: selectedRecipe.id, quality, profit: Math.round(batchRevenue - batchCost) }]);

        setProducing(false);
        setProdProgress(0);
        playSound("ding");
        toast.success(`🍫 Batch ${batch} done! Quality: ${quality}% | ${goodBars}/${batchSize} good bars`);

        if (batch >= totalBatches) {
          finishGame(quality);
        } else {
          setBatch((b) => b + 1);
        }
      }
    }, 150);
  };

  const finishGame = (lastQuality?: number) => {
    const avgQ = lastQuality ? Math.round((qualityScore * (batch - 1) + lastQuality) / batch) : qualityScore;
    const finalScore = Math.max(0, Math.round((revenue - costs) / 5) + avgQ - wastedBars);
    setScore(finalScore);
    setFinished(true);
    playSound("complete");
    saveProgress(finalScore, true);
  };

  const restart = () => {
    setBatch(1);
    setRevenue(0);
    setCosts(0);
    setQualityScore(0);
    setWastedBars(0);
    setProducing(false);
    setFinished(false);
    setScore(0);
    setBatches([]);
    setTemperature(30);
    setMixTime(5);
    setBatchSize(50);
    setPackaging("basic");
  };

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">🏭 Factory Report</h2>
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
              <p className="text-2xl font-bold text-primary">{qualityScore}%</p>
              <p className="text-xs text-muted-foreground">Avg Quality</p>
            </div>
            <div className="rounded-xl bg-yellow-500/10 p-3">
              <p className="text-2xl font-bold text-yellow-500">{score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
          </div>
          <div className="text-left space-y-1">
            {batches.map((b, i) => (
              <div key={i} className="flex justify-between text-sm p-1 rounded bg-muted/30">
                <span>Batch {i + 1}: {b.recipe}</span>
                <span className={b.profit > 0 ? "text-green-500" : "text-red-500"}>
                  Q:{b.quality}% | ${b.profit}
                </span>
              </div>
            ))}
          </div>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🏭 Batch {batch}/{totalBatches}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">${revenue - costs} profit</Badge>
          <Badge variant="outline">Q: {qualityScore}%</Badge>
        </div>
      </div>
      <Progress value={(batch / totalBatches) * 100} className="h-2" />

      {/* Production in progress */}
      {producing && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Flame className="mx-auto h-8 w-8 text-orange-500 animate-pulse" />
            <p className="font-semibold">{prodStage}</p>
            <Progress value={prodProgress} className="h-3" />
            <p className="text-sm text-muted-foreground">{prodProgress}%</p>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      {!producing && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🍫 Production Controls</h3>

            {/* Recipe */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Recipe</label>
              <Select value={selectedRecipe.id} onValueChange={(v) => setSelectedRecipe(RECIPES.find((r) => r.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name} (sells @${r.sellPrice})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch Size */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Batch Size: {batchSize} bars (cost: ${Math.round(ingredientCost)})
              </label>
              <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={20} max={200} step={10} />
            </div>

            {/* Temperature */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                Temperature: {temperature}°C
                <span className={`text-xs ml-1 ${Math.abs(temperature - selectedRecipe.idealTemp) <= 1 ? "text-green-500" : Math.abs(temperature - selectedRecipe.idealTemp) <= 3 ? "text-yellow-500" : "text-red-500"}`}>
                  (ideal: {selectedRecipe.idealTemp}°C)
                </span>
              </label>
              <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={20} max={45} step={0.5} />
            </div>

            {/* Mix Time */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Mix Time: {mixTime} min (sweet spot: 4-6 min)
              </label>
              <Slider value={[mixTime]} onValueChange={([v]) => setMixTime(v)} min={1} max={12} step={1} />
            </div>

            {/* Packaging */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Packaging (${ packagingCost}/bar)</label>
              <Select value={packaging} onValueChange={(v: any) => setPackaging(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">📦 Basic ($0.50)</SelectItem>
                  <SelectItem value="premium">🎁 Premium ($1.50)</SelectItem>
                  <SelectItem value="luxury">✨ Luxury ($3.00)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cost preview */}
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Ingredients:</span><span>${Math.round(ingredientCost)}</span></div>
              <div className="flex justify-between"><span>Packaging:</span><span>${Math.round(packagingCost * batchSize)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1">
                <span>Total Cost:</span><span>${Math.round(ingredientCost + packagingCost * batchSize)}</span>
              </div>
              <div className="flex justify-between text-green-500">
                <span>Max Revenue (100% quality):</span><span>${Math.round(batchSize * selectedRecipe.sellPrice)}</span>
              </div>
            </div>

            <Button onClick={startProduction} className="w-full">🔥 Start Production</Button>
          </CardContent>
        </Card>
      )}

      {/* Batch History */}
      {batches.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">📊 Batch History</h3>
            {batches.map((b, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>#{i + 1} {b.recipe}</span>
                <span className={b.profit > 0 ? "text-green-500" : "text-red-500"}>
                  Q:{b.quality}% | {b.profit > 0 ? "+" : ""}${b.profit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
