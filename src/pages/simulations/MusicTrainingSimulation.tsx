import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSound } from "@/contexts/SoundContext";
import { FinancialBar } from "@/components/SimulationCharts";
import { toast } from "sonner";

export function MusicTrainingSimulation({ simulationId }: { simulationId?: string }) {
  const { playSound } = useSound();
  const [step, setStep] = useState(0);
  const [rooms, setRooms] = useState(3);
  const [instruments, setInstruments] = useState(10000);
  const [teacherSalary, setTeacherSalary] = useState(3000);
  const [monthlyFee, setMonthlyFee] = useState(150);
  const [results, setResults] = useState<any>(null);

  const steps = [
    { title: "Practice Rooms", desc: "How many practice rooms to set up?" },
    { title: "Instrument Budget", desc: "Investment in musical instruments" },
    { title: "Teacher Salary", desc: "Monthly salary per music teacher" },
    { title: "Student Monthly Fee", desc: "Tuition fee per student per month" },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) { setStep(step + 1); playSound("navigate"); }
    else {
      const students = Math.round(rooms * 12 + instruments / 1000 - monthlyFee * 0.1 + teacherSalary * 0.01);
      const revenue = students * monthlyFee;
      const costs = rooms * 2000 + instruments * 0.05 + teacherSalary * rooms;
      const profit = revenue - costs;
      const satisfaction = Math.min(100, 30 + rooms * 10 + instruments / 500);
      const score = Math.round(profit / 100 + satisfaction);
      setResults({ revenue: Math.round(revenue), costs: Math.round(costs), profit: Math.round(profit), students, satisfaction: Math.round(satisfaction), score });
      playSound("success");
      toast.success(`Simulation complete! Score: ${score}`);
    }
  };

  if (results) {
    return (
      <Layout>
        <section className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold text-center mb-6">🎵 Music Academy — Results</h1>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Students</p><p className="text-2xl font-bold text-primary">{results.students}</p></CardContent></Card>
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
        <h1 className="text-3xl font-bold text-center mb-2">🎵 Music Academy Simulation</h1>
        <p className="text-center text-muted-foreground mb-8">Step {step + 1} of {steps.length}</p>
        <Card>
          <CardHeader><CardTitle>{steps[step].title}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{steps[step].desc}</p>
            {step === 0 && <div><p className="mb-2 font-medium">Rooms: {rooms}</p><Slider value={[rooms]} onValueChange={([v]) => setRooms(v)} min={1} max={10} /></div>}
            {step === 1 && <div><p className="mb-2 font-medium">Budget: ${instruments.toLocaleString()}</p><Slider value={[instruments]} onValueChange={([v]) => setInstruments(v)} min={2000} max={50000} step={1000} /></div>}
            {step === 2 && <div><p className="mb-2 font-medium">Salary: ${teacherSalary}/mo</p><Slider value={[teacherSalary]} onValueChange={([v]) => setTeacherSalary(v)} min={1000} max={8000} step={500} /></div>}
            {step === 3 && <div><p className="mb-2 font-medium">Fee: ${monthlyFee}/mo</p><Slider value={[monthlyFee]} onValueChange={([v]) => setMonthlyFee(v)} min={50} max={500} step={10} /></div>}
            <Button className="w-full" size="lg" onClick={handleNext}>{step < steps.length - 1 ? "Next →" : "Run Simulation 🚀"}</Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
