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
import { CheckCircle2, RotateCcw, DollarSign, Star, FlaskConical, Sparkles, Heart } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Stage = "creation" | "market" | "results";

type NoteIngredient = { id: string; name: string; layer: "top" | "heart" | "base"; costPerMl: number; intensity: number };

const INGREDIENTS: NoteIngredient[] = [
  { id: "bergamot", name: "Bergamot", layer: "top", costPerMl: 3, intensity: 7 },
  { id: "lemon", name: "Lemon Zest", layer: "top", costPerMl: 2, intensity: 6 },
  { id: "pink-pepper", name: "Pink Pepper", layer: "top", costPerMl: 4, intensity: 8 },
  { id: "jasmine", name: "Jasmine", layer: "heart", costPerMl: 8, intensity: 9 },
  { id: "rose", name: "Rose Absolute", layer: "heart", costPerMl: 12, intensity: 10 },
  { id: "lavender", name: "Lavender", layer: "heart", costPerMl: 3, intensity: 5 },
  { id: "oud", name: "Royal Oud", layer: "base", costPerMl: 25, intensity: 10 },
  { id: "sandalwood", name: "Sandalwood", layer: "base", costPerMl: 10, intensity: 7 },
  { id: "vanilla", name: "Vanilla Bean", layer: "base", costPerMl: 6, intensity: 8 },
  { id: "amber", name: "Amber", layer: "base", costPerMl: 5, intensity: 6 },
  { id: "musk", name: "White Musk", layer: "base", costPerMl: 4, intensity: 5 },
];

type Props = { simulationId?: string };

