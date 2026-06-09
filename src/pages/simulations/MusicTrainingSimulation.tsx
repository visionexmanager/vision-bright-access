import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Trophy, Music, Star, ArrowLeft } from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";
import { SimulationScene } from "@/components/SimulationScene";

interface Props { simulationId?: string; }

const INSTRUMENTS = [
  { id: "piano",  nameKey: "sim.music.instrument.piano",  demand: 90, cost: 8000,  weeks: 12 },
  { id: "guitar", nameKey: "sim.music.instrument.guitar", demand: 80, cost: 3000,  weeks: 10 },
  { id: "violin", nameKey: "sim.music.instrument.violin", demand: 60, cost: 5000,  weeks: 16 },
  { id: "drums",  nameKey: "sim.music.instrument.drums",  demand: 70, cost: 4000,  weeks: 8  },
];

const TEACHING_STYLES = [
  { id: "classical", nameKey: "sim.music.style.classical",  retention: 0.85, progress: 0.7 },
  { id: "practical", nameKey: "sim.music.style.practical",  retention: 0.75, progress: 0.9 },
  { id: "mixed",     nameKey: "sim.music.style.mixed",      retention: 0.80, progress: 0.8 },
];

const WEEKS = 12;

export function MusicTrainingSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { announce, announceUrgent } = useScreenReader();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [instrument, setInstrument] = useState(INSTRUMENTS[0]);
  const [style, setStyle] = useState(TEACHING_STYLES[0]);
  const [groupSize, setGroupSize] = useState(6);
  const [sessionFee, setSessionFee] = useState(80);
  const [practiceHours, setPracticeHours] = useState(3);

  const [week, setWeek] = useState(1);
  const [students, setStudents] = useState(6);
  const [skill, setSkill] = useState(10);
  const [revenue, setRevenue] = useState(0);
  const [costs, setCosts] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<{ week: number; students: number; skill: number; earned: number }[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
  }, [savedProgress]);

  const saveProgress = useCallback(async (sc: number, done: boolean) => {
    if (!user || !simulationId) return;
    await saveSimulationProgress(user.id, simulationId, {
      current_step: week, score: sc, completed: done,
      decisions: { revenue, costs, students, skill } as Record<string, unknown>,
    });
  }, [user, simulationId, week, revenue, costs, students, skill]);

  const setupCost = instrument.cost + groupSize * 50;

  const startAcademy = () => {
    setStudents(groupSize);
    setSkill(10);
    setRevenue(0);
    setCosts(setupCost);
    setLog([]);
    setWeek(1);
    setStarted(true);
    playSound("scan");
    toast.success(t("sim.music.academyStarted").replace("{instrument}", t(instrument.nameKey as any)).replace("{count}", String(groupSize)));
  };

  const simulateWeek = () => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);

    let step = 0;
    const total = 12;
    const interval = setInterval(() => {
      step++;
      setSimProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(interval);

        const skillGain = Math.round(
          style.progress * practiceHours * 2
          + (instrument.demand / 100) * 3
          - (students > 8 ? 2 : 0)
        );
        const newSkill = Math.min(100, skill + skillGain);

        const dropout = students > 1 && style.retention < Math.random() + 0.1 ? 1 : 0;
        const newStudents = Math.max(1, students - dropout);

        const weekEarned = Math.round(newStudents * sessionFee * 4);
        const weekCost = Math.round(newStudents * 20 + practiceHours * 30);

        setStudents(newStudents);
        setSkill(newSkill);
        setRevenue((r) => r + weekEarned);
        setCosts((c) => c + weekCost);
        setLog((l) => [...l, { week, students: newStudents, skill: newSkill, earned: weekEarned }]);

        setSimulating(false);
        if (dropout > 0) { announceUrgent("Incorrect. Try again."); } else { announce("Correct! Well done."); }
        playSound("ding");

        if (dropout > 0)
          toast.error(t("sim.music.studentDropout").replace("{count}", String(newStudents)));
        else
          toast.success(t("sim.music.weekComplete").replace("{week}", String(week)).replace("{skill}", String(newSkill)).replace("{earned}", String(weekEarned)));

        if (week >= WEEKS) {
          const finalScore = Math.max(0, Math.round(newSkill + (newStudents / groupSize) * 50 + (revenue - costs) / 100));
          setScore(finalScore);
          setFinished(true);
          announce("Simulation complete!");
          playSound("complete");
          saveProgress(finalScore, true);
        } else {
          setWeek((w) => w + 1);
        }
      }
    }, 120);
  };

  const restart = () => {
    setWeek(1); setStudents(groupSize); setSkill(10);
    setRevenue(0); setCosts(0); setSimulating(false);
    setFinished(false); setScore(0); setLog([]); setStarted(false);
  };

  if (finished) {
    const netProfit = revenue - costs;
    return (
      <div className="max-w-lg mx-auto animate-in fade-in space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-2xl font-bold">{t("sim.music.report.title")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-purple-500/10 p-3"><p className="text-2xl font-bold text-purple-500">{skill}%</p><p className="text-xs text-muted-foreground">{t("sim.music.report.avgSkill")}</p></div>
              <div className="rounded-xl bg-blue-500/10 p-3"><p className="text-2xl font-bold text-blue-500">{students}/{groupSize}</p><p className="text-xs text-muted-foreground">{t("sim.music.report.studentsLeft")}</p></div>
              <div className={`rounded-xl p-3 ${netProfit >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>${netProfit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("sim.music.report.netProfit")}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3"><p className="text-2xl font-bold text-primary">{score}</p><p className="text-xs text-muted-foreground">{t("sim.music.report.score")}</p></div>
            </div>
            <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.music.btn.playAgain")}</Button>
          </CardContent>
        </Card>
        <SimulationMentor simulationTitle={t("sim.music.title")} currentStepTitle={t("sim.music.report.title")} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SimulationScene slug="music-training" isActive={started} isComplete={finished} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          {started ? t("sim.music.weekHeader").replace("{week}", String(week)).replace("{total}", String(WEEKS)) : t("sim.music.setupHeader")}
        </h2>
        {started && (
          <div className="flex gap-2">
            <Badge variant="secondary" role="status" aria-live="polite">{t("sim.music.studentsBadge").replace("{count}", String(students))}</Badge>
            <Badge variant="outline" role="status" aria-live="polite"><Star className="h-3 w-3 mr-1" />{skill}%</Badge>
          </div>
        )}
      </div>
      {started && <Progress value={((week - 1) / WEEKS) * 100} className="h-2" />}

      {simulating && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center space-y-3">
            <Music className="mx-auto h-8 w-8 text-primary animate-bounce" />
            <p className="font-semibold">{t("sim.music.simulatingWeek").replace("{week}", String(week))}</p>
            <Progress value={simProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {!started && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">{t("sim.music.setupTitle")}</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.music.instrumentLabel")}</label>
              <Select value={instrument.id} onValueChange={(v) => setInstrument(INSTRUMENTS.find((i) => i.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSTRUMENTS.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{t(i.nameKey as any)} — Demand {i.demand}% | ${i.cost} setup</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.music.teachingStyle")}</label>
              <Select value={style.id} onValueChange={(v) => setStyle(TEACHING_STYLES.find((s) => s.id === v)!)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEACHING_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{t(s.nameKey as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.music.groupSizeLabel").replace("{count}", String(groupSize))}</label>
              <Slider value={[groupSize]} onValueChange={([v]) => setGroupSize(v)} min={2} max={15} step={1} />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs">
              <div className="flex justify-between"><span>{t("sim.music.costs.setupCost")}</span><span>${setupCost.toLocaleString()}</span></div>
            </div>
            <Button onClick={startAcademy} className="w-full" aria-label={t("sim.music.btn.openAcademy")}>{t("sim.music.btn.openAcademy")}</Button>
          </CardContent>
        </Card>
      )}

      {started && !simulating && week <= WEEKS && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">{t("sim.music.stats.students")}</p><p className="font-bold">{students}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("sim.music.stats.skill")}</p><p className="font-bold">{skill}%</p></div>
              <div><p className="text-xs text-muted-foreground">{t("sim.music.stats.revenue")}</p><p className="font-bold">${revenue}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("sim.music.stats.costs")}</p><p className="font-bold">${costs}</p></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.music.sessionFeeLabel").replace("{fee}", String(sessionFee))}</label>
              <Slider value={[sessionFee]} onValueChange={([v]) => setSessionFee(v)} min={30} max={300} step={10} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("sim.music.practiceHoursLabel").replace("{hours}", String(practiceHours))}</label>
              <Slider value={[practiceHours]} onValueChange={([v]) => setPracticeHours(v)} min={1} max={6} step={1} />
            </div>
            <Button onClick={simulateWeek} className="w-full" aria-label={t("sim.music.btn.simulateWeek").replace("{week}", String(week))}>
              {t("sim.music.btn.simulateWeek").replace("{week}", String(week))}
            </Button>
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs mb-2">{t("sim.music.history.title")}</h3>
            <div className="max-h-32 overflow-y-auto">
              {log.map((l) => (
                <div key={l.week} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                  <span>{t("sim.music.history.entry").replace("{week}", String(l.week)).replace("{students}", String(l.students)).replace("{skill}", String(l.skill))}</span>
                  <span className="text-green-500 font-medium">+${l.earned}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {started && <SimulationMentor simulationTitle={t("sim.music.title")} currentStepTitle={t("sim.music.weekHeader").replace("{week}", String(week)).replace("{total}", String(WEEKS))} />}
    </div>
  );
}
