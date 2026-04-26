import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { toast } from "@/hooks/use-toast";
import { SimulationMentor } from "@/components/SimulationMentor";
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Calendar,
  AlertTriangle,
  Wrench,
  Egg,
  ChevronUp,
  ChevronDown,
  SkipForward,
  Trophy,
  RotateCcw,
} from "lucide-react";

const TOTAL_DAYS = 21;
const TOTAL_EGGS = 5;
const IDEAL_TEMP = 37.5;
const IDEAL_HUMIDITY = 55;

type EggState = "incubating" | "hatched" | "dead";

interface IncubatorState {
  temp: number;
  humidity: number;
  day: number;
  eggs: EggState[];
  malfunction: boolean;
  malfunctionType: string;
  score: number;
  gameOver: boolean;
  hatched: number;
  dead: number;
  log: string[];
}

export function IncubatorSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [state, setState] = useState<IncubatorState>({
    temp: IDEAL_TEMP,
    humidity: IDEAL_HUMIDITY,
    day: 1,
    eggs: Array(TOTAL_EGGS).fill("incubating"),
    malfunction: false,
    malfunctionType: "",
    score: 100,
    gameOver: false,
    hatched: 0,
    dead: 0,
    log: [t("sim.incubator.started")],
  });

  const [completed, setCompleted] = useState(false);

  // Restore saved progress
  useEffect(() => {
    if (!savedProgress) return;
    setState((s) => ({ ...s, score: savedProgress.score ?? s.score }));
    setCompleted(savedProgress.completed ?? false);
  }, [savedProgress]);

  // Malfunction chance each day
  const malfunctionChance = 0.2;

  const addLog = useCallback((msg: string) => {
    setState((s) => ({ ...s, log: [msg, ...s.log].slice(0, 20) }));
  }, []);

  const adjustTemp = (delta: number) => {
    if (state.gameOver || state.malfunction) return;
    setState((s) => {
      const newTemp = Math.round((s.temp + delta) * 10) / 10;
      return { ...s, temp: Math.max(30, Math.min(45, newTemp)) };
    });
  };

  const adjustHumidity = (delta: number) => {
    if (state.gameOver || state.malfunction) return;
    setState((s) => {
      const newH = s.humidity + delta;
      return { ...s, humidity: Math.max(20, Math.min(90, newH)) };
    });
  };

  const repairMalfunction = () => {
    setState((s) => ({
      ...s,
      malfunction: false,
      malfunctionType: "",
      score: Math.max(0, s.score - 5),
    }));
    addLog("🛠️ " + t("sim.incubator.repaired"));
  };

  const nextDay = () => {
    if (state.gameOver || state.malfunction) return;

    setState((prev) => {
      let { temp, humidity, day, eggs, score, hatched, dead } = { ...prev };
      const newDay = day + 1;

      // Check temp/humidity damage
      const tempDiff = Math.abs(temp - IDEAL_TEMP);
      const humDiff = Math.abs(humidity - IDEAL_HUMIDITY);

      let eggDamage = false;
      if (tempDiff > 2 || humDiff > 15) {
        // Risk of egg death
        const newEggs = [...eggs];
        for (let i = 0; i < newEggs.length; i++) {
          if (newEggs[i] === "incubating" && Math.random() < 0.3) {
            newEggs[i] = "dead";
            dead++;
            eggDamage = true;
          }
        }
        eggs = newEggs;
        if (eggDamage) {
          score = Math.max(0, score - 15);
        }
      }

      // Score adjustments
      if (tempDiff <= 0.5 && humDiff <= 5) {
        score = Math.min(100, score + 3);
      } else if (tempDiff > 1 || humDiff > 10) {
        score = Math.max(0, score - 5);
      }

      // Day 21: hatch surviving eggs
      let gameOver = false;
      if (newDay > TOTAL_DAYS) {
        gameOver = true;
        const newEggs = [...eggs];
        for (let i = 0; i < newEggs.length; i++) {
          if (newEggs[i] === "incubating") {
            newEggs[i] = "hatched";
            hatched++;
          }
        }
        eggs = newEggs;
      }

      // Random malfunction
      let malfunction = false;
      let malfunctionType = "";
      if (!gameOver && Math.random() < malfunctionChance) {
        malfunction = true;
        const types = [
          t("sim.incubator.malf.power"),
          t("sim.incubator.malf.fan"),
          t("sim.incubator.malf.sensor"),
          t("sim.incubator.malf.heater"),
        ];
        malfunctionType = types[Math.floor(Math.random() * types.length)];
        // Malfunction shifts conditions
        temp = temp + (Math.random() > 0.5 ? 2 : -2);
        humidity = humidity + (Math.random() > 0.5 ? 10 : -10);
      }

      return {
        ...prev,
        temp: Math.round(temp * 10) / 10,
        humidity: Math.max(20, Math.min(90, humidity)),
        day: newDay,
        eggs,
        score,
        hatched,
        dead,
        gameOver,
        malfunction,
        malfunctionType,
        log: prev.log,
      };
    });

    if (state.day + 1 > TOTAL_DAYS) {
      addLog("🐣 " + t("sim.incubator.hatchDay"));
    } else {
      addLog(`📅 ${t("sim.incubator.dayAdvanced")} ${state.day + 1}`);
    }
  };

  // Save completion
  useEffect(() => {
    if (state.gameOver && !completed && user && simulationId) {
      setCompleted(true);
      const points = Math.round(state.score * 0.5) + state.hatched * 10;
      earnPoints(points, `Incubator Simulation: ${state.hatched}/${TOTAL_EGGS} hatched`);
      
      saveSimulationProgress(user.id, simulationId, {
          current_step: TOTAL_DAYS,
          decisions: state.log as Record<string, unknown>,
          completed: true,
          score: state.score,
        });

      toast({
        title: t("bsim.completed"),
        description: `🐣 ${state.hatched}/${TOTAL_EGGS} | +${points} pts`,
      });
    }
  }, [state.gameOver, completed, user, simulationId, state.score, state.hatched, earnPoints, t, state.log]);

  const resetSimulation = () => {
    setCompleted(false);
    setState({
      temp: IDEAL_TEMP,
      humidity: IDEAL_HUMIDITY,
      day: 1,
      eggs: Array(TOTAL_EGGS).fill("incubating"),
      malfunction: false,
      malfunctionType: "",
      score: 100,
      gameOver: false,
      hatched: 0,
      dead: 0,
      log: [t("sim.incubator.started")],
    });
  };

  const tempStatus =
    Math.abs(state.temp - IDEAL_TEMP) <= 0.5
      ? "text-green-400"
      : Math.abs(state.temp - IDEAL_TEMP) <= 1.5
      ? "text-yellow-400"
      : "text-red-400";

  const humStatus =
    Math.abs(state.humidity - IDEAL_HUMIDITY) <= 5
      ? "text-green-400"
      : Math.abs(state.humidity - IDEAL_HUMIDITY) <= 10
      ? "text-yellow-400"
      : "text-red-400";

  const progressPct = Math.min((state.day / TOTAL_DAYS) * 100, 100);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="mb-2">
        <Link to="/business-simulator">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("bsim.backToList")}
        </Link>
      </Button>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">{t("sim.incubator.title")}</h1>
          <Badge variant="secondary">
            {t("sim.incubator.day")} {Math.min(state.day, TOTAL_DAYS)}/{TOTAL_DAYS}
          </Badge>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Malfunction Alert */}
      {state.malfunction && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div>
              <p className="font-bold text-destructive">{t("sim.incubator.malfAlert")}</p>
              <p className="text-sm text-muted-foreground">{state.malfunctionType}</p>
            </div>
          </div>
          <Button variant="destructive" onClick={repairMalfunction} className="gap-2">
            <Wrench className="h-4 w-4" />
            {t("sim.incubator.repair")}
          </Button>
        </div>
      )}

      {state.gameOver ? (
        /* Results */
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">{t("sim.incubator.results")}</h2>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="rounded-xl bg-green-500/10 p-4">
                <p className="text-2xl font-bold text-green-500">{state.hatched}</p>
                <p className="text-xs text-muted-foreground">{t("sim.incubator.hatched")}</p>
              </div>
              <div className="rounded-xl bg-red-500/10 p-4">
                <p className="text-2xl font-bold text-red-500">{state.dead}</p>
                <p className="text-xs text-muted-foreground">{t("sim.incubator.lost")}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-4">
                <p className="text-2xl font-bold text-primary">{state.score}</p>
                <p className="text-xs text-muted-foreground">{t("bsim.finalScore")}</p>
              </div>
            </div>
            <Button onClick={resetSimulation} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("bsim.playAgain")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Digital Display */}
          <Card className="bg-card border-2">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-bold text-lg">{t("sim.incubator.monitor")}</h2>
              
              <div className="rounded-xl bg-black p-6 space-y-3 font-mono">
                <div className={`flex items-center justify-between text-lg ${tempStatus}`}>
                  <span className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5" />
                    {t("sim.incubator.temp")}
                  </span>
                  <span className="text-2xl font-bold">{state.temp}°C</span>
                </div>
                <div className={`flex items-center justify-between text-lg ${humStatus}`}>
                  <span className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    {t("sim.incubator.humidity")}
                  </span>
                  <span className="text-2xl font-bold">{state.humidity}%</span>
                </div>
                <div className="flex items-center justify-between text-lg text-blue-400">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t("sim.incubator.day")}
                  </span>
                  <span className="text-2xl font-bold">{state.day}/{TOTAL_DAYS}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("sim.incubator.score")}</span>
                <Badge variant={state.score >= 70 ? "default" : "destructive"}>{state.score}/100</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Controls & Eggs */}
          <div className="space-y-4">
            {/* Controls */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="font-bold text-lg">{t("sim.incubator.controls")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => adjustTemp(0.5)}
                    disabled={state.malfunction}
                    className="gap-2"
                  >
                    <ChevronUp className="h-4 w-4" />
                    + {t("sim.incubator.temp")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => adjustTemp(-0.5)}
                    disabled={state.malfunction}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    - {t("sim.incubator.temp")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => adjustHumidity(5)}
                    disabled={state.malfunction}
                    className="gap-2"
                  >
                    <ChevronUp className="h-4 w-4" />
                    + {t("sim.incubator.humidity")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => adjustHumidity(-5)}
                    disabled={state.malfunction}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    - {t("sim.incubator.humidity")}
                  </Button>
                </div>
                <Button
                  onClick={nextDay}
                  disabled={state.malfunction}
                  className="w-full gap-2 text-base"
                >
                  <SkipForward className="h-4 w-4" />
                  {t("sim.incubator.nextDay")}
                </Button>
              </CardContent>
            </Card>

            {/* Eggs Display */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-bold text-lg mb-3">{t("sim.incubator.eggs")}</h2>
                <div className="flex justify-center gap-3 text-4xl">
                  {state.eggs.map((egg, i) => (
                    <span
                      key={i}
                      className={`transition-transform ${
                        egg === "hatched" ? "scale-110" : egg === "dead" ? "opacity-30 grayscale" : "animate-pulse"
                      }`}
                      title={
                        egg === "hatched"
                          ? t("sim.incubator.eggHatched")
                          : egg === "dead"
                          ? t("sim.incubator.eggDead")
                          : t("sim.incubator.eggIncubating")
                      }
                    >
                      {egg === "hatched" ? "🐣" : egg === "dead" ? "💀" : "🥚"}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Event Log */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("sim.incubator.log")}</h3>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-muted-foreground">
            {state.log.map((entry, i) => (
              <p key={i}>{entry}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Mentor */}
      <SimulationMentor
        simulationTitle={t("sim.incubator.title")}
        currentStepTitle={`${t("sim.incubator.day")} ${state.day} - T:${state.temp}°C H:${state.humidity}%`}
      />
    </div>
  );
}
