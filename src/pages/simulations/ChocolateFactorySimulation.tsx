import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Lock, RotateCcw, Trophy, Star, Thermometer } from "lucide-react";

interface Props {
  simulationId?: string;
}

type StationId = "temper" | "mold" | "fill" | "package" | "truffle" | "brand";

interface Station {
  id: StationId;
  emoji: string;
  category: "free" | "premium";
  points: number;
  duration: number;
}

const STATIONS: Station[] = [
  { id: "temper", emoji: "🌡️", category: "free", points: 10, duration: 3000 },
  { id: "mold", emoji: "🍫", category: "free", points: 10, duration: 3000 },
  { id: "fill", emoji: "🍯", category: "premium", points: 25, duration: 4000 },
  { id: "package", emoji: "🎁", category: "premium", points: 25, duration: 4500 },
  { id: "truffle", emoji: "🟤", category: "premium", points: 20, duration: 4000 },
  { id: "brand", emoji: "✨", category: "free", points: 15, duration: 3500 },
];

export function ChocolateFactorySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<StationId[]>([]);
  const [activeStation, setActiveStation] = useState<StationId | null>(null);
  const [progress, setProgress] = useState(0);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [justCompleted, setJustCompleted] = useState<StationId | null>(null);

  // Restore saved progress
  useEffect(() => {
    if (!savedProgress) return;
    const d = savedProgress.decisions as any;
    if (d?.completed) setCompleted(d.completed);
    if (d?.proUnlocked) setProUnlocked(true);
    setScore(savedProgress.score ?? 0);
    setDone(savedProgress.completed ?? false);
  }, [savedProgress]);
  const [chocoTemp, setChocoTemp] = useState(20);

  // Progress timer
  useEffect(() => {
    if (!activeStation) return;
    const station = STATIONS.find((s) => s.id === activeStation)!;
    const steps = 20;
    const interval = station.duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, (step / steps) * 100));
      if (step % 5 === 0) playSound("tick");

      // Simulate tempering temperature
      if (activeStation === "temper" && step <= 15) {
        setChocoTemp(20 + Math.round((step / 15) * 11));
      }

      if (step >= steps) {
        clearInterval(timer);
        setCompleted((prev) => [...prev, activeStation]);
        setScore((prev) => prev + station.points);
        setJustCompleted(activeStation);
        setActiveStation(null);
        setProgress(0);
        playSound("ding");
        toast.success(t("sim.choco.stationDone"));
        setTimeout(() => setJustCompleted(null), 600);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [activeStation, t, playSound]);

  const startStation = useCallback((station: Station) => {
    if (activeStation || completed.includes(station.id)) return;
    if (station.category === "premium" && !proUnlocked) {
      playSound("wrong");
      setShowUnlock(true);
      return;
    }
    playSound("sizzle");
    setActiveStation(station.id);
    setProgress(0);
  }, [activeStation, completed, proUnlocked, playSound]);

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    playSound("unlock");
    toast.success(t("sim.choco.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === STATIONS.length;
    const finalScore = score + (allDone ? 30 : 0);
    setScore(finalScore);
    playSound(allDone ? "levelUp" : "complete");

    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: completed.length,
        decisions: JSON.parse(JSON.stringify({ completed, proUnlocked })),
        score: finalScore,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert({ user_id: user.id, simulation_id: simulationId, ...payload });
      }
    }
  };

  const restart = () => {
    playSound("whoosh");
    setProUnlocked(false);
    setCompleted([]);
    setActiveStation(null);
    setProgress(0);
    setShowUnlock(false);
    setDone(false);
    setScore(0);
    setChocoTemp(20);
  };

  if (done) {
    const allDone = completed.length === STATIONS.length;
    return (
      <Card className="max-w-lg mx-auto animate-fade-in-scale">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary animate-pop" />
          <CardTitle className="animate-score-pop">{t("sim.choco.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold animate-score-pop">{score} {t("sim.choco.points")}</p>
          <p className="text-muted-foreground">
            {allDone ? t("sim.choco.allStations") : t("sim.choco.partialStations")}
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.choco.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  const activeS = activeStation ? STATIONS.find((s) => s.id === activeStation) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Factory Production Line */}
      <Card className="overflow-hidden animate-fade-in-up">
        <div className="relative h-56 bg-gradient-to-b from-amber-950/40 to-muted/50 flex items-center justify-center">
          {/* Chocolate flow effect */}
          {activeStation === "temper" && (
            <div className="absolute bottom-0 w-full h-5 bg-amber-800 animate-shimmer opacity-60" />
          )}

          {activeStation && activeS ? (
            <div className="text-center space-y-3 animate-fade-in-scale">
              <span className="text-5xl animate-bounce inline-block">{activeS.emoji}</span>
              <p className="font-semibold">{t(`sim.choco.station.${activeS.id}`)}</p>
              <Progress value={progress} className="w-48 mx-auto h-3" />
              <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
              {activeStation === "temper" && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Thermometer className="h-4 w-4 text-destructive animate-wiggle" />
                  <span>{chocoTemp}°C</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2">
              <span className="text-5xl">🏭</span>
              <p className="text-muted-foreground">{t("sim.choco.selectStation")}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Status bar */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardContent className="py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("sim.choco.lineStatus")}</span>
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-destructive" />
            <span className="text-sm font-bold">{chocoTemp}°C</span>
            <Badge variant={chocoTemp >= 30 ? "default" : "secondary"} className="text-xs">
              {chocoTemp >= 30 ? t("sim.choco.tempReady") : t("sim.choco.tempLow")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stations grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STATIONS.map((station, index) => {
          const isDone = completed.includes(station.id);
          const locked = station.category === "premium" && !proUnlocked;
          const isJustDone = justCompleted === station.id;
          return (
            <Card
              key={station.id}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:shadow-lg ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""} ${isJustDone ? "animate-pop" : ""}`}
              style={{ animationDelay: `${index * 80}ms` }}
              onClick={() => startStation(station)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className={`text-3xl inline-block transition-transform ${isDone ? "animate-wiggle" : ""}`}>{station.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.choco.station.${station.id}`)}</p>
                <Badge variant={station.category === "premium" ? "destructive" : "outline"} className="text-xs">
                  {station.category === "premium" ? "PREMIUM" : t("sim.choco.free")}
                </Badge>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary animate-pop" />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock card */}
      {showUnlock && (
        <Card className="border-accent animate-slide-in-bottom">
          <CardContent className="py-6 text-center space-y-4">
            <span className="text-4xl animate-wiggle inline-block">🍫</span>
            <h3 className="text-lg font-bold">{t("sim.choco.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.choco.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro} className="animate-glow-pulse">{t("sim.choco.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.choco.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !activeStation && (
        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Button size="lg" onClick={finish} className="animate-glow-pulse">{t("sim.choco.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.choco.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.choco.score")}: <span className="font-bold text-foreground">{score}</span></p>
    </div>
  );
}
