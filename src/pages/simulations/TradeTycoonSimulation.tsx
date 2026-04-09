import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSound } from "@/contexts/SoundContext";
import { FinancialBar } from "@/components/SimulationCharts";
import { toast } from "sonner";

export function TradeTycoonSimulation({ simulationId }: { simulationId?: string }) {
  const { playSound } = useSound();
  const [step, setStep] = useState(0);
  const [capital, setCapital] = useState(50000);
  const [inventory, setInventory] = useState(50);
  const [marketing, setMarketing] = useState(30);
  const [staff, setStaff] = useState(3);
  const [results, setResults] = useState<any>(null);

  const steps = [
    { title: "Initial Capital Allocation", desc: "How much starting capital to invest in your trading business?" },
    { title: "Inventory Strategy", desc: "What percentage of capital goes to product inventory?" },
    { title: "Marketing Budget", desc: "Set your marketing budget percentage" },
    { title: "Staffing Level", desc: "How many sales staff to hire?" },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) { setStep(step + 1); playSound("navigate"); }
    else {
      const revenue = capital * (inventory / 100) * 2.5 + marketing * 500 + staff * 8000;
      const costs = capital * 0.3 + staff * 4000 + marketing * 200;
      const profit = revenue - costs;
      const reputation = Math.min(100, 40 + marketing + staff * 5);
      const score = Math.round(profit / 100 + reputation);
      setResults({ revenue: Math.round(revenue), costs: Math.round(costs), profit: Math.round(profit), reputation, score });
      playSound("success");
      toast.success(`Simulation complete! Score: ${score}`);
    }
  };

  if (results) {
    return (
      <Layout>
        <section className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold text-center mb-6">📈 Trade Tycoon — Results</h1>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-primary">${results.revenue.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Profit</p><p className="text-2xl font-bold text-primary">${results.profit.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Reputation</p><p className="text-2xl font-bold">{results.reputation}%</p></CardContent></Card>
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
        <h1 className="text-3xl font-bold text-center mb-2">📈 Trade Tycoon Simulation</h1>
        <p className="text-center text-muted-foreground mb-8">Step {step + 1} of {steps.length}</p>
        <Card>
          <CardHeader><CardTitle>{steps[step].title}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{steps[step].desc}</p>
            {step === 0 && <div><p className="mb-2 font-medium">Capital: ${capital.toLocaleString()}</p><Slider value={[capital]} onValueChange={([v]) => setCapital(v)} min={10000} max={200000} step={5000} /></div>}
            {step === 1 && <div><p className="mb-2 font-medium">Inventory: {inventory}%</p><Slider value={[inventory]} onValueChange={([v]) => setInventory(v)} min={10} max={90} /></div>}
            {step === 2 && <div><p className="mb-2 font-medium">Marketing: {marketing}%</p><Slider value={[marketing]} onValueChange={([v]) => setMarketing(v)} min={5} max={60} /></div>}
            {step === 3 && <div><p className="mb-2 font-medium">Staff: {staff}</p><Slider value={[staff]} onValueChange={([v]) => setStaff(v)} min={1} max={15} /></div>}
            <Button className="w-full" size="lg" onClick={handleNext}>{step < steps.length - 1 ? "Next →" : "Run Simulation 🚀"}</Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
