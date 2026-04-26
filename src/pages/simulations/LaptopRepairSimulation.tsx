import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Trophy, Wrench, AlertCircle } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";

interface Props { simulationId?: string; }

const FAULT_TYPES = [
  { id: "screen",    name: "🖥️ Broken Screen",       correctFix: "replace_screen",   points: 30, difficulty: 1 },
  { id: "battery",   name: "🔋 Battery Drain",         correctFix: "replace_battery",  points: 25, difficulty: 1 },
  { id: "keyboard",  name: "⌨️ Keyboard Failure",       correctFix: "replace_keyboard", points: 20, difficulty: 1 },
  { id: "hdd",       name: "💾 HDD / SSD Failure",      correctFix: "replace_storage",  points: 35, difficulty: 2 },
  { id: "ram",       name: "🧠 Random Crashes (RAM)",   correctFix: "replace_ram",      points: 40, difficulty: 2 },
  { id: "bios",      name: "⚙️ BIOS / Boot Failure",    correctFix: "flash_bios",       points: 50, difficulty: 3 },
  { id: "mobo",      name: "🔌 No Power (Motherboard)", correctFix: "replace_mobo",     points: 60, difficulty: 3 },
];

const FIX_OPTIONS: { id: string; label: string }[] = [
  { id: "replace_screen",   label: "Replace screen assembly" },
  { id: "replace_battery",  label: "Replace battery" },
  { id: "replace_keyboard", label: "Replace keyboard" },
  { id: "replace_storage",  label: "Replace HDD/SSD" },
  { id: "replace_ram",      label: "Reseat / replace RAM" },
  { id: "flash_bios",       label: "Flash BIOS firmware" },
  { id: "replace_mobo",     label: "Replace motherboard" },
  { id: "clean_thermal",    label: "Clean thermal paste" },
  { id: "reinstall_os",     label: "Reinstall OS" },
  { id: "run_diagnostics",  label: "Run full diagnostics" },
];

const JOBS = 8;

function pickFault() {
  return FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
}

