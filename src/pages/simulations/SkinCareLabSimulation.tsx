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
import { CheckCircle2, RotateCcw, DollarSign, Star, Heart, Sparkles, ShieldCheck, Droplets, ArrowLeft } from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";
import { SimulationMentor } from "@/components/SimulationMentor";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";
import { SimulationScene } from "@/components/SimulationScene";

type Stage = "formulation" | "clinic" | "results";

type SkinType = "normal" | "oily" | "dry" | "sensitive";

type Props = { simulationId?: string };

export function SkinCareLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce, announceUrgent } = useScreenReader();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("formulation");
  const [score, setScore] = useState(0);

  // Formulation
  const [productName, setProductName] = useState("");
  const [skinTarget, setSkinTarget] = useState<SkinType>("normal");
  const [hyaluronicAcid, setHyaluronicAcid] = useState(2);
  const [vitaminC, setVitaminC] = useState(10);
  const [niacinamide, setNiacinamide] = useState(5);
  const [retinol, setRetinol] = useState(0);
  const [spf, setSpf] = useState(30);
  const [pricePoint, setPricePoint] = useState(25);
  const [packageType, setPackageType] = useState<"basic" | "premium" | "luxury">("premium");

  // Clinic simulation
  const [clientIndex, setClientIndex] = useState(0);
  const [clientFeedback, setClientFeedback] = useState<{ satisfaction: number; comment: string }[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const clients = [
    { name: "Sarah", skin: "oily" as SkinType, concern: "Acne & large pores", budget: 35 },
    { name: "James", skin: "dry" as SkinType, concern: "Fine lines & dryness", budget: 40 },
    { name: "Mia", skin: "sensitive" as SkinType, concern: "Redness & irritation", budget: 30 },
    { name: "Omar", skin: "normal" as SkinType, concern: "Anti-aging prevention", budget: 50 },
    { name: "Lisa", skin: "oily" as SkinType, concern: "Dark spots & uneven tone", budget: 45 },
  ];

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const calcProductQuality = useCallback(() => {
    let hydration = hyaluronicAcid * 15 + (skinTarget === "dry" ? 10 : 0);
    let brightening = vitaminC * 5 + niacinamide * 3;
    let antiAging = retinol * 20 + vitaminC * 2;
    let gentleness = 100 - retinol * 15 - (vitaminC > 15 ? 15 : 0);
    let sunProtection = spf >= 50 ? 100 : spf >= 30 ? 75 : spf >= 15 ? 50 : 20;

    // Safety check
    if (retinol > 1 && vitaminC > 15) gentleness -= 20; // bad combo

    hydration = Math.min(100, Math.max(0, hydration));
    brightening = Math.min(100, Math.max(0, brightening));
    antiAging = Math.min(100, Math.max(0, antiAging));
    gentleness = Math.min(100, Math.max(0, gentleness));

    const overallQuality = Math.round((hydration + brightening + antiAging + gentleness + sunProtection) / 5);

    const ingredientCost = hyaluronicAcid * 2 + vitaminC * 0.5 + niacinamide * 0.3 + retinol * 5 + spf * 0.1;
    const packagingCost = packageType === "basic" ? 2 : packageType === "premium" ? 5 : 10;
    const unitCost = Math.round((ingredientCost + packagingCost + 3) * 100) / 100;

    return { hydration, brightening, antiAging, gentleness, sunProtection, overallQuality, unitCost };
  }, [hyaluronicAcid, vitaminC, niacinamide, retinol, spf, skinTarget, packageType]);

  const matchClient = (client: typeof clients[0]) => {
    const q = calcProductQuality();
    let satisfaction = 50;

    // Skin type match
    if (skinTarget === client.skin) satisfaction += 15;
    else satisfaction -= 10;

    // Quality factors
    if (client.concern.includes("Acne")) satisfaction += q.gentleness > 70 ? 10 : -10;
    if (client.concern.includes("lines") || client.concern.includes("aging")) satisfaction += q.antiAging > 50 ? 15 : -5;
    if (client.concern.includes("dryness")) satisfaction += q.hydration > 60 ? 15 : -10;
    if (client.concern.includes("Redness")) satisfaction += q.gentleness > 80 ? 15 : -15;
    if (client.concern.includes("Dark spots")) satisfaction += q.brightening > 60 ? 15 : -5;

    // Price match
    if (pricePoint <= client.budget) satisfaction += 10;
    else satisfaction -= (pricePoint - client.budget);

    // Packaging perception
    if (packageType === "luxury") satisfaction += 5;

    satisfaction = Math.min(100, Math.max(10, satisfaction));

    const comments: Record<string, string> = {
      high: t("sim.skincare.feedback.excellent"),
      good: t("sim.skincare.feedback.good"),
      ok: t("sim.skincare.feedback.average"),
      bad: t("sim.skincare.feedback.poor"),
    };

    const comment = satisfaction >= 80 ? comments.high : satisfaction >= 60 ? comments.good : satisfaction >= 40 ? comments.ok : comments.bad;
    return { satisfaction, comment };
  };

  const startClinic = () => {
    playSound("spray");
    announce("Correct! Well done.");
    setStage("clinic");
    setClientIndex(0);
    setClientFeedback([]);
    setTotalRevenue(0);
  };

  const serveClient = () => {
    const client = clients[clientIndex];
    const result = matchClient(client);
    const bought = result.satisfaction >= 50;

    setClientFeedback(prev => [...prev, result]);
    if (bought) setTotalRevenue(prev => prev + pricePoint);

    if (result.satisfaction >= 60) {
      playSound("correct");
      announce("Correct! Well done.");
    } else {
      playSound("wrong");
      announceUrgent("Incorrect. Try again.");
    }
    toast(bought ? `${client.name} purchased! +$${pricePoint}` : `${client.name} declined.`);

    if (clientIndex + 1 >= clients.length) {
      setTimeout(() => finishSim(result), 500);
    } else {
      setClientIndex(prev => prev + 1);
    }
  };

  const finishSim = async (_lastResult?: { satisfaction: number }) => {
    const q = calcProductQuality();
    const avgSatisfaction = clientFeedback.length > 0
      ? Math.round(clientFeedback.reduce((s, f) => s + f.satisfaction, 0) / clientFeedback.length)
      : 50;
    const purchases = clientFeedback.filter(f => f.satisfaction >= 50).length;
    const profit = totalRevenue - q.unitCost * purchases;

    const qualityBonus = q.overallQuality >= 70 ? 15 : 0;
    const satisfactionBonus = avgSatisfaction >= 70 ? 15 : 0;
    const profitBonus = profit > 0 ? Math.min(20, Math.round(profit / 5)) : 0;
    const salesBonus = purchases * 5;
    const finalScore = qualityBonus + satisfactionBonus + profitBonus + salesBonus + 10;

    setScore(finalScore);
    setStage("results");
    playSound("levelUp");
    announce("Simulation complete!");

    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: clients.length,
        decisions: { skinTarget, hyaluronicAcid, vitaminC, niacinamide, retinol, spf, pricePoint, packageType } as Record<string, unknown>,
        score: finalScore,
        completed: true,
      });
    }
  };

  const reset = () => {
    setStage("formulation");
    setScore(0);
    setProductName("");
    setSkinTarget("normal");
    setHyaluronicAcid(2);
    setVitaminC(10);
    setNiacinamide(5);
    setRetinol(0);
    setSpf(30);
    setPricePoint(25);
    setPackageType("premium");
    setClientIndex(0);
    setClientFeedback([]);
    setTotalRevenue(0);
  };

  if (stage === "results") {
    const q = calcProductQuality();
    const avgSat = clientFeedback.length > 0 ? Math.round(clientFeedback.reduce((s, f) => s + f.satisfaction, 0) / clientFeedback.length) : 0;
    const purchases = clientFeedback.filter(f => f.satisfaction >= 50).length;

    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">{t("sim.skincare.results.title").replace("{name}", productName || "Your Serum")}</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.skincare.metric.quality")}</p><p className="text-lg font-bold">{q.overallQuality}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.skincare.metric.satisfaction")}</p><p className="text-lg font-bold">{avgSat}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.skincare.metric.sales")}</p><p className="text-lg font-bold">{purchases}/{clients.length}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">{t("sim.skincare.metric.revenue")}</p><p className="text-lg font-bold text-green-500">${totalRevenue}</p></div>
            </div>
          </CardContent>
        </Card>
        <PerformanceRadar title={`🧴 ${t("sim.skincare.chart.performance")}`} data={[
          { metric: t("sim.skincare.metric.hydration"), value: q.hydration },
          { metric: t("sim.skincare.metric.brightening"), value: q.brightening },
          { metric: t("sim.skincare.metric.antiAging"), value: q.antiAging },
          { metric: t("sim.skincare.metric.sunProtection"), value: q.sunProtection },
          { metric: t("sim.skincare.metric.satisfaction"), value: avgSat },
        ]} />
        {clientFeedback.length > 0 && (
          <FinancialBar title={`😊 ${t("sim.skincare.chart.satisfaction")}`} data={clientFeedback.map((f, i) => ({
            label: clients[i]?.name?.split(" ")[0] || `Client ${i+1}`,
            value: f.satisfaction,
            color: f.satisfaction >= 70 ? "hsl(142 71% 45%)" : f.satisfaction >= 50 ? "hsl(45 93% 47%)" : "hsl(0 84% 60%)",
          }))} />
        )}
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> {t("sim.skincare.btn.tryAgain")}</Button>
      </div>
    );
  }

  if (stage === "clinic") {
    const client = clients[clientIndex];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2"><Heart className="h-6 w-6 text-pink-500" /> {t("sim.skincare.label.clientProgress").replace("{current}", String(clientIndex + 1)).replace("{total}", String(clients.length))}</h2>
          <Badge variant="secondary" role="status" aria-live="polite">${totalRevenue} {t("sim.skincare.label.earned")}</Badge>
        </div>
        <Progress value={((clientIndex) / clients.length) * 100} className="h-2" />

        <Card className="border-primary/30">
          <CardContent className="pt-6 space-y-4 text-center">
            <p className="text-4xl">👤</p>
            <h3 className="text-lg font-bold">{client.name}</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">{t("sim.skincare.label.skin")} {client.skin}</Badge>
              <Badge variant="outline">{t("sim.skincare.label.budget")} ${client.budget}</Badge>
            </div>
            <p className="text-muted-foreground">"{client.concern}"</p>
            <p className="text-sm">Your product: <strong>{productName || "Serum"}</strong> at <strong>${pricePoint}</strong></p>
          </CardContent>
        </Card>

        {clientFeedback[clientIndex - 1] && (
          <Card className={clientFeedback[clientIndex - 1].satisfaction >= 50 ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
            <CardContent className="pt-4 text-center">
              <p className="text-sm">{clients[clientIndex - 1]?.name}: {clientFeedback[clientIndex - 1].comment}</p>
            </CardContent>
          </Card>
        )}

        <Button onClick={serveClient} className="w-full" size="lg" aria-label={t("sim.skincare.btn.offerProduct").replace("{name}", client.name)}>
          💁 {t("sim.skincare.btn.offerProduct").replace("{name}", client.name)}
        </Button>
      </div>
    );
  }

  // Formulation
  const q = calcProductQuality();
  return (
    <div className="space-y-6">
      <SimulationScene slug="skin-care-lab" isActive={clientIndex > 0} isComplete={finished} />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> {t("sim.skincare.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("sim.skincare.description")}</p>

      <Card><CardContent className="pt-6 space-y-2">
        <span className="font-medium">🏷️ {t("sim.skincare.label.productName")}</span>
        <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t("sim.skincare.placeholder.productName")} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🎯 {t("sim.skincare.label.skinType")}</span>
        <Select value={skinTarget} onValueChange={(v: any) => setSkinTarget(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">{t("sim.skincare.skinType.normal")}</SelectItem>
            <SelectItem value="oily">{t("sim.skincare.skinType.oily")}</SelectItem>
            <SelectItem value="dry">{t("sim.skincare.skinType.dry")}</SelectItem>
            <SelectItem value="sensitive">{t("sim.skincare.skinType.sensitive")}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💧 {t("sim.skincare.label.hyaluronicAcid")}</span><Badge variant="outline">{hyaluronicAcid}%</Badge></div>
        <Slider value={[hyaluronicAcid]} onValueChange={([v]) => setHyaluronicAcid(v)} min={0} max={5} step={0.5} />
        <p className="text-xs text-muted-foreground">{t("sim.skincare.hint.hyaluronicAcid")}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🍊 {t("sim.skincare.label.vitaminC")}</span><Badge variant="outline">{vitaminC}%</Badge></div>
        <Slider value={[vitaminC]} onValueChange={([v]) => setVitaminC(v)} min={0} max={20} step={1} />
        <p className="text-xs text-muted-foreground">{t("sim.skincare.hint.vitaminC")}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">✨ {t("sim.skincare.label.niacinamide")}</span><Badge variant="outline">{niacinamide}%</Badge></div>
        <Slider value={[niacinamide]} onValueChange={([v]) => setNiacinamide(v)} min={0} max={10} step={1} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">🔬 {t("sim.skincare.label.retinol")}</span><Badge variant="outline">{retinol}%</Badge></div>
        <Slider value={[retinol]} onValueChange={([v]) => setRetinol(v)} min={0} max={2} step={0.1} />
        <p className="text-xs text-muted-foreground">{t("sim.skincare.hint.retinol")}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">☀️ {t("sim.skincare.label.spf")}</span><Badge variant="outline">SPF {spf}</Badge></div>
        <Slider value={[spf]} onValueChange={([v]) => setSpf(v)} min={0} max={50} step={5} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📦 {t("sim.skincare.label.packaging")}</span>
        <Select value={packageType} onValueChange={(v: any) => setPackageType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">{t("sim.skincare.packaging.basic")}</SelectItem>
            <SelectItem value="premium">{t("sim.skincare.packaging.premium")}</SelectItem>
            <SelectItem value="luxury">{t("sim.skincare.packaging.luxury")}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💰 {t("sim.skincare.label.price")}</span><Badge variant="outline">${pricePoint}</Badge></div>
        <Slider value={[pricePoint]} onValueChange={([v]) => setPricePoint(v)} min={10} max={80} step={5} />
      </CardContent></Card>

      {/* Quality Preview */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium">📊 {t("sim.skincare.section.analysis")}:</p>
          <div className="space-y-2">
            {[
              { label: t("sim.skincare.metric.hydration"), value: q.hydration, icon: <Droplets className="h-3 w-3" /> },
              { label: t("sim.skincare.metric.brightening"), value: q.brightening, icon: <Star className="h-3 w-3" /> },
              { label: t("sim.skincare.metric.antiAging"), value: q.antiAging, icon: <Sparkles className="h-3 w-3" /> },
              { label: "Gentleness", value: q.gentleness, icon: <Heart className="h-3 w-3" /> },
              { label: t("sim.skincare.metric.sunProtection"), value: q.sunProtection, icon: <ShieldCheck className="h-3 w-3" /> },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                {m.icon}
                <span className="text-xs w-24">{m.label}</span>
                <Progress value={m.value} className="flex-1 h-2" />
                <span className="text-xs font-mono w-8">{m.value}%</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm pt-2 border-t">
            <span>{t("sim.skincare.label.overall")} <strong>{q.overallQuality}%</strong></span>
            <span>{t("sim.skincare.label.unitCost")} <strong>${q.unitCost}</strong></span>
          </div>
        </CardContent>
      </Card>

            <SimulationMentor simulationTitle={t("sim.skincare.title")} currentStepTitle="" />

      <Button onClick={startClinic} className="w-full text-base" size="lg" aria-label={t("sim.skincare.btn.openClinic").replace("{n}", String(clients.length))}>
        🏥 {t("sim.skincare.btn.openClinic").replace("{n}", String(clients.length))}
      </Button>
    </div>
  );
}
