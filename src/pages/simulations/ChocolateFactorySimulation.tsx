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
import { toast } from "sonner";
import { RotateCcw, Trophy, Thermometer, Flame, ArrowLeft } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";
import { SimulationScene } from "@/components/SimulationScene";

interface Props { simulationId?: string; }

const RECIPE_IDS = ["dark", "milk", "white", "truffle", "hazelnut"] as const;

const RECIPES = [
  { id: "dark", cocoa: 70, sugar: 15, milk: 5, sellPrice: 8, idealTemp: 32 },
  { id: "milk", cocoa: 40, sugar: 25, milk: 25, sellPrice: 6, idealTemp: 30 },
  { id: "white", cocoa: 0, sugar: 30, milk: 40, sellPrice: 7, idealTemp: 28 },
  { id: "truffle", cocoa: 60, sugar: 10, milk: 15, sellPrice: 15, idealTemp: 31 },
  { id: "hazelnut", cocoa: 50, sugar: 20, milk: 10, sellPrice: 12, idealTemp: 29 },
];

export function ChocolateFactorySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce } = useScreenReader();
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

  // Unmount guard: clear any in-flight production interval if the user navigates away.
  const productionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (productionIntervalRef.current) clearInterval(productionIntervalRef.current); }, []);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: batch, score: sc, completed: done,
      decisions: { revenue, costs, batches } as Record<string, unknown>,
    });
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

  const getStages = () => [
    t("sim.choco.stage.meltingCocoa"),
    t("sim.choco.stage.mixingIngredients"),
    t("sim.choco.stage.tempering"),
    t("sim.choco.stage.molding"),
    t("sim.choco.stage.cooling"),
    t("sim.choco.stage.packaging"),
  ];

  const startProduction = () => {
    if (producing) return;
    setProducing(true);
    setProdProgress(0);
    playSound("cooking");

    const stages = getStages();
    let step = 0;
    const totalSteps = 30;

    productionIntervalRef.current = setInterval(() => {
      step++;
      setProdProgress(Math.round((step / totalSteps) * 100));
      setProdStage(stages[Math.min(Math.floor((step / totalSteps) * stages.length), stages.length - 1)]);
      if (step === 15) playSound("sizzle");

      if (step >= totalSteps) {
        clearInterval(productionIntervalRef.current!);
        productionIntervalRef.current = null;
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
        toast.success(t("sim.choco.batchComplete").replace("{n}", String(batch)).replace("{quality}", String(quality)).replace("{good}", String(goodBars)).replace("{total}", String(batchSize)));

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
    announce(`Simulation complete! Final score: ${finalScore}`);
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

  const recipeNameKey = (id: string) => `sim.choco.recipe.${id}` as const;

  if (finished) {
    return (
      <Card className="max-w-lg mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="mx-auto h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">{t("sim.choco.report.title")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/10 p-3">
              <p className="text-2xl font-bold text-green-500">${revenue}</p>
              <p className="text-xs text-muted-foreground">{t("sim.choco.report.revenue")}</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <p className="text-2xl font-bold text-red-500">${costs}</p>
              <p className="text-xs text-muted-foreground">{t("sim.choco.report.costs")}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3">
              <p className="text-2xl font-bold text-primary">{qualityScore}%</p>
              <p className="text-xs text-muted-foreground">{t("sim.choco.report.avgQuality")}</p>
            </div>
            <div className="rounded-xl bg-yellow-500/10 p-3">
              <p className="text-2xl font-bold text-yellow-500">{score}</p>
              <p className="text-xs text-muted-foreground">{t("sim.choco.report.score")}</p>
            </div>
          </div>
          <div className="text-start space-y-1">
            {batches.map((b, i) => (
              <div key={i} className="flex justify-between text-sm p-1 rounded bg-muted/30">
                <span>{t("sim.choco.report.batchRow").replace("{n}", String(i + 1)).replace("{recipe}", t(recipeNameKey(b.recipe)))}</span>
                <span className={b.profit > 0 ? "text-green-500" : "text-red-500"}>
                  Q:{b.quality}% | ${b.profit}
                </span>
              </div>
            ))}
          </div>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.choco.report.playAgain")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SimulationScene slug="chocolate-factory" isActive={batch > 1 || producing} isComplete={finished} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("sim.choco.round").replace("{batch}", String(batch)).replace("{total}", String(totalBatches))}</h2>
        <div className="flex gap-2">
          <Badge variant="secondary" role="status" aria-live="polite">{t("sim.choco.profitBadge").replace("{profit}", String(revenue - costs))}</Badge>
          <Badge variant="outline">{t("sim.choco.qualityBadge").replace("{quality}", String(qualityScore))}</Badge>
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
            <h3 className="font-bold text-sm">{t("sim.choco.productionControls")}</h3>

            {/* Recipe */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.choco.recipeLabel")}</label>
              <Select value={selectedRecipe.id} onValueChange={(v) => setSelectedRecipe(RECIPES.find((r) => r.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{t(recipeNameKey(r.id))} (sells @${r.sellPrice})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch Size */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("sim.choco.batchSizeLabel").replace("{count}", String(batchSize)).replace("{cost}", String(Math.round(ingredientCost)))}
              </label>
              <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={20} max={200} step={10} />
            </div>

            {/* Temperature */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {t("sim.choco.temperatureLabel").replace("{temp}", String(temperature))}
                <span className={`text-xs ml-1 ${Math.abs(temperature - selectedRecipe.idealTemp) <= 1 ? "text-green-500" : Math.abs(temperature - selectedRecipe.idealTemp) <= 3 ? "text-yellow-500" : "text-red-500"}`}>
                  {t("sim.choco.idealTemp").replace("{temp}", String(selectedRecipe.idealTemp))}
                </span>
              </label>
              <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={20} max={45} step={0.5} />
            </div>

            {/* Mix Time */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("sim.choco.mixTimeLabel").replace("{time}", String(mixTime))}
              </label>
              <Slider value={[mixTime]} onValueChange={([v]) => setMixTime(v)} min={1} max={12} step={1} />
            </div>

            {/* Packaging */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.choco.packagingLabel")} (${packagingCost}/bar)</label>
              <Select value={packaging} onValueChange={(v: any) => setPackaging(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">{t("sim.choco.packaging.basic")}</SelectItem>
                  <SelectItem value="premium">{t("sim.choco.packaging.premium")}</SelectItem>
                  <SelectItem value="luxury">{t("sim.choco.packaging.luxury")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cost preview */}
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>{t("sim.choco.costs.ingredients")}</span><span>${Math.round(ingredientCost)}</span></div>
              <div className="flex justify-between"><span>{t("sim.choco.costs.packaging")}</span><span>${Math.round(packagingCost * batchSize)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1">
                <span>{t("sim.choco.costs.total")}</span><span>${Math.round(ingredientCost + packagingCost * batchSize)}</span>
              </div>
              <div className="flex justify-between text-green-500">
                <span>{t("sim.choco.costs.maxRevenue")}</span><span>${Math.round(batchSize * selectedRecipe.sellPrice)}</span>
              </div>
            </div>

            <Button onClick={startProduction} className="w-full" aria-label={t("sim.choco.btn.startProduction")}>{t("sim.choco.btn.startProduction")}</Button>
          </CardContent>
        </Card>
      )}

      {/* Batch History */}
      {batches.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">{t("sim.choco.history.title")}</h3>
            {batches.map((b, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span>#{i + 1} {t(recipeNameKey(b.recipe))}</span>
                <span className={b.profit > 0 ? "text-green-500" : "text-red-500"}>
                  Q:{b.quality}% | {b.profit > 0 ? "+" : ""}${b.profit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <SimulationMentor
        simulationTitle={t("sim.choco.report.title")}
        currentStepTitle={finished ? t("sim.choco.complete") : producing ? prodStage : t("sim.choco.round").replace("{batch}", String(batch)).replace("{total}", String(totalBatches))}
      />
    </div>
  );
}