export function LaptopRepairSimulation({ simulationId }: Props) {
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [tools, setTools] = useState(5000);
  const [warranty, setWarranty] = useState(6);
  const [jobIndex, setJobIndex] = useState(0);
  const [fault, setFault] = useState<typeof FAULT_TYPES[0] | null>(null);
  const [selectedFix, setSelectedFix] = useState("");
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: jobIndex, score: sc, completed: done,
      decisions: { correct, wrong } as Record<string, unknown>,
    });
  }, [user, simulationId, jobIndex, correct, wrong]);

  const startGame = () => {
    setJobIndex(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setFault(pickFault());
    setSelectedFix("");
    setFeedback(null);
    setStarted(true);
    playSound("scan");
    toast.success("🔧 Workshop opened! First laptop incoming…");
  };

  const applyFix = () => {
    if (!fault || !selectedFix) return;
    setResolving(true);
    setResolveProgress(0);

    let step = 0;
    const total = 12;
    const interval = setInterval(() => {
      step++;
      setResolveProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);

        const isCorrect = selectedFix === fault.correctFix;
        const pts = isCorrect ? fault.points + Math.round(warranty * 2) : Math.max(0, fault.points - 15);
        const newScore = score + pts;
        const newCorrect = correct + (isCorrect ? 1 : 0);
        const newWrong = wrong + (isCorrect ? 0 : 1);

        setScore(newScore);
        setCorrect(newCorrect);
        setWrong(newWrong);
        setFeedback({
          ok: isCorrect,
          msg: isCorrect
            ? `✅ Correct! ${fault.name} fixed. +${pts} pts`
            : `❌ Wrong fix for ${fault.name}. Correct: ${FIX_OPTIONS.find((f) => f.id === fault.correctFix)?.label}`,
        });
        setResolving(false);

        if (isCorrect) playSound("ding"); else playSound("wrong");

        if (jobIndex + 1 >= JOBS) {
          const final = newScore + Math.round((newCorrect / JOBS) * 50);
          setScore(final);
          setFinished(true);
          playSound("complete");
          saveProgress(final, true);
        }
      }
    }, 120);
  };

  const nextJob = () => {
    setJobIndex((j) => j + 1);
    setFault(pickFault());
    setSelectedFix("");
    setFeedback(null);
    playSound("select");
  };

  const restart = () => {
    setJobIndex(0); setScore(0); setCorrect(0); setWrong(0);
    setFault(null); setSelectedFix(""); setFeedback(null);
    setResolving(false); setFinished(false); setStarted(false);
  };

  if (finished) {
    const accuracy = Math.round((correct / JOBS) * 100);
    return (
      <div className="max-w-lg mx-auto animate-in fade-in space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-2xl font-bold">🔧 Repair Report</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-500/10 p-3"><p className="text-2xl font-bold text-green-500">{correct}/{JOBS}</p><p className="text-xs text-muted-foreground">Correct</p></div>
              <div className="rounded-xl bg-red-500/10 p-3"><p className="text-2xl font-bold text-red-500">{wrong}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
              <div className="rounded-xl bg-blue-500/10 p-3"><p className="text-2xl font-bold text-blue-500">{accuracy}%</p><p className="text-xs text-muted-foreground">Accuracy</p></div>
              <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{score}</p><p className="text-xs text-muted-foreground">Score</p></div>
            </div>
            <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
          </CardContent>
        </Card>
        <SimulationMentor simulationTitle="Laptop Repair Workshop" currentStepTitle="Results" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          {started ? `Job ${jobIndex + 1} / ${JOBS}` : "Workshop Setup"}
        </h2>
        {started && (
          <div className="flex gap-2">
            <Badge variant="secondary">✅ {correct}</Badge>
            <Badge variant="destructive">❌ {wrong}</Badge>
          </div>
        )}
      </div>
      {started && <Progress value={(jobIndex / JOBS) * 100} className="h-2" />}

      {resolving && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Wrench className="mx-auto h-8 w-8 text-primary animate-spin" />
            <p className="font-semibold">Applying fix…</p>
            <Progress value={resolveProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!started && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">🏪 Workshop Setup</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tool Investment: ${tools.toLocaleString()}</label>
              <Slider value={[tools]} onValueChange={([v]) => setTools(v)} min={1000} max={20000} step={500} />
              <p className="text-xs text-muted-foreground mt-1">Higher investment → access to more advanced repair tools</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Warranty Offered: {warranty} months</label>
              <Slider value={[warranty]} onValueChange={([v]) => setWarranty(v)} min={1} max={24} step={1} />
              <p className="text-xs text-muted-foreground mt-1">Longer warranty → bonus points per correct fix</p>
            </div>
            <Button onClick={startGame} className="w-full">🔧 Open Workshop ({JOBS} Jobs)</Button>
          </CardContent>
        </Card>
      )}

      {started && !resolving && fault && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{fault.name}</p>
                <p className="text-xs text-muted-foreground">Difficulty: {"⭐".repeat(fault.difficulty)} | Reward: {fault.points} pts base</p>
              </div>
            </div>

            {feedback ? (
              <div className={`p-3 rounded-lg ${feedback.ok ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                <p className="text-sm font-medium">{feedback.msg}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Select your fix</label>
                  <Select value={selectedFix} onValueChange={setSelectedFix}>
                    <SelectTrigger><SelectValue placeholder="Choose a repair action…" /></SelectTrigger>
                    <SelectContent>
                      {FIX_OPTIONS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={applyFix} disabled={!selectedFix} className="w-full">🔧 Apply Fix</Button>
              </>
            )}

            {feedback && jobIndex + 1 < JOBS && (
              <Button onClick={nextJob} className="w-full">Next Job →</Button>
            )}
          </CardContent>
        </Card>
      )}

      {started && <SimulationMentor simulationTitle="Laptop Repair Workshop" currentStepTitle={fault?.name ?? ""} />}
    </div>
  );
}
