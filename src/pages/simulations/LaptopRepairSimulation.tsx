import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSound } from "@/contexts/SoundContext";
import { FinancialBar } from "@/components/SimulationCharts";
import { toast } from "sonner";

export function LaptopRepairSimulation({ simulationId }: { simulationId?: string }) {
  const { playSound } = useSound();
  const [step, setStep] = useState(0);
  const [tools, setTools] = useState(5000);
  const [pricing, setPricing] = useState(50);
  const [training, setTraining] = useState(30);
  const [warranty, setWarranty] = useState(6);
  const [results, setResults] = useState<any>(null);

  const steps = [
    { title: "Tool Investment", desc: "How much to invest in repair tools and equipment?" },
    { title: "Service Pricing", desc: "Set your average repair price ($)" },
    { title: "Training Hours", desc: "Monthly hours spent on technician training" },
    { title: "Warranty Period", desc: "How many months warranty on repairs?" },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) { setStep(step + 1); playSound("navigate"); }
    else {
      const customers = Math.round(100 + training * 2 - pricing * 0.5 + warranty * 3);
      const revenue = customers * pricing;
      const costs = tools * 0.1 + training * 50 + warranty * 200;
      const profit = revenue - costs;
      const satisfaction = Math.min(100, 50 + training + warranty * 5 - pricing * 0.3);
      const score = Math.round(profit / 50 + satisfaction);
      setResults({ revenue: Math.round(revenue), costs: Math.round(costs), profit: Math.round(profit), satisfaction: Math.round(satisfaction), customers, score });
      playSound("success");
      toast.success(`Simulation complete! Score: ${score}`);
    }
  };

  if (results) {
    return (
      <Layout>
        <section className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold text-center mb-6">🔧 Laptop Repair Lab — Results</h1>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Customers</p><p className="text-2xl font-bold text-primary">{results.customers}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-primary">${results.revenue.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Satisfaction</p><p className="text-2xl font-bold">{results.satisfaction}%</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Score</p><p className="text-2xl font-bold">{results.score}</p></CardContent></Card>
          </div>
          <FinancialBar title="Financial Overview" data={[
            { label: "Revenue", value: results.revenue },
            { label: "Costs", value: results.costs },
            { label: "Profit", value: results.profit },
          ]} />
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-center mb-2">🔧 Laptop Repair Lab</h1>
        <p className="text-center text-muted-foreground mb-8">Step {step + 1} of {steps.length}</p>
        <Card>
          <CardHeader><CardTitle>{steps[step].title}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{steps[step].desc}</p>
            {step === 0 && <div><p className="mb-2 font-medium">Tools: ${tools.toLocaleString()}</p><Slider value={[tools]} onValueChange={([v]) => setTools(v)} min={1000} max={20000} step={500} /></div>}
            {step === 1 && <div><p className="mb-2 font-medium">Price: ${pricing}</p><Slider value={[pricing]} onValueChange={([v]) => setPricing(v)} min={20} max={200} /></div>}
            {step === 2 && <div><p className="mb-2 font-medium">Training: {training}h/month</p><Slider value={[training]} onValueChange={([v]) => setTraining(v)} min={0} max={80} /></div>}
            {step === 3 && <div><p className="mb-2 font-medium">Warranty: {warranty} months</p><Slider value={[warranty]} onValueChange={([v]) => setWarranty(v)} min={1} max={24} /></div>}
            <Button className="w-full" size="lg" onClick={handleNext}>{step < steps.length - 1 ? "Next →" : "Run Simulation 🚀"}</Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
