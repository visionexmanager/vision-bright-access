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
import { Input } from "@/components/ui/input";
import { CheckCircle2, FlaskConical, Droplets, RotateCcw, DollarSign, Star, Beaker, Thermometer, ArrowLeft } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { SimulationMentor } from "@/components/SimulationMentor";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";
import { SimulationScene } from "@/components/SimulationScene";

type Stage = "formulation" | "production" | "testing" | "results";

type Props = { simulationId?: string };

export function DetergentLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce } = useScreenReader();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("formulation");
  const [score, setScore] = useState(0);

  // Formulation
  const [surfactantPct, setSurfactantPct] = useState(25);
  const [waterPct, setWaterPct] = useState(60);
  const [fragrancePct, setFragrancePct] = useState(5);
  const [additiveType, setAdditiveType] = useState<"none" | "softener" | "bleach" | "enzyme">("none");
  const [mixTemp, setMixTemp] = useState(40);
  const [mixDuration, setMixDuration] = useState(15);
  const [brandName, setBrandName] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState(3.5);
  const [batchSize, setBatchSize] = useState(100);

  // Results
  const [cleaningPower, setCleaningPower] = useState(0);
  const [foamLevel, setFoamLevel] = useState(0);
  const [safetyRating, setSafetyRating] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [testResults, setTestResults] = useState<{ test: string; pass: boolean; detail: string }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const fillerPct = Math.max(0, 100 - surfactantPct - waterPct - fragrancePct);
  const totalPct = surfactantPct + waterPct + fragrancePct;

  const calcFormula = useCallback(() => {
    // Cleaning power based on surfactant concentration
    const cleaning = Math.min(100, surfactantPct * 3 + (additiveType === "enzyme" ? 15 : additiveType === "bleach" ? 10 : 0));

    // Foam
    const foam = Math.min(100, surfactantPct * 2.5 + (mixTemp > 50 ? -10 : 5) + (additiveType === "softener" ? 15 : 0));

    // Safety (too much surfactant or bleach = lower safety)
    const safety = Math.max(0, 100 - (surfactantPct > 35 ? (surfactantPct - 35) * 3 : 0) - (additiveType === "bleach" ? 15 : 0) - (fragrancePct > 10 ? 10 : 0));

    // Cost
    const surfactantCost = surfactantPct * 0.08;
    const fragranceCost = fragrancePct * 0.12;
    const additiveCost = additiveType === "none" ? 0 : additiveType === "softener" ? 0.3 : additiveType === "bleach" ? 0.2 : 0.5;
    const energyCost = (mixTemp / 100) * 0.15 + (mixDuration / 60) * 0.1;
    const unitCost = Math.round((surfactantCost + fragranceCost + additiveCost + energyCost + 0.5) * 100) / 100;

    const profit = Math.round((pricePerUnit - unitCost) * batchSize * 100) / 100;

    return { cleaning, foam, safety, unitCost, profit };
  }, [surfactantPct, fragrancePct, additiveType, mixTemp, mixDuration, pricePerUnit, batchSize]);

  const startProduction = () => {
    if (totalPct > 100) {
      toast.error(t("sim.detergent.error.totalExceeds"));
      return;
    }
    playSound("correct");
    announce(t("sim.common.correct"));
    setStage("production");
    const m = calcFormula();
    setCleaningPower(m.cleaning);
    setFoamLevel(m.foam);
    setSafetyRating(m.safety);
    setCostPerUnit(m.unitCost);
    setTotalProfit(m.profit);
  };

  const runTests = () => {
    playSound("bubble");
    const results = [
      { test: t("sim.detergent.tests.cleaningEfficacy"), pass: cleaningPower >= 60, detail: `${cleaningPower}% — ${cleaningPower >= 60 ? t("sim.detergent.result.pass") : t("sim.detergent.result.belowThreshold")}` },
      { test: t("sim.detergent.tests.foamStability"), pass: foamLevel >= 50, detail: `${foamLevel}% — ${foamLevel >= 50 ? t("sim.detergent.result.stable") : t("sim.detergent.result.unstable")}` },
      { test: t("sim.detergent.tests.safetyCompliance"), pass: safetyRating >= 70, detail: `${safetyRating}% — ${safetyRating >= 70 ? t("sim.detergent.result.compliant") : t("sim.detergent.result.nonCompliant")}` },
      { test: t("sim.detergent.tests.phBalance"), pass: surfactantPct <= 35, detail: surfactantPct <= 35 ? t("sim.detergent.result.phNeutral") : t("sim.detergent.result.phAlkaline") },
      { test: t("sim.detergent.tests.costViability"), pass: totalProfit > 0, detail: `$${totalProfit} — ${totalProfit > 0 ? t("sim.detergent.result.profitable") : t("sim.detergent.result.lossMaking")}` },
    ];
    setTestResults(results);
    setStage("testing");
  };

  const finishSim = async () => {
    const passCount = testResults.filter(r => r.pass).length;
    const qualityScore = Math.round((cleaningPower + foamLevel + safetyRating) / 3);
    const profitBonus = totalProfit > 0 ? Math.min(25, Math.round(totalProfit / 20)) : 0;
    const finalScore = passCount * 10 + profitBonus + (qualityScore >= 70 ? 15 : 0);

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");
    announce(`Simulation complete! Final score: ${finalScore}`);

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 4,
        decisions: { surfactantPct, waterPct, fragrancePct, additiveType, mixTemp, mixDuration, pricePerUnit, batchSize } as Record<string, unknown>,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("formulation");
    setScore(0);
    setSurfactantPct(25);
    setWaterPct(60);
    setFragrancePct(5);
    setAdditiveType("none");
    setMixTemp(40);
    setMixDuration(15);
    setBrandName("");
    setPricePerUnit(3.5);
    setBatchSize(100);
    setTestResults([]);
  };

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">{t("sim.detergent.results.completeTitle").replace("{name}", brandName || t("sim.detergent.title").replace(" 🧼",""))}</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.detergent.card.cleaning")}</p><p className="text-lg font-bold">{cleaningPower}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.detergent.card.safety")}</p><p className="text-lg font-bold">{safetyRating}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.detergent.card.unitCost")}</p><p className="text-lg font-bold">${costPerUnit}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.detergent.card.profit")}</p><p className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-500" : "text-destructive"}`}>${totalProfit}</p></div>
            </div>
          </CardContent>
        </Card>
        <PerformanceRadar title={t("sim.detergent.chart.qualityProfile")} data={[
          { metric: t("sim.detergent.card.cleaning"), value: cleaningPower },
          { metric: "Foam", value: foamLevel },
          { metric: t("sim.detergent.card.safety"), value: safetyRating },
          { metric: t("sim.detergent.metric.costEfficiency"), value: Math.min(100, Math.max(0, Math.round((1 - costPerUnit / pricePerUnit) * 100))) },
          { metric: t("sim.detergent.metric.profitability"), value: Math.min(100, Math.max(0, Math.round((totalProfit / Math.max(1, pricePerUnit * batchSize)) * 100))) },
        ]} />
        <FinancialBar title={t("sim.detergent.chart.batchEconomics")} data={[
          { label: t("sim.detergent.label.revenue"), value: Math.round(pricePerUnit * batchSize), color: "hsl(142 71% 45%)" },
          { label: t("sim.detergent.label.cost"), value: Math.round(costPerUnit * batchSize), color: "hsl(0 84% 60%)" },
          { label: t("sim.detergent.card.profit"), value: Math.max(0, totalProfit), color: "hsl(var(--primary))" },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> {t("sim.detergent.btn.tryAgain")}</Button>
      </div>
    );
  }

  if (stage === "testing") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><Beaker className="h-6 w-6 text-primary" /> {t("sim.detergent.stage.testing")}</h2>
        <div className="space-y-3">
          {testResults.map((r, i) => (
            <Card key={i} className={r.pass ? "border-green-500/30" : "border-destructive/30"}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.test}</p>
                  <p className="text-sm text-muted-foreground">{r.detail}</p>
                </div>
                {r.pass ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <span className="text-destructive font-bold">✗</span>}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">{t("sim.detergent.testsPassedOf").replace("{pass}", String(testResults.filter(r => r.pass).length)).replace("{total}", String(testResults.length))}</p>
        <Button onClick={finishSim} className="w-full" size="lg" aria-label={t("sim.detergent.btn.finishScore")}>🏁 {t("sim.detergent.btn.finishScore")}</Button>
      </div>
    );
  }

  if (stage === "production") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="h-6 w-6 text-primary" /> {t("sim.detergent.stage.production")}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 mx-auto text-primary" />
            <p className="text-lg font-bold">{cleaningPower}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.cleaningPower")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Droplets className="h-5 w-5 mx-auto text-blue-500" />
            <p className="text-lg font-bold">{foamLevel}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.foamLevel")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold">{safetyRating}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.safety")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-yellow-500" />
            <p className="text-lg font-bold">${costPerUnit}</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.costPerUnit")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500" />
            <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-500" : "text-destructive"}`}>${totalProfit}</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.totalProfit")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Beaker className="h-5 w-5 mx-auto text-purple-500" />
            <p className="text-lg font-bold">{batchSize}</p>
            <p className="text-xs text-muted-foreground">{t("sim.detergent.metric.batchSize")}</p>
          </CardContent></Card>
        </div>

        {/* Formula breakdown */}
        <Card className="border-primary/20">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">{t("sim.detergent.section.formulaBreakdown")}</p>
            <div className="flex gap-1 h-6 rounded-full overflow-hidden">
              <div className="bg-blue-500 transition-all" style={{ width: `${waterPct}%` }} title={`${t("sim.detergent.ingredient.water")} ${waterPct}%`} />
              <div className="bg-yellow-500 transition-all" style={{ width: `${surfactantPct}%` }} title={`${t("sim.detergent.ingredient.surfactant")} ${surfactantPct}%`} />
              <div className="bg-pink-400 transition-all" style={{ width: `${fragrancePct}%` }} title={`${t("sim.detergent.ingredient.fragrance")} ${fragrancePct}%`} />
              <div className="bg-muted-foreground/30 transition-all" style={{ width: `${fillerPct}%` }} title={`${t("sim.detergent.ingredient.filler")} ${fillerPct}%`} />
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{t("sim.detergent.ingredient.water")} {waterPct}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />{t("sim.detergent.ingredient.surfactant")} {surfactantPct}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400" />{t("sim.detergent.ingredient.fragrance")} {fragrancePct}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" />{t("sim.detergent.ingredient.filler")} {fillerPct}%</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => setStage("formulation")} variant="outline" className="flex-1">{t("sim.detergent.btn.adjustFormula")}</Button>
          <Button onClick={runTests} className="flex-1" aria-label={t("sim.detergent.btn.runTests")}>🧪 {t("sim.detergent.btn.runTests")}</Button>
        </div>
      </div>
    );
  }

  // Formulation stage
  return (
    <div className="space-y-6">
      <SimulationScene slug="detergent-lab" isActive={score > 0} isComplete={tested} />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" /> {t("sim.detergent.title")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("sim.detergent.label.description")}</p>

      {/* Brand Name */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <span className="font-medium">{t("sim.detergent.label.brandName")}</span>
          <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={t("sim.detergent.placeholder.brandName")} />
        </CardContent>
      </Card>

      {/* Surfactant */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between"><span className="font-medium">{t("sim.detergent.label.surfactant")}</span><Badge variant="outline">{surfactantPct}%</Badge></div>
          <Slider value={[surfactantPct]} onValueChange={([v]) => setSurfactantPct(v)} min={10} max={45} step={1} />
          <p className="text-xs text-muted-foreground">{t("sim.detergent.hint.surfactant")}</p>
        </CardContent>
      </Card>

      {/* Water */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between"><span className="font-medium">{t("sim.detergent.label.water")}</span><Badge variant="outline">{waterPct}%</Badge></div>
          <Slider value={[waterPct]} onValueChange={([v]) => setWaterPct(v)} min={40} max={80} step={1} />
        </CardContent>
      </Card>

      {/* Fragrance */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between"><span className="font-medium">{t("sim.detergent.label.fragrance")}</span><Badge variant="outline">{fragrancePct}%</Badge></div>
          <Slider value={[fragrancePct]} onValueChange={([v]) => setFragrancePct(v)} min={0} max={15} step={1} />
        </CardContent>
      </Card>

      {totalPct > 100 && <p className="text-destructive text-sm font-medium">{t("sim.detergent.warning.exceeds").replace("{pct}", String(totalPct))}</p>}

      {/* Additive */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <span className="font-medium">{t("sim.detergent.label.additive")}</span>
          <Select value={additiveType} onValueChange={(v: any) => setAdditiveType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("sim.detergent.additive.none")}</SelectItem>
              <SelectItem value="softener">{t("sim.detergent.additive.softener")}</SelectItem>
              <SelectItem value="bleach">{t("sim.detergent.additive.bleach")}</SelectItem>
              <SelectItem value="enzyme">{t("sim.detergent.additive.enzyme")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mix Temperature */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium flex items-center gap-1"><Thermometer className="h-4 w-4" /> Mix Temp</span>
            <Badge variant="outline">{mixTemp}°C</Badge>
          </div>
          <Slider value={[mixTemp]} onValueChange={([v]) => setMixTemp(v)} min={20} max={80} step={5} />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between"><span className="font-medium">💰 Price per Unit</span><Badge variant="outline">${pricePerUnit}</Badge></div>
          <Slider value={[pricePerUnit * 10]} onValueChange={([v]) => setPricePerUnit(v / 10)} min={15} max={80} step={5} />
        </CardContent>
      </Card>

      {/* Batch Size */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between"><span className="font-medium">📦 Batch Size</span><Badge variant="outline">{batchSize} units</Badge></div>
          <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={50} max={500} step={50} />
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">📊 Estimated Results:</p>
          {(() => {
            const m = calcFormula();
            return (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Cleaning: <strong>{m.cleaning}%</strong></span>
                <span>Foam: <strong>{m.foam}%</strong></span>
                <span>Safety: <strong>{m.safety}%</strong></span>
                <span>Cost/Unit: <strong>${m.unitCost}</strong></span>
                <span className="col-span-2">Profit: <strong className={m.profit >= 0 ? "text-green-500" : "text-destructive"}>${m.profit}</strong></span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

            <SimulationMentor simulationTitle="Detergent Lab" currentStepTitle="" />

      <Button onClick={startProduction} className="w-full text-base" size="lg" disabled={totalPct > 100} aria-label="Start Production">
        🏭 Start Production
      </Button>
    </div>
  );
}