export function PerfumeLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("creation");
  const [score, setScore] = useState(0);

  // Creation
  const [perfumeName, setPerfumeName] = useState("");
  const [concentration, setConcentration] = useState<"edt" | "edp" | "parfum">("edp");
  const [bottleSize, setBottleSize] = useState(50);
  const [selectedNotes, setSelectedNotes] = useState<Record<string, number>>({});
  const [retailPrice, setRetailPrice] = useState(80);
  const [targetAudience, setTargetAudience] = useState<"unisex" | "feminine" | "masculine">("unisex");
  const [batchSize, setBatchSize] = useState(200);

  // Market results
  const [salesResult, setSalesResult] = useState({ unitsSold: 0, revenue: 0, cost: 0 });

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const toggleNote = (id: string) => {
    setSelectedNotes(prev => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        next[id] = 2; // default 2ml
      }
      return next;
    });
  };

  const setNoteAmount = (id: string, ml: number) => {
    setSelectedNotes(prev => ({ ...prev, [id]: ml }));
  };

  const calcPerfume = useCallback(() => {
    const notes = Object.entries(selectedNotes).map(([id, ml]) => {
      const ing = INGREDIENTS.find(i => i.id === id)!;
      return { ...ing, ml };
    });

    const topNotes = notes.filter(n => n.layer === "top");
    const heartNotes = notes.filter(n => n.layer === "heart");
    const baseNotes = notes.filter(n => n.layer === "base");

    const hasTop = topNotes.length > 0;
    const hasHeart = heartNotes.length > 0;
    const hasBase = baseNotes.length > 0;
    const balanced = hasTop && hasHeart && hasBase;

    const totalMl = notes.reduce((s, n) => s + n.ml, 0);
    const ingredientCost = notes.reduce((s, n) => s + n.ml * n.costPerMl, 0);

    // Concentration affects alcohol ratio and perceived quality
    const concMultiplier = concentration === "edt" ? 0.8 : concentration === "edp" ? 1.0 : 1.3;
    const alcoholCost = (bottleSize - totalMl) * 0.5;
    const bottleCost = bottleSize <= 30 ? 5 : bottleSize <= 50 ? 8 : 12;

    const unitCost = Math.round((ingredientCost * concMultiplier + alcoholCost + bottleCost + 3) * 100) / 100;

    // Complexity score
    const complexity = Math.min(100, notes.length * 12 + (balanced ? 20 : 0));

    // Longevity (base notes contribute more)
    const longevity = Math.min(100, baseNotes.reduce((s, n) => s + n.intensity * n.ml, 0) * 3 + heartNotes.reduce((s, n) => s + n.intensity * n.ml, 0));

    // Sillage (projection)
    const sillage = Math.min(100, topNotes.reduce((s, n) => s + n.intensity * n.ml, 0) * 4 + (concentration === "parfum" ? 20 : 0));

    const overallQuality = Math.round((complexity + longevity + sillage) / 3);

    return { notes, totalMl, unitCost, complexity, longevity, sillage, overallQuality, balanced, hasTop, hasHeart, hasBase };
  }, [selectedNotes, concentration, bottleSize]);

  const launchToMarket = () => {
    const p = calcPerfume();
    if (p.notes.length < 3) {
      toast.error("Select at least 3 ingredients!");
      return;
    }

    playSound("correct");

    // Simulate market response
    const qualityFactor = p.overallQuality / 100;
    const balanceBonus = p.balanced ? 1.2 : 0.8;
    const priceSweetSpot = retailPrice <= 120 ? 1.0 : retailPrice <= 200 ? 0.85 : 0.6;
    const demandRate = Math.min(0.95, qualityFactor * balanceBonus * priceSweetSpot);
    const unitsSold = Math.round(batchSize * demandRate);
    const revenue = unitsSold * retailPrice;
    const cost = batchSize * p.unitCost;

    setSalesResult({ unitsSold, revenue: Math.round(revenue), cost: Math.round(cost) });
    setStage("market");
  };

  const finishSim = async () => {
    const p = calcPerfume();
    const profit = salesResult.revenue - salesResult.cost;
    const qualityBonus = p.overallQuality >= 70 ? 15 : 0;
    const profitBonus = profit > 0 ? Math.min(25, Math.round(profit / 200)) : 0;
    const balanceBonus = p.balanced ? 10 : 0;
    const salesBonus = Math.round((salesResult.unitsSold / batchSize) * 20);
    const finalScore = 10 + qualityBonus + profitBonus + balanceBonus + salesBonus;

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: Object.keys(selectedNotes).length,
        decisions: { selectedNotes, concentration, bottleSize, retailPrice, targetAudience } as any,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("creation");
    setScore(0);
    setPerfumeName("");
    setConcentration("edp");
    setBottleSize(50);
    setSelectedNotes({});
    setRetailPrice(80);
    setTargetAudience("unisex");
    setBatchSize(200);
    setSalesResult({ unitsSold: 0, revenue: 0, cost: 0 });
  };

  const p = calcPerfume();
  const profit = salesResult.revenue - salesResult.cost;

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-2xl font-bold">{perfumeName || "Your Perfume"} — Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Quality</p><p className="text-lg font-bold">{p.overallQuality}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Sales</p><p className="text-lg font-bold">{salesResult.unitsSold}/{batchSize}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Revenue</p><p className="text-lg font-bold text-green-500">${salesResult.revenue}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Profit</p><p className={`text-lg font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p></div>
            </div>
          </CardContent>
        </Card>
        <FinancialBar title="📊 Financial Breakdown" data={[
          { label: "Revenue", value: salesResult.revenue, color: "hsl(142 71% 45%)" },
          { label: "Cost", value: salesResult.cost, color: "hsl(0 84% 60%)" },
          { label: "Profit", value: Math.max(0, profit), color: "hsl(var(--primary))" },
        ]} />
        <PerformanceRadar title="🧪 Fragrance Profile" data={[
          { metric: "Complexity", value: p.complexity },
          { metric: "Longevity", value: p.longevity },
          { metric: "Sillage", value: p.sillage },
          { metric: "Quality", value: p.overallQuality },
          { metric: "Sales Rate", value: Math.round((salesResult.unitsSold / batchSize) * 100) },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Create Again</Button>
      </div>
    );
  }

  if (stage === "market") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><Star className="h-6 w-6 text-amber-500" /> Market Results</h2>
        <Card className="border-amber-500/20">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-5xl">🧴</p>
              <h3 className="text-lg font-bold">{perfumeName || "Your Perfume"}</h3>
              <Badge variant="secondary">{concentration.toUpperCase()}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card><CardContent className="pt-3 text-center">
                <p className="text-2xl font-bold text-green-500">{salesResult.unitsSold}</p>
                <p className="text-xs text-muted-foreground">Units Sold / {batchSize}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 text-center">
                <p className="text-2xl font-bold text-green-500">${salesResult.revenue}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 text-center">
                <p className="text-2xl font-bold text-destructive">${salesResult.cost}</p>
                <p className="text-xs text-muted-foreground">Total Cost</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 text-center">
                <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>${profit}</p>
                <p className="text-xs text-muted-foreground">Profit</p>
              </CardContent></Card>
            </div>
          </CardContent>
        </Card>
        <Button onClick={finishSim} className="w-full" size="lg">🏆 Get Final Score</Button>
      </div>
    );
  }

  // Creation
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="h-6 w-6 text-amber-500" /> Perfume Lab</h2>
      <p className="text-sm text-muted-foreground">Craft a unique fragrance by selecting notes from top, heart, and base layers. Balance complexity, longevity, and cost.</p>

      <Card><CardContent className="pt-6 space-y-2">
        <span className="font-medium">🏷️ Perfume Name</span>
        <Input value={perfumeName} onChange={(e) => setPerfumeName(e.target.value)} placeholder="e.g., Midnight Bloom" />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🧪 Concentration</span>
        <Select value={concentration} onValueChange={(v: any) => setConcentration(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="edt">Eau de Toilette — Light, affordable</SelectItem>
            <SelectItem value="edp">Eau de Parfum — Balanced, popular</SelectItem>
            <SelectItem value="parfum">Parfum — Intense, premium</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🍶 Bottle Size</span><Badge variant="outline">{bottleSize}ml</Badge></div>
        <Slider value={[bottleSize]} onValueChange={([v]) => setBottleSize(v)} min={15} max={100} step={5} />
      </CardContent></Card>

      {/* Ingredients by layer */}
      {(["top", "heart", "base"] as const).map(layer => (
        <Card key={layer}>
          <CardContent className="pt-6 space-y-3">
            <span className="font-medium capitalize">
              {layer === "top" ? "🎵 Top Notes" : layer === "heart" ? "💗 Heart Notes" : "🪨 Base Notes"}
            </span>
            <div className="grid gap-2">
              {INGREDIENTS.filter(i => i.layer === layer).map(ing => {
                const isSelected = selectedNotes[ing.id] !== undefined;
                return (
                  <div key={ing.id} className={`rounded-lg border p-3 transition-all ${isSelected ? "border-primary bg-primary/5" : "border-muted"}`}>
                    <div className="flex items-center justify-between">
                      <Button variant={isSelected ? "default" : "outline"} size="sm" onClick={() => toggleNote(ing.id)}>
                        {isSelected ? "✓" : "+"} {ing.name}
                      </Button>
                      <span className="text-xs text-muted-foreground">${ing.costPerMl}/ml</span>
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs">Amount:</span>
                        <Slider value={[selectedNotes[ing.id]]} onValueChange={([v]) => setNoteAmount(ing.id, v)} min={1} max={8} step={0.5} className="flex-1" />
                        <Badge variant="outline">{selectedNotes[ing.id]}ml</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💰 Retail Price</span><Badge variant="outline">${retailPrice}</Badge></div>
        <Slider value={[retailPrice]} onValueChange={([v]) => setRetailPrice(v)} min={30} max={300} step={10} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">📦 Batch Size</span><Badge variant="outline">{batchSize} bottles</Badge></div>
        <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={50} max={1000} step={50} />
      </CardContent></Card>

      {/* Quality Preview */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium">📊 Fragrance Profile:</p>
          <div className="flex gap-3 text-xs">
            <span className={p.hasTop ? "text-green-500 font-bold" : "text-muted-foreground"}>Top {p.hasTop ? "✓" : "—"}</span>
            <span className={p.hasHeart ? "text-green-500 font-bold" : "text-muted-foreground"}>Heart {p.hasHeart ? "✓" : "—"}</span>
            <span className={p.hasBase ? "text-green-500 font-bold" : "text-muted-foreground"}>Base {p.hasBase ? "✓" : "—"}</span>
            {p.balanced && <Badge variant="default" className="text-[10px]">BALANCED ✨</Badge>}
          </div>
          <div className="space-y-1">
            {[
              { label: "Complexity", value: p.complexity },
              { label: "Longevity", value: p.longevity },
              { label: "Sillage", value: p.sillage },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-xs w-20">{m.label}</span>
                <Progress value={m.value} className="flex-1 h-2" />
                <span className="text-xs font-mono w-8">{m.value}%</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span>Quality: <strong>{p.overallQuality}%</strong></span>
            <span>Unit Cost: <strong>${p.unitCost}</strong></span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={launchToMarket} className="w-full text-base" size="lg" disabled={Object.keys(selectedNotes).length < 3}>
        🚀 Launch to Market
      </Button>
    </div>
  );
}
